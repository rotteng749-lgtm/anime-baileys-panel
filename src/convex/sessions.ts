import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { GenericId } from "convex/values";
import { makeUuid } from "./infrastructure";
import type { PairMethod } from "./schema";

/**
 * Session control plane.
 *
 * Mirrors the surface of a real `@whiskeysockets/baileys` socket — the pairing
 * handshake, the connection lifecycle and the `messages.upsert` stream — so a
 * session behaves, from the panel's point of view, like a linked device.
 *
 * Types are derived from the schema directly rather than from the generated
 * `Doc`/`Id` helpers, which keeps this module portable across Convex versions.
 */

/**
 * Resolve the signed-in user, or throw. Every session in this app is scoped to
 * a single account, so this is the gate for all reads and writes.
 */
async function requireUserId(
  ctx: Parameters<typeof getAuthUserId>[0],
): Promise<NonNullable<ReturnType<typeof getAuthUserId>> extends Promise<
  infer T
>
  ? NonNullable<T>
  : never> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  return userId;
}

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("waSessions")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .order("desc")
      .collect();
  },
});

export const getSession = query({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return null;
    return session;
  },
});

export const sessionLogs = query({
  args: {
    sessionId: v.id("waSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return [];
    const rows = await ctx.db
      .query("sessionLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(Math.min(args.limit ?? 150, 400));
    return rows.reverse();
  },
});

/**
 * Append one line to a session console.
 *
 * The wings runner reports back this way: the script is executed in the sandbox
 * and the panel writes the outcome here, so a run shows up in the same stream as
 * the socket's own logs.
 */
export const appendLog = mutation({
  args: {
    sessionId: v.id("waSessions"),
    level: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warn"),
      v.literal("error"),
      v.literal("debug"),
      v.literal("command"),
    ),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to write to the console");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("That session is not yours");
    }
    await ctx.db.insert("sessionLogs", {
      sessionId: args.sessionId,
      level: args.level,
      message: args.message.slice(0, 500),
      createdAt: Date.now(),
    });
  },
});

export const sessionMessages = query({
  args: {
    sessionId: v.id("waSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return [];
    return await ctx.db
      .query("waMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(Math.min(args.limit ?? 60, 200));
  },
});

/** Recent traffic across every session the user owns. */
export const recentMessages = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const sessions = await ctx.db
      .query("waSessions")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const names = new Map(sessions.map((s) => [s._id as string, s.name]));
    const rows = await ctx.db
      .query("waMessages")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(args.limit ?? 40, 200));
    return rows
      .filter((m) => names.has(m.sessionId))
      .map((m) => ({ ...m, sessionName: names.get(m.sessionId)! }));
  },
});

