import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { GenericId } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * The runtime plane.
 *
 * This is the only place socket state is written, and it is only written from
 * what an agent actually reported. The panel never flips a session to
 * `connected` on its own: it queues a command, the agent opens a real Baileys
 * socket, and the `connection.update` events come back here.
 *
 *   agent ── heartbeat ──▶ presence + the servers it should be holding
 *         ── poll ──────▶ claims queued commands (power, send, install…)
 *         ── event ─────▶ connection.update / messages.upsert / creds.update
 *         ── ack ───────▶ the command's real outcome
 *
 * Everything is authenticated with the node's wings bearer token, so an agent
 * only ever touches its own servers.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = any;
type Row = Record<string, unknown>;

/** The index builder as this module uses it: one `eq` per indexed column. */
type Q = { eq: (field: string, value: unknown) => Q } & Record<string, unknown>;

/** How long without a heartbeat before a node's agent counts as gone. */
export const AGENT_TIMEOUT_MS = 30_000;

/** How long a claimed command stays claimed before it is handed out again. */
const COMMAND_LEASE_MS = 90_000;

/** How many times a command is redelivered before it is marked failed. */
const MAX_ATTEMPTS = 3;

/** Every verb the panel can hand to an agent. */
export type CommandKind =
  | "start"
  | "stop"
  | "restart"
  | "kill"
  | "send"
  | "pairing"
  | "logout"
  | "install";

const LOG_LEVELS = ["info", "success", "warn", "error", "debug", "command"] as const;

const MESSAGE_KINDS = [
  "text",
  "image",
  "sticker",
  "poll",
  "location",
  "contact",
  "file",
] as const;

const RECEIPT_STATUSES = ["sent", "delivered", "read", "failed"] as const;

/* ------------------------------------------------------------------ */
/* Plumbing                                                           */
/* ------------------------------------------------------------------ */