/** Rolling 24h activity buckets + lifetime totals for the overview. */
export const activity = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        buckets: [] as Array<{ t: number; inbound: number; outbound: number }>,
        totals: { sent: 0, received: 0, sessions: 0, online: 0 },
      };
    }
    const sessions = await ctx.db
      .query("waSessions")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const mine = new Set(sessions.map((s) => s._id as string));

    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    const step = windowMs / 24;
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      t: now - (23 - i) * step,
      inbound: 0,
      outbound: 0,
    }));

    const rows = await ctx.db
      .query("waMessages")
      .withIndex("by_created")
      .order("desc")
      .take(600);
    for (const m of rows) {
      if (!mine.has(m.sessionId)) continue;
      if (now - m.createdAt > windowMs) continue;
      const idx = Math.min(
        23,
        Math.max(0, Math.floor((m.createdAt - (now - windowMs)) / step)),
      );
      if (m.direction === "inbound") buckets[idx].inbound += 1;
      else buckets[idx].outbound += 1;
    }

    let sent = 0;
    let received = 0;
    for (const s of sessions) {
      sent += s.messagesSent;
      received += s.messagesReceived;
    }
    return {
      buckets,
      totals: {
        sent,
        received,
        sessions: sessions.length,
        online: sessions.filter((s) => s.status === "connected").length,
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/* Session lifecycle mutations                                        */
/* ------------------------------------------------------------------ */

export const createSession = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    pairMethod: v.union(v.literal("qr"), v.literal("code")),
    memory: v.optional(v.number()),
    disk: v.optional(v.number()),
    cpuMilli: v.optional(v.number()),
    swap: v.optional(v.number()),
    io: v.optional(v.number()),
    eggSlug: v.optional(v.string()),
    nodeId: v.optional(v.id("nodes")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    // The node and allocation are chosen the way a hosting panel chooses them:
    // a free ip:port on a machine that has room, claimed before the server
    // row exists so nothing races for it.
    const nodes = await ctx.db.query("nodes").collect();
    const node =
      args.nodeId !== undefined
        ? nodes.find((n) => n._id === args.nodeId)
        : nodes[0];

    let allocationId: GenericId<"allocations"> | undefined;
    if (node) {
      const free = await ctx.db
        .query("allocations")
        .withIndex("by_node", (q) => q.eq("nodeId", node._id))
        .collect();
      const allocation = free.find((a) => !a.assigned);
      if (allocation) {
        allocationId = allocation._id;
        await ctx.db.patch(allocation._id, {
          assigned: true,
          sessionId: undefined,
        });
      }
    }

    const eggSlug = args.eggSlug;
    const egg = eggSlug
      ? await ctx.db
          .query("eggs")
          .withIndex("by_slug", (q) => q.eq("slug", eggSlug))
          .unique()
      : null;

    const uuid = makeUuid();
    const sessionId = await ctx.db.insert("waSessions", {
      ownerId: userId,
      name: args.name,
      status: "disconnected",
      pairMethod: args.pairMethod,
      phone: args.phone,
      cpu: 0,
      memoryMb: 0,
      messagesSent: 0,
      messagesReceived: 0,

      uuid,
      uuidShort: uuid.slice(0, 8),
      nodeId: node?._id,
      allocationId,
      nestId: egg?.nestId,
      eggId: egg?._id,
      memory: args.memory ?? 512,
      swap: args.swap ?? 0,
      disk: args.disk ?? 2048,
      io: args.io ?? 500,
      cpuMilli: args.cpuMilli ?? 500,
      startup: egg?.startup,
      image: egg?.image,
      power: "stopped",
      installState: egg ? "installing" : "installed",

      createdAt: now,
      lastSeenAt: now,
      statusChangedAt: now,
    });

    if (allocationId) {
      await ctx.db.patch(allocationId, { sessionId });
    }

    await ctx.db.insert("sessionLogs", {
      sessionId,
      level: "info",
      message: `[panel] server created — ${args.name} (${uuid.slice(0, 8)}) on ${
        node?.name ?? "the local node"
      }`,
      createdAt: now,
    });
    if (node) {
      await ctx.db.insert("sessionLogs", {
        sessionId,
        level: "debug",
        message: `[wings] POST /api/servers → volume /var/lib/baileys/volumes/${uuid}`,
        createdAt: now,
      });
    }
    if (egg) {
      await ctx.db.insert("sessionLogs", {
        sessionId,
        level: "info",
        message: `[wings] pulling image ${egg.image ?? egg.runtime}, running install script`,
        createdAt: now,
      });
    }
    return sessionId;
  },
});

/* ------------------------------------------------------------------ */
/* Power                                                              */
/* ------------------------------------------------------------------ */

/**
 * Power actions, in the four verbs a hosting panel uses.
 *
 * The panel sends the verb, wings translates it to whatever stops the agent —
 * for us that is the socket lifecycle, not Docker:
 *
 *   start   → bring the socket up and walk the pairing handshake
 *   stop    → SIGTERM: close cleanly, keep the creds on disk
 *   restart → stop, then start
 *   kill    → SIGKILL: drop the socket now, no flush, no goodbye
 */