async function digest(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The node a wings token belongs to, or null. */
export async function nodeForToken(ctx: Ctx, token: string): Promise<Row | null> {
  if (!token) return null;
  const tokenHash = await digest(token);
  const node = await ctx.db
    .query("nodes")
    .withIndex("by_token", (q: { eq: (f: "tokenHash", v: string) => unknown }) =>
      q.eq("tokenHash", tokenHash),
    )
    .unique();
  return node === null ? null : (node as Row);
}

async function nodeOrThrow(ctx: Ctx, token: string): Promise<Row> {
  if (!token) throw new Error("missing bearer token");
  const node = await nodeForToken(ctx, token);
  if (node === null) throw new Error("bad token");
  return node;
}

function sid(row: Row): GenericId<"waSessions"> {
  return row._id as GenericId<"waSessions">;
}

function nid(row: Row): GenericId<"nodes"> {
  return row._id as GenericId<"nodes">;
}

async function log(
  ctx: Ctx,
  sessionId: unknown,
  level: (typeof LOG_LEVELS)[number],
  message: string,
) {
  await ctx.db.insert("sessionLogs", {
    sessionId,
    level,
    message,
    createdAt: Date.now(),
  });
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function byUuid(
  ctx: Ctx,
  uuid: string,
  nodeId: unknown,
): Promise<Row | null> {
  if (!uuid) return null;
  const session = await ctx.db
    .query("waSessions")
    .withIndex("by_uuid", (q: Q) => q.eq("uuid", uuid))
    .unique();
  if (session === null || session.nodeId !== nodeId) return null;
  return session as Row;
}

/** The agent holding this node, if one has reported in recently. */
export async function liveWorker(ctx: Ctx, nodeId: unknown): Promise<Row | null> {
  const workers = (await ctx.db
    .query("workers")
    .withIndex("by_node", (q: Q) => q.eq("nodeId", nodeId))
    .collect()) as Row[];
  const cutoff = Date.now() - AGENT_TIMEOUT_MS;
  const live = workers
    .filter((w) => Number(w.lastSeenAt) > cutoff)
    .sort((a, b) => Number(b.lastSeenAt) - Number(a.lastSeenAt));
  return live[0] ?? null;
}

/** Is an agent holding this node right now? */
export async function agentOnline(ctx: Ctx, nodeId: unknown): Promise<boolean> {
  return (await liveWorker(ctx, nodeId)) !== null;
}

/**
 * The verbs where a second queued copy is pure noise.
 *
 * `send` and `install` are deliberately not here: two messages are two
 * messages, and two installs are two installs.
 */
const DEDUPE_KINDS: CommandKind[] = [
  "start",
  "stop",
  "restart",
  "kill",
  "pairing",
  "logout",
];

/**
 * Queue work for the agent that owns a node.
 *
 * Every panel action funnels through here, which is what makes the console
 * honest: if no agent ever claims the row, the row says so. Power verbs are
 * deduped while they are still queued — pressing Start five times with no agent
 * attached should leave one job waiting, not five.
 */
export async function enqueue(
  ctx: Ctx,
  args: {
    nodeId: GenericId<"nodes">;
    sessionId?: GenericId<"waSessions">;
    kind: CommandKind;
    payload?: unknown;
  },
) {
  const now = Date.now();

  if (args.sessionId && DEDUPE_KINDS.includes(args.kind)) {
    const pending = (await ctx.db
      .query("runtimeCommands")
      .withIndex("by_session", (q: Q) => q.eq("sessionId", args.sessionId))
      .collect()) as Row[];
    const duplicate = pending.find(
      (cmd) => cmd.kind === args.kind && cmd.status === "queued",
    );
    if (duplicate) return duplicate._id as GenericId<"runtimeCommands">;
  }

  return await ctx.db.insert("runtimeCommands", {
    nodeId: args.nodeId,
    sessionId: args.sessionId,
    kind: args.kind,
    payload: args.payload,
    status: "queued",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  });
}

/** The server object as the agent needs it: what to run, and towards what. */
function agentView(s: Row) {
  return {
    uuid: s.uuid ?? null,
    name: s.name,
    jid: s.jid ?? null,
    desired_power: s.desiredPower ?? "stopped",
    power: s.power ?? "stopped",
    status: s.status,
    worker_state: s.workerState ?? "offline",
    pair_method: s.pairMethod,
    phone: s.phone ?? null,
    startup: s.startup ?? "node index.js",
    image: s.image ?? null,
    install_state: s.installState ?? "installed",
    auto_reply: s.autoReply ?? false,
    prefix: s.prefix ?? null,
    suspended: s.suspended ?? false,
    node_id: s.nodeId,
    created_at: s.createdAt,
  };
}

/**
 * The event envelope a webhook receives.
 *
 * Kept flat and boring on purpose: whatever the receiver is written in, it can
 * read `event` and `data` without knowing anything about this panel.
 */
type Delivery = {
  webhookId?: GenericId<"webhooks">;
  ownerId: GenericId<"users">;
  sessionId?: GenericId<"waSessions">;
  event: string;
  url: string;
  payload: Row;
};

/**
 * Every enabled endpoint that asked for this event on this server.
 *
 * A session's own `webhookUrl` counts too — it is the quick path the console
 * offers, and it is delivered even though it has no row of its own.
 */
async function deliveriesFor(
  ctx: Ctx,
  session: Row,
  event: string,
  data: unknown,
): Promise<Delivery[]> {
  const ownerId = session.ownerId as GenericId<"users">;
  const sessionId = sid(session);
  const hooks = (await ctx.db
    .query("webhooks")
    .withIndex("by_owner", (q: Q) => q.eq("ownerId", ownerId))
    .collect()) as Row[];

  const now = Date.now();
  const stamp = {
    id: `evt_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    event,
    delivered_at: now,
    server: {
      uuid: session.uuid ?? null,
      uuid_short: session.uuidShort ?? null,
      name: session.name,
      jid: session.jid ?? null,
      node_id: session.nodeId ?? null,
    },
    data,
  };

  const out: Delivery[] = hooks
    .filter(
      (hook) =>
        hook.enabled === true &&
        Array.isArray(hook.events) &&
        (hook.events as string[]).includes(event) &&
        (hook.sessionId === undefined || hook.sessionId === sessionId),
    )
    .map((hook) => ({
      webhookId: hook._id as GenericId<"webhooks">,
      ownerId,
      sessionId,
      event,
      url: String(hook.url),
      payload: stamp,
    }));

  const adhoc = typeof session.webhookUrl === "string" ? session.webhookUrl.trim() : "";
  if (adhoc && !out.some((d) => d.url === adhoc)) {
    out.push({ ownerId, sessionId, event, url: adhoc, payload: stamp });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* The agent contract                                                 */
/* ------------------------------------------------------------------ */

/**
 * Presence, and the answer to "what should this node be running?".
 *
 * The agent calls this on a short interval. It doubles as the panel's liveness
 * signal: `nodes.online` and every `workerState` follow from here, so a dead
 * agent shows up as an offline node rather than a frozen "connected" badge.
 */
async function heartbeatImpl(
  ctx: Ctx,
  args: { token: string; name: string; version: string; sessions: number; pid?: number },
) {
  {
    const node = await nodeOrThrow(ctx, args.token);
    const now = Date.now();
    const nodeDocId = nid(node);

    const workers = (await ctx.db
      .query("workers")
      .withIndex("by_node", (q: Q) => q.eq("nodeId", nodeDocId))
      .collect()) as Row[];
    const existing = workers.find((w) => w.name === args.name);

    let workerId: GenericId<"workers">;
    if (existing) {
      workerId = existing._id as GenericId<"workers">;
      await ctx.db.patch(workerId, {
        version: args.version,
        sessions: args.sessions,
        pid: args.pid,
        lastSeenAt: now,
      });
    } else {
      workerId = await ctx.db.insert("workers", {
        nodeId: nodeDocId,
        name: args.name,
        version: args.version,
        sessions: args.sessions,
        pid: args.pid,
        startedAt: now,
        lastSeenAt: now,
      });
    }

    await ctx.db.patch(nodeDocId, { online: true, lastSeenAt: now });

    const sessions = (await ctx.db.query("waSessions").collect()) as Row[];
    const mine = sessions.filter((s) => s.nodeId === nodeDocId);
    for (const session of mine) {
      if (session.workerId !== workerId) {
        await ctx.db.patch(sid(session), { workerId });
      }
    }

    return {
      ok: true,
      node: {
        id: node.id,
        name: node.name,
        location: node.location,
        daemon: node.daemonVersion,
      },
      worker: args.name,
      servers: mine.map(agentView),
    };
  }
}

export const heartbeat = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    version: v.string(),
    sessions: v.number(),
    pid: v.optional(v.number()),
  },
  handler: async (ctx, args) => await heartbeatImpl(ctx, args),
});

/**
 * Claim queued work.
 *
 * Claimed rows go to `running` with a lease. If the agent dies mid-command the
 * lease expires and the command is handed out again — a few times, then it is
 * marked failed rather than looping forever.
 */
async function pollImpl(
  ctx: Ctx,
  args: { token: string; limit?: number },
) {
  {
    const node = await nodeOrThrow(ctx, args.token);
    const nodeDocId = nid(node);
    const now = Date.now();

    const running = (await ctx.db
      .query("runtimeCommands")
      .withIndex("by_node_status", (q: Q) =>
        q.eq("nodeId", nodeDocId).eq("status", "running"),
      )
      .collect()) as Row[];
    for (const cmd of running) {
      if (now - Number(cmd.updatedAt) < COMMAND_LEASE_MS) continue;
      if (Number(cmd.attempts) >= MAX_ATTEMPTS) {
        await ctx.db.patch(cmd._id, {
          status: "error",
          result: "the agent never acknowledged this command",
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(cmd._id, { status: "queued", updatedAt: now });
      }
    }

    const queued = (await ctx.db
      .query("runtimeCommands")
      .withIndex("by_node_status", (q: Q) =>
        q.eq("nodeId", nodeDocId).eq("status", "queued"),
      )
      .collect()) as Row[];
    queued.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));

    // A command whose server is gone is not work. Retire it here so a fresh
    // agent is never handed a uuid the panel has already forgotten — that is
    // how orphans from deleted servers would otherwise come back to life.
    const live: Array<{ cmd: Row; session: Row | null }> = [];
    for (const cmd of queued) {
      if (cmd.sessionId === undefined) {
        live.push({ cmd, session: null });
        continue;
      }
      const session = await ctx.db.get(cmd.sessionId);
      if (session === null) {
        await ctx.db.patch(cmd._id, {
          status: "error",
          result: "the server this command was queued for no longer exists",
          updatedAt: now,
        });
        continue;
      }
      live.push({ cmd, session: session as Row });
    }

    const limit = Math.max(1, Math.min(args.limit ?? 12, 25));
    const claimed: Row[] = [];
    for (const { cmd, session } of live.slice(0, limit)) {
      await ctx.db.patch(cmd._id, {
        status: "running",
        attempts: Number(cmd.attempts) + 1,
        updatedAt: now,
      });
      claimed.push({
        id: cmd._id,
        kind: cmd.kind,
        attempts: Number(cmd.attempts) + 1,
        uuid: session?.uuid ?? null,
        payload: cmd.payload ?? null,
        desired_power: session?.desiredPower ?? null,
        startup: session?.startup ?? null,
        created_at: cmd.createdAt,
      });
    }

    await ctx.db.patch(nodeDocId, { online: true, lastSeenAt: now });
    return claimed;
  }
}

export const poll = mutation({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => await pollImpl(ctx, args),
});

/** Report a command's real outcome. */
async function ackImpl(
  ctx: Ctx,
  args: { token: string; commandId: string; status: "done" | "error"; result?: string },
) {
  const node = await nodeOrThrow(ctx, args.token);
  const cmd = await ctx.db.get(args.commandId as GenericId<"runtimeCommands">);
  if (cmd === null || cmd.nodeId !== node._id) {
    throw new Error("no such command on this node");
  }
  await ctx.db.patch(cmd._id, {
    status: args.status,
    result: args.result,
    updatedAt: Date.now(),
  });
  return { ok: true };
}

export const ack = mutation({
  args: {
    token: v.string(),
    commandId: v.string(),
    status: v.union(v.literal("done"), v.literal("error")),
    result: v.optional(v.string()),
  },
  handler: async (ctx, args) => await ackImpl(ctx, args),
});

/**
 * Everything the socket told the agent.
 *
 * One event in, one row (or a few) out, plus the list of webhooks that should
 * hear about it. The action above this function does the actual HTTP delivery —
 * this half stays deterministic and testable.
 */
async function applyEventImpl(
  ctx: Ctx,
  args: { token: string; uuid?: string; event: string; data?: unknown },
) {
  {
    const node = await nodeOrThrow(ctx, args.token);
    const now = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (args.data ?? {}) as any;
    const deliveries: Delivery[] = [];

    if (!args.uuid) {
      await ctx.db.patch(nid(node), { online: true, lastSeenAt: now });
      return { ok: true, deliveries };
    }

    const session = await byUuid(ctx, args.uuid, node._id);
    if (session === null) throw new Error("no such server on this node");
    const sessionId = sid(session);
    const jidHint = typeof session.jid === "string" ? session.jid : undefined;

    switch (args.event) {
      case "connection.update": {
        const connection = String(data.connection ?? "");
        const reason = data.reason ? String(data.reason) : undefined;
        const statusCode =
          typeof data.statusCode === "number" ? data.statusCode : undefined;
        const qr = typeof data.qr === "string" ? data.qr : undefined;

        if (connection === "open") {
          const jid = typeof data.jid === "string" ? data.jid : jidHint;
          await ctx.db.patch(sessionId, {
            status: "connected",
            power: "running",
            desiredPower: "running",
            workerState: "live",
            jid,
            pushName:
              typeof data.pushName === "string" && data.pushName
                ? data.pushName
                : session.pushName,
            qrPayload: undefined,
            pairingCode: undefined,
            pairingExpiresAt: undefined,
            lastConnectedAt: now,
            lastSeenAt: now,
            statusChangedAt: now,
            lastExit: undefined,
          });
          await log(ctx, sessionId, "success", "[baileys] connection.update — connection: open");
          await log(ctx, sessionId, "info", `[baileys] logged in as ${jid ?? "unknown"}`);
          await log(
            ctx,
            sessionId,
            "debug",
            "[baileys] subscribed: messages.upsert, message.receipt.update",
          );
        } else if (qr) {
          await ctx.db.patch(sessionId, {
            status: "awaiting_pairing",
            power: "running",
            workerState: "pairing",
            qrPayload: qr,
            pairingCode: undefined,
            pairingExpiresAt: now + 50_000,
            lastSeenAt: now,
            statusChangedAt: now,
          });
          await log(
            ctx,
            sessionId,
            "success",
            "[baileys] QR ref received — scan from WhatsApp → Linked devices",
          );
        } else if (connection === "connecting") {
          await ctx.db.patch(sessionId, {
            status: "connecting",
            power: "running",
            workerState: "starting",
            lastSeenAt: now,
            statusChangedAt: now,
          });
          await log(ctx, sessionId, "info", "[baileys] connecting to wss://web.whatsapp.com/ws/chat");
        } else if (connection === "close") {
          const loggedOut =
            statusCode === 401 || /log(ged)?\s*out|removed|replaced/i.test(reason ?? "");
          if (loggedOut) {
            await ctx.db.patch(sessionId, {
              status: "disconnected",
              power: "stopped",
              desiredPower: "stopped",
              workerState: "stopped",
              qrPayload: undefined,
              pairingCode: undefined,
              pairingExpiresAt: undefined,
              jid: undefined,
              pushName: undefined,
              cpu: 0,
              memoryMb: 0,
              lastExit: reason ?? "logged out",
              lastSeenAt: now,
              statusChangedAt: now,
            });
            await log(
              ctx,
              sessionId,
              "warn",
              "[baileys] logged out — the agent dropped the creds, link the device again",
            );
          } else {
            await ctx.db.patch(sessionId, {
              status: "connecting",
              workerState:
                session.desiredPower === "stopped" ? "stopping" : "reconnecting",
              qrPayload: undefined,
              pairingCode: undefined,
              pairingExpiresAt: undefined,
              lastExit: reason ?? `close ${statusCode ?? ""}`.trim(),
              lastSeenAt: now,
              statusChangedAt: now,
            });
            await log(
              ctx,
              sessionId,
              "warn",
              `[baileys] connection closed (${statusCode ?? "-"}) — ${
                reason ?? "reconnecting"
              }; creds kept`,
            );
          }
        }

        const hooks = await deliveriesFor(ctx, session, "connection.update", {
          connection: connection || (qr ? "qr" : "unknown"),
          reason: reason ?? null,
          status_code: statusCode ?? null,
          jid: session.jid ?? null,
        });
        deliveries.push(...hooks);
        break;
      }

      case "creds.update": {
        await ctx.db.patch(sessionId, { credsSyncedAt: now, lastSeenAt: now });
        const keys =
          typeof data.keys === "number" ? data.keys : Array.isArray(data.keys) ? data.keys.length : undefined;
        await log(
          ctx,
          sessionId,
          "debug",
          `[baileys] creds.update — auth state synced to the panel${
            keys === undefined ? "" : ` (${keys} keys)`
          }`,
        );
        deliveries.push(
          ...(await deliveriesFor(ctx, session, "creds.update", {
            registered: data.registered ?? null,
            me: data.me ?? null,
          })),
        );
        break;
      }

      case "pairing.code": {
        const code = String(data.code ?? "").trim();
        if (!code) break;
        await ctx.db.patch(sessionId, {
          pairMethod: "code",
          pairingCode: code,
          pairingExpiresAt: now + 120_000,
          status: "awaiting_pairing",
          power: "running",
          workerState: "pairing",
          qrPayload: undefined,
          lastSeenAt: now,
          statusChangedAt: now,
        });
        await log(ctx, sessionId, "success", `[baileys] requestPairingCode → ${code}`);
        break;
      }

      case "messages.upsert": {
        const batch = Array.isArray(data.messages) ? (data.messages as Row[]) : [];
        let inbound = 0;
        let outbound = 0;

        for (const row of batch) {
          const jid = String(row.jid ?? "");
          if (!jid) continue;
          const fromMe = row.fromMe === true;
          const body = String(row.body ?? "");
          const kind = (MESSAGE_KINDS as readonly string[]).includes(String(row.kind))
            ? (String(row.kind) as (typeof MESSAGE_KINDS)[number])
            : "text";
          const clientId = typeof row.clientId === "string" ? row.clientId : undefined;
          const waMessageId = typeof row.id === "string" ? row.id : undefined;
          const pushName =
            typeof row.pushName === "string" && row.pushName
              ? row.pushName
              : jid.split("@")[0];
          const at = typeof row.timestamp === "number" ? row.timestamp : now;

          if (fromMe && clientId) {
            const existing = await ctx.db
              .query("waMessages")
              .withIndex("by_client", (q: Q) => q.eq("clientId", clientId))
              .unique();
            if (existing !== null) {
              await ctx.db.patch(existing._id, {
                status: "sent",
                waMessageId,
                body: body || existing.body,
              });
              outbound += 1;
              await log(
                ctx,
                sessionId,
                "command",
                `[baileys] sent ${truncate(body || "(empty)", 48)} → ${jid.split("@")[0]}`,
              );
              continue;
            }
          }

          await ctx.db.insert("waMessages", {
            sessionId,
            direction: fromMe ? "outbound" : "inbound",
            jid,
            pushName,
            body,
            kind,
            status: fromMe ? "sent" : "delivered",
            clientId,
            waMessageId,
            sessionName: session.name,
            createdAt: at,
          });

          if (fromMe) {
            outbound += 1;
            await log(
              ctx,
              sessionId,
              "command",
              `[baileys] sent ${truncate(body || "(empty)", 48)} → ${jid.split("@")[0]}`,
            );
          } else {
            inbound += 1;
            await log(
              ctx,
              sessionId,
              "info",
              `[messages.upsert] ${pushName} <${jid.split("@")[0]}> — ${truncate(body, 48)}`,
            );
          }
        }

        if (inbound || outbound) {
          await ctx.db.patch(sessionId, {
            messagesReceived: Number(session.messagesReceived ?? 0) + inbound,
            messagesSent: Number(session.messagesSent ?? 0) + outbound,
            lastSeenAt: now,
          });
        }

        deliveries.push(
          ...(await deliveriesFor(ctx, session, "messages.upsert", {
            type: data.type ?? "notify",
            messages: batch,
          })),
        );
        break;
      }

      case "message.sent": {
        const clientId = typeof data.clientId === "string" ? data.clientId : undefined;
        const jid = String(data.jid ?? "");
        const body = String(data.body ?? "");
        const ok = data.ok !== false;
        const waMessageId = typeof data.id === "string" ? data.id : undefined;

        const existing = clientId
          ? await ctx.db
              .query("waMessages")
              .withIndex("by_client", (q: Q) => q.eq("clientId", clientId))
              .unique()
          : null;

        if (existing !== null) {
          await ctx.db.patch(existing._id, {
            status: ok ? "sent" : "failed",
            waMessageId,
            body: body || existing.body,
          });
        } else {
          await ctx.db.insert("waMessages", {
            sessionId,
            direction: "outbound",
            jid,
            pushName: jid.split("@")[0],
            body,
            kind: "text",
            status: ok ? "sent" : "failed",
            clientId,
            waMessageId,
            sessionName: session.name,
            createdAt: now,
          });
        }

        if (ok) {
          await ctx.db.patch(sessionId, {
            messagesSent:
              Number(session.messagesSent ?? 0) + (existing !== null ? 0 : 1),
            lastSeenAt: now,
          });
          await log(
            ctx,
            sessionId,
            "command",
            `[baileys] sendMessage → ${jid.split("@")[0]} (${waMessageId ?? "no id"})`,
          );
        } else {
          await log(
            ctx,
            sessionId,
            "error",
            `[baileys] sendMessage failed → ${jid.split("@")[0]}: ${
              String(data.error ?? "unknown error")
            }`,
          );
        }
        break;
      }

      case "message.receipt.update": {
        const jid = String(data.jid ?? "");
        const raw = String(data.status ?? "delivered");
        const status = (RECEIPT_STATUSES as readonly string[]).includes(raw)
          ? (raw as (typeof RECEIPT_STATUSES)[number])
          : "delivered";

        const rows = (await ctx.db
          .query("waMessages")
          .withIndex("by_session", (q: Q) => q.eq("sessionId", sessionId))
          .collect()) as Row[];
        const candidates = rows
          .filter((m) => m.direction === "outbound" && (!jid || m.jid === jid))
          .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
        const target = candidates[0];
        if (target) await ctx.db.patch(target._id, { status });

        await log(
          ctx,
          sessionId,
          "debug",
          `[message.receipt.update] ${jid.split("@")[0] || "batch"} → ${status}`,
        );
        deliveries.push(
          ...(await deliveriesFor(ctx, session, "message.receipt.update", {
            jid: jid || null,
            status,
          })),
        );
        break;
      }

      case "meters": {
        const cpu = typeof data.cpu === "number" ? Math.round(data.cpu) : undefined;
        const memoryMb =
          typeof data.memoryMb === "number" ? Math.round(data.memoryMb) : undefined;
        await ctx.db.patch(sessionId, {
          cpu: cpu === undefined ? session.cpu : Math.max(0, Math.min(100, cpu)),
          memoryMb:
            memoryMb === undefined ? session.memoryMb : Math.max(0, memoryMb),
          lastSeenAt: now,
        });
        break;
      }

      case "power": {
        const state = String(data.state ?? "");
        const reason = data.reason ? String(data.reason) : undefined;
        const pid = typeof data.pid === "number" ? data.pid : undefined;

        if (state === "running") {
          await ctx.db.patch(sessionId, {
            power: "running",
            workerState: session.status === "connected" ? "live" : "starting",
            pid,
            lastExit: undefined,
            lastSeenAt: now,
          });
          await log(ctx, sessionId, "info", `[wings] agent holding socket (pid ${pid ?? "?"})`);
        } else if (state === "stopped") {
          await ctx.db.patch(sessionId, {
            power: "stopped",
            desiredPower: "stopped",
            status: "disconnected",
            workerState: "stopped",
            qrPayload: undefined,
            pairingCode: undefined,
            pairingExpiresAt: undefined,
            cpu: 0,
            memoryMb: 0,
            pid,
            lastExit: reason ?? "stopped",
            lastSeenAt: now,
            statusChangedAt: now,
          });
          await log(
            ctx,
            sessionId,
            "warn",
            `[wings] power → stopped (${reason ?? "operator"}) — creds kept`,
          );
        } else if (state === "crashed") {
          await ctx.db.patch(sessionId, {
            power: "stopped",
            status: "disconnected",
            workerState: "crashed",
            qrPayload: undefined,
            pairingCode: undefined,
            pairingExpiresAt: undefined,
            cpu: 0,
            memoryMb: 0,
            pid,
            lastExit: reason ?? "crashed",
            lastSeenAt: now,
            statusChangedAt: now,
          });
          await log(
            ctx,
            sessionId,
            "error",
            `[wings] the runtime exited — ${reason ?? "unknown reason"}`,
          );
        }
        break;
      }

      case "install": {
        const status = String(data.status ?? "installing");
        const line = typeof data.line === "string" ? data.line : undefined;
        const rawInstallId = typeof data.installId === "string" ? data.installId : undefined;

        if (rawInstallId) {
          const install = await ctx.db.get(
            rawInstallId as GenericId<"sessionInstalls">,
          );
          if (install !== null) {
            const lines = [...install.log];
            if (line) lines.push(line);
            const patch: Row = { log: lines };
            if (status === "installed" || status === "failed") {
              patch.status = status;
              patch.completedAt = now;
            } else {
              patch.status = "installing";
            }
            await ctx.db.patch(install._id, patch);
          }
        }

        if (line) await log(ctx, sessionId, "debug", `[wings] ${line}`);

        if (status === "installed") {
          await ctx.db.patch(sessionId, {
            installState: "installed",
            startup:
              typeof data.startup === "string" && data.startup
                ? data.startup
                : session.startup,
            image:
              typeof data.image === "string" && data.image ? data.image : session.image,
            lastSeenAt: now,
          });
          await log(
            ctx,
            sessionId,
            "success",
            `[wings] install complete — ${String(data.eggName ?? session.name)} ready`,
          );
        } else if (status === "failed") {
          await ctx.db.patch(sessionId, {
            installState: "failed",
            lastSeenAt: now,
          });
          await log(
            ctx,
            sessionId,
            "error",
            `[wings] install failed — ${line ?? String(data.reason ?? "the install script errored")}`,
          );
        }
        break;
      }

      case "log": {
        const level = (LOG_LEVELS as readonly string[]).includes(String(data.level))
          ? (String(data.level) as (typeof LOG_LEVELS)[number])
          : "info";
        const message = String(data.message ?? "");
        if (message) await log(ctx, sessionId, level, message);
        break;
      }

      default: {
        await log(ctx, sessionId, "debug", `[runtime] ${args.event} ${JSON.stringify(data)}`);
        break;
      }
    }

    return { ok: true, deliveries };
  }
}

export const applyEvent = mutation({
  args: {
    token: v.string(),
    uuid: v.optional(v.string()),
    event: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => await applyEventImpl(ctx, args),
});

/** Write down what each webhook delivery actually did. */
export const recordDeliveries = mutation({
  args: {
    token: v.string(),
    results: v.array(
      v.object({
        webhookId: v.optional(v.id("webhooks")),
        ownerId: v.id("users"),
        sessionId: v.optional(v.id("waSessions")),
        event: v.string(),
        url: v.string(),
        ok: v.boolean(),
        statusCode: v.optional(v.number()),
        detail: v.optional(v.string()),
        durationMs: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await nodeOrThrow(ctx, args.token);
    const now = Date.now();

    for (const result of args.results) {
      await ctx.db.insert("webhookDeliveries", {
        webhookId: result.webhookId,
        ownerId: result.ownerId,
        sessionId: result.sessionId,
        event: result.event,
        url: result.url,
        ok: result.ok,
        statusCode: result.statusCode,
        detail: result.detail,
        durationMs: result.durationMs,
        createdAt: now,
      });

      if (result.webhookId) {
        const hook = await ctx.db.get(result.webhookId);
        if (hook !== null) {
          await ctx.db.patch(hook._id, {
            deliveries: hook.deliveries + 1,
            failures: hook.failures + (result.ok ? 0 : 1),
            lastStatus: result.statusCode,
            lastDeliveredAt: now,
          });
        }
      }
    }

    return { ok: true, written: args.results.length };
  },
});

/* ------------------------------------------------------------------ */
/* What the panel reads                                               */
/* ------------------------------------------------------------------ */

/** Agents holding nodes this operator has servers on. */
export const listWorkers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const mine = await ctx.db
      .query("waSessions")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const nodeIds = new Set(mine.map((s) => s.nodeId).filter(Boolean));

    const workers = await ctx.db.query("workers").collect();
    const nodes = await ctx.db.query("nodes").collect();
    const cutoff = Date.now() - AGENT_TIMEOUT_MS;

    return workers
      .filter((w) => nodeIds.has(w.nodeId))
      .map((w) => {
        const node = nodes.find((n) => n._id === w.nodeId);
        return {
          _id: String(w._id),
          name: String(w.name),
          version: String(w.version),
          sessions: Number(w.sessions ?? 0),
          pid: w.pid === undefined ? undefined : Number(w.pid),
          nodeId: String(w.nodeId),
          nodeName: node ? String(node.name) : undefined,
          nodeSlug: node ? String(node.id) : undefined,
          online: Number(w.lastSeenAt) > cutoff,
          lastSeenAt: Number(w.lastSeenAt),
        };
      })
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  },
});

/** The command queue for one server, newest first — the console's paper trail. */
export const listCommands = query({
  args: { sessionId: v.id("waSessions"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return [];

    const rows = await ctx.db
      .query("runtimeCommands")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.min(args.limit ?? 8, 25));
  },
});

/** One endpoint, for the console's test-send button. */
export const webhookForTest = query({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const hook = await ctx.db.get(args.webhookId);
    if (hook === null || hook.ownerId !== userId) return null;
    return { _id: hook._id, url: hook.url, ownerId: hook.ownerId, events: hook.events };
  },
});