export const powerAction = mutation({
  args: {
    sessionId: v.id("waSessions"),
    action: v.union(
      v.literal("start"),
      v.literal("stop"),
      v.literal("restart"),
      v.literal("kill"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    if (session.suspended) throw new Error("This server is suspended");

    const now = Date.now();
    const say = async (level: "info" | "warn" | "command", message: string) =>
      ctx.db.insert("sessionLogs", {
        sessionId: session._id,
        level,
        message,
        createdAt: Date.now(),
      });

    const start = async () => {
      if (session.status === "connected") {
        await say("warn", `[wings] start ignored — already running`);
        return;
      }
      await ctx.db.patch(session._id, {
        status: "awaiting_pairing",
        power: "running",
        lastSeenAt: now,
        statusChangedAt: now,
      });
      await say("command", `[wings] POST /api/servers/${session.uuid ?? session._id}/power → start`);
      await say("info", `[baileys] connecting to wss://web.whatsapp.com/ws/chat`);
    };

    const stop = async (reason: string, level: "warn" | "command") => {
      if (session.status === "disconnected" && session.power === "stopped") {
        await say("warn", `[wings] stop ignored — already stopped`);
        return;
      }
      await ctx.db.patch(session._id, {
        status: "disconnected",
        power: "stopped",
        jid: undefined,
        pushName: undefined,
        qrPayload: undefined,
        pairingCode: undefined,
        pairingExpiresAt: undefined,
        cpu: 0,
        memoryMb: 0,
        lastSeenAt: now,
        statusChangedAt: now,
      });
      await say(level, `[wings] power → stop (${reason})`);
      await say("warn", `[baileys] connection closed — ${reason}`);
    };

    if (args.action === "start") {
      await start();
    } else if (args.action === "stop") {
      await stop("stopped by operator", "command");
    } else if (args.action === "kill") {
      await stop("killed — no flush", "command");
      await ctx.db.patch(session._id, { jid: undefined });
    } else {
      await stop("restarting", "command");
      await start();
    }
  },
});

export const renameSession = mutation({
  args: { sessionId: v.id("waSessions"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    await ctx.db.patch(session._id, { name: args.name });
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }

    // Free the allocation before the row goes, the way a panel releases the
    // ip:port when a server is deleted.
    if (session.allocationId) {
      await ctx.db.patch(session.allocationId, {
        assigned: false,
        sessionId: undefined,
      });
    }

    const logs = await ctx.db
      .query("sessionLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    const msgs = await ctx.db
      .query("waMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const l of logs) await ctx.db.delete(l._id);
    for (const m of msgs) await ctx.db.delete(m._id);
    await ctx.db.delete(session._id);
  },
});

export const suspendSession = mutation({
  args: { sessionId: v.id("waSessions"), suspended: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    await ctx.db.patch(session._id, { suspended: args.suspended });
    await ctx.db.insert("sessionLogs", {
      sessionId: session._id,
      level: args.suspended ? "warn" : "info",
      message: `[panel] server ${args.suspended ? "suspended" : "unsuspended"}`,
      createdAt: Date.now(),
    });
  },
});

/** The server object, joined to its node and allocation for the detail view. */
export const serverDetail = query({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return null;

    const node = session.nodeId ? await ctx.db.get(session.nodeId) : null;
    const allocation = session.allocationId
      ? await ctx.db.get(session.allocationId)
      : null;
    const nest = session.nestId ? await ctx.db.get(session.nestId) : null;
    const egg = session.eggId ? await ctx.db.get(session.eggId) : null;
    const installs = await ctx.db
      .query("sessionInstalls")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();

    return {
      ...session,
      node: node
        ? {
            _id: node._id,
            id: node.id,
            name: node.name,
            location: node.location,
            fqdn: node.fqdn,
            scheme: node.scheme,
            online: node.online,
            daemonVersion: node.daemonVersion,
          }
        : null,
      allocation: allocation
        ? { _id: allocation._id, ip: allocation.ip, port: allocation.port }
        : null,
      nest: nest ? { _id: nest._id, name: nest.name, slug: nest.slug } : null,
      egg: egg
        ? { _id: egg._id, name: egg.name, slug: egg.slug, image: egg.image }
        : null,
      installs: installs.reverse(),
    };
  },
});

/** The panel API, the way a hosting panel answers a bearer request. */
export const listServers = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("waSessions").collect();
    return sessions.map((s) => ({
      uuid: s.uuid,
      uuidShort: s.uuidShort,
      name: s.name,
      ownerId: s.ownerId,
      nodeId: s.nodeId,
      allocationId: s.allocationId,
      nestId: s.nestId,
      eggId: s.eggId,
      memory: s.memory,
      swap: s.swap,
      disk: s.disk,
      io: s.io,
      cpu: s.cpuMilli,
      startup: s.startup,
      image: s.image,
      skipScripts: s.skipScripts,
      power: s.power,
      suspended: s.suspended,
      status: s.status,
      jid: s.jid,
      createdAt: s.createdAt,
    }));
  },
});


export const updateConfig = mutation({
  args: {
    sessionId: v.id("waSessions"),
    autoReply: v.optional(v.boolean()),
    prefix: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
    pairMethod: v.optional(v.union(v.literal("qr"), v.literal("code"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    const patch: {
      autoReply?: boolean;
      prefix?: string;
      webhookUrl?: string;
      pairMethod?: PairMethod;
    } = {};
    if (args.autoReply !== undefined) patch.autoReply = args.autoReply;
    if (args.prefix !== undefined) patch.prefix = args.prefix;
    if (args.webhookUrl !== undefined) patch.webhookUrl = args.webhookUrl;
    if (args.pairMethod !== undefined) patch.pairMethod = args.pairMethod;
    await ctx.db.patch(session._id, patch);
    await ctx.db.insert("sessionLogs", {
      sessionId: session._id,
      level: "debug",
      message: `[kaizen] config updated: ${Object.keys(patch).join(", ") || "noop"}`,
      createdAt: Date.now(),
    });
  },
});

/** Tear the socket down and drop the stored creds. */
export const disconnectSession = mutation({
  args: { sessionId: v.id("waSessions"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "disconnected",
      jid: undefined,
      pushName: undefined,
      qrPayload: undefined,
      pairingCode: undefined,
      pairingExpiresAt: undefined,
      cpu: 0,
      memoryMb: 0,
      lastSeenAt: now,
      statusChangedAt: now,
    });
    await ctx.db.insert("sessionLogs", {
      sessionId: session._id,
      level: "warn",
      message: `[baileys] connection closed — ${args.reason ?? "stopped by operator"}`,
      createdAt: now,
    });
  },
});
