import type { HttpRouter } from "convex/server";
import { v } from "convex/values";
import type { GenericId } from "convex/values";
import { query, mutation } from "./_generated/server";
import { makeUuid } from "./infrastructure";
import { normalisePath } from "./eggs";

/**
 * The wings API.
 *
 * The panel talks to a node's daemon over HTTPS with a bearer token, never to
 * the socket directly. This is that contract, kept deliberately close to the
 * shape a hosting panel uses so anything written against it reads the same:
 *
 *   POST   /api/servers                  create
 *   GET    /api/servers                  list this node's servers
 *   GET    /api/servers/:uuid            status
 *   POST   /api/servers/:uuid/power      start | stop | restart | kill
 *   GET    /api/servers/:uuid/files      list the volume, or read one file
 *   PUT    /api/servers/:uuid/files      write one file
 *   POST   /api/servers/:uuid/install    lay an egg down and run its install
 *   POST   /api/nodes/:id/ping           heartbeat
 *
 * Auth is `Authorization: Bearer <wings token>`. The token belongs to a node,
 * and a node only ever reaches its own servers — which is the whole point of
 * having allocations.
 */

/** The slice of context the wings handlers use. Loosely typed on purpose. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WingsCtx = any;

type Row = Record<string, unknown>;

/** The index builder as this module uses it: one `eq` per indexed column. */
type Q = { eq: (field: string, value: unknown) => Q } & Record<string, unknown>;

type Handler = (ctx: WingsCtx, request: Request) => Promise<Response>;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const MAX_FILE_BYTES = 512 * 1024;

/**
 * The `_id` of a row resolved through a loose helper, as a branded id.
 *
 * The shared helpers above work with a loose context on purpose; these are the
 * two places that hand their results back to Convex's typed database calls.
 */
function sid(row: Row): GenericId<"waSessions"> {
  return row._id as GenericId<"waSessions">;
}

function nid(row: Row): GenericId<"nodes"> {
  return row._id as GenericId<"nodes">;
}

const POWER = ["start", "stop", "restart", "kill"] as const;

/* ------------------------------------------------------------------ */
/* Plumbing                                                           */
/* ------------------------------------------------------------------ */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

async function digest(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Resolve the node behind a request, or answer 401.
 *
 * Returning the `Response` rather than a union is what keeps every handler's
 * return type honest.
 */
async function requireNode(
  ctx: WingsCtx,
  request: Request,
): Promise<Row | Response> {
  const token = bearer(request);
  if (!token) return json({ error: "missing bearer token" }, 401);

  const node = await nodeForToken(ctx, token);
  if (node === null) return json({ error: "bad token" }, 401);
  return node;
}

/** The node a wings token belongs to, or null. */async function nodeForToken(ctx: WingsCtx, token: string) {
  const tokenHash = await digest(token);
  const node = await ctx.db
    .query("nodes")
    .withIndex("by_token", (q: { eq: (f: "tokenHash", v: string) => unknown }) =>
      q.eq("tokenHash", tokenHash),
    )
    .unique();
  return node === null ? null : (node as Row);
}

/** Same guard, for the Convex-function form of the API. */
async function nodeOrThrow(ctx: WingsCtx, token: string) {
  if (!token) throw new Error("missing bearer token");
  const node = await nodeForToken(ctx, token);
  if (node === null) throw new Error("bad token");
  return node;
}

/** The server object, in the shape the wings API hands back. */
function serverView(s: Row) {
  return {
    uuid: s.uuid,
    uuid_short: s.uuidShort,
    name: s.name,
    owner_id: s.ownerId,
    node_id: s.nodeId,
    allocation_id: s.allocationId,
    nest_id: s.nestId,
    egg_id: s.eggId,
    memory: s.memory,
    swap: s.swap,
    disk: s.disk,
    io: s.io,
    cpu: s.cpuMilli,
    startup: s.startup,
    image: s.image,
    skip_scripts: s.skipScripts ?? false,
    power: s.power ?? "stopped",
    suspended: s.suspended ?? false,
    status: s.status,
    jid: s.jid ?? null,
    state: s.installState ?? "installed",
    limits: {
      memory: s.memory,
      swap: s.swap,
      disk: s.disk,
      io: s.io,
      cpu: s.cpuMilli,
    },
    created_at: s.createdAt,
  };
}

async function log(
  ctx: WingsCtx,
  sessionId: unknown,
  level: string,
  message: string,
) {
  await ctx.db.insert("sessionLogs", {
    sessionId,
    level,
    message,
    createdAt: Date.now(),
  });
}

async function byUuid(ctx: WingsCtx, uuid: string, nodeId: unknown) {
  if (!uuid) return null;
  const session = await ctx.db
    .query("waSessions")
    .withIndex("by_uuid", (q: Q) => q.eq("uuid", uuid))
    .unique();
  if (session === null || session.nodeId !== nodeId) return null;
  return session as Row;
}

async function readFile(ctx: WingsCtx, sessionId: unknown, path: string) {
  const clean = normalisePath(path);
  if (!clean) return null;
  return await ctx.db
    .query("sessionFiles")
    .withIndex("by_session_path", (q: Q) =>
      q.eq("sessionId", sessionId).eq("path", clean),
    )
    .unique();
}

async function writeFile(
  ctx: WingsCtx,
  sessionId: unknown,
  path: string,
  contents: string,
) {
  const existing = await readFile(ctx, sessionId, path);
  if (existing) {
    await ctx.db.patch(existing._id, {
      contents,
      isDir: false,
      size: contents.length,
      updatedAt: Date.now(),
    });
    return;
  }
  await ctx.db.insert("sessionFiles", {
    sessionId,
    path,
    contents,
    isDir: false,
    size: contents.length,
    updatedAt: Date.now(),
  });
}

/* ------------------------------------------------------------------ */
/* The same contract, as Convex functions                             */
/* ------------------------------------------------------------------ */

/**
 * The wings API has two doors.
 *
 * The HTTP routes above are the real one — a node's daemon speaks HTTPS with
 * a bearer token. Not every deployment routes custom paths, so the same
 * operations are also exposed as Convex functions taking the same token and
 * returning the same shapes. A node that cannot reach `/api/servers` can call
 * `api.wingsApi.*` instead, and nothing about the contract changes.
 */

export const apiListServers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const node = await nodeOrThrow(ctx, args.token);
    const sessions = await ctx.db.query("waSessions").collect();
    return sessions
      .filter((s) => s.nodeId === node._id)
      .map((s) => serverView(s as unknown as Row));
  },
});

export const apiGetServer = query({
  args: { token: v.string(), uuid: v.string() },
  handler: async (ctx, args) => {
    const node = await nodeOrThrow(ctx, args.token);
    const session = await byUuid(ctx, args.uuid, node._id);
    if (session === null) throw new Error("not found");
    return serverView(session);
  },
});

export const apiPower = mutation({
  args: {
    token: v.string(),
    uuid: v.string(),
    action: v.union(
      v.literal("start"),
      v.literal("stop"),
      v.literal("restart"),
      v.literal("kill"),
    ),
  },
  handler: async (ctx, args) => {
    const node = await nodeOrThrow(ctx, args.token);
    const session = await byUuid(ctx, args.uuid, node._id);
    if (session === null) throw new Error("not found");
    if (session.suspended) throw new Error("server is suspended");

    const now = Date.now();
    if (args.action === "start") {
      await ctx.db.patch(sid(session), {
        status: "awaiting_pairing",
        power: "running",
        lastSeenAt: now,
        statusChangedAt: now,
      });
      await log(ctx, sid(session), "command", `[wings] power → start`);
      await log(
        ctx,
        sid(session),
        "info",
        `[baileys] connecting to wss://web.whatsapp.com/ws/chat`,
      );
    } else {
      await ctx.db.patch(sid(session), {
        status: "disconnected",
        power: "stopped",
        jid: undefined,
        qrPayload: undefined,
        cpu: 0,
        memoryMb: 0,
        lastSeenAt: now,
        statusChangedAt: now,
      });
      await log(
        ctx,
        sid(session),
        "command",
        args.action === "kill"
          ? "[wings] power → kill (SIGKILL, no flush)"
          : `[wings] power → ${args.action}`,
      );
      if (args.action === "restart") {
        await ctx.db.patch(sid(session), {
          status: "awaiting_pairing",
          power: "running",
          statusChangedAt: now,
        });
        await log(
          ctx,
          sid(session),
          "info",
          `[baileys] reconnecting after restart`,
        );
      }
    }
    return { action: args.action, accepted: true };
  },
});

export const apiListFiles = query({
  args: { token: v.string(), uuid: v.string() },
  handler: async (ctx, args) => {
    const node = await nodeOrThrow(ctx, args.token);
    const session = await byUuid(ctx, args.uuid, node._id);
    if (session === null) throw new Error("not found");
    const rows = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session", (q) => q.eq("sessionId", sid(session)))
      .collect();
    return rows.map((f) => ({
      name: f.path,
      size: f.size,
      is_dir: f.isDir,
      modified_at: f.updatedAt,
    }));
  },
});

export const apiReadFile = query({
  args: { token: v.string(), uuid: v.string(), path: v.string() },
  handler: async (ctx, args) => {
    const node = await nodeOrThrow(ctx, args.token);
    const session = await byUuid(ctx, args.uuid, node._id);
    if (session === null) throw new Error("not found");
    const file = await readFile(ctx, sid(session), args.path);
    if (file === null) throw new Error("no such file");
    return { path: file.path, contents: file.contents };
  },
});

export const apiWriteFile = mutation({
  args: {
    token: v.string(),
    uuid: v.string(),
    path: v.string(),
    contents: v.string(),
  },
  handler: async (ctx, args) => {
    const node = await nodeOrThrow(ctx, args.token);
    const session = await byUuid(ctx, args.uuid, node._id);
    if (session === null) throw new Error("not found");
    if (args.contents.length > MAX_FILE_BYTES) {
      throw new Error("file over 512 KB");
    }
    const clean = normalisePath(args.path);
    if (!clean) throw new Error("bad path");

    await writeFile(ctx, sid(session), clean, args.contents);
    await log(
      ctx,
      sid(session),
      "debug",
      `[wings] wrote ${clean} (${args.contents.length} B)`,
    );
    return { path: clean, size: args.contents.length };
  },
});

export const apiInstall = mutation({
  args: {
    token: v.string(),
    uuid: v.string(),
    eggSlug: v.string(),
    variables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const node = await nodeOrThrow(ctx, args.token);
    const session = await byUuid(ctx, args.uuid, node._id);
    if (session === null) throw new Error("not found");
    if (session.status === "connected") {
      throw new Error("stop the server before installing");
    }

    const egg = await ctx.db
      .query("eggs")
      .withIndex("by_slug", (q) => q.eq("slug", args.eggSlug))
      .unique();
    if (egg === null) throw new Error("unknown egg");
    if (egg.status !== "published") throw new Error("egg is not published");

    const files = await ctx.db
      .query("eggFiles")
      .withIndex("by_egg", (q) => q.eq("eggId", egg._id))
      .collect();
    for (const file of files) {
      const clean = normalisePath(file.path);
      if (clean) await writeFile(ctx, sid(session), clean, file.contents);
    }

    await ctx.db.patch(sid(session), {
      eggId: egg._id,
      nestId: egg.nestId,
      startup: egg.startup,
      image: egg.image,
      installState: "installing",
    });

    const installId = await ctx.db.insert("sessionInstalls", {
      sessionId: sid(session),
      eggId: egg._id,
      eggName: egg.name,
      runtime: egg.runtime,
      startup: egg.startup,
      variables: args.variables ?? egg.env ?? [],
      status: "queued",
      log: [`queued ${egg.name} on ${egg.runtime}`],
      createdAt: Date.now(),
    });
    await ctx.db.patch(egg._id, { installs: egg.installs + 1 });
    await log(
      ctx,
      sid(session),
      "info",
      `[wings] install queued — ${egg.name} (${egg.runtime})`,
    );
    return { install: installId, files: files.length };
  },
});

export const apiPing = mutation({
  args: { token: v.string(), nodeId: v.string() },
  handler: async (ctx, args) => {
    const node = await nodeOrThrow(ctx, args.token);
    if (String(node.id) !== args.nodeId) {
      throw new Error("that is not your node");
    }
    await ctx.db.patch(nid(node), {
      online: true,
      lastSeenAt: Date.now(),
    });
    return { ok: true, node: node.id, daemon: node.daemonVersion };
  },
});

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

/**
 * Register one route.
 *
 * Convex's own `RouteSpec` is typed against a full action context, while these
 * handlers deliberately work with a loose one — the same guard is shared by all
 * of them. The cast is confined to this one call so the handlers stay readable.
 */
function route(
  router: HttpRouter,
  path: string,
  method: Method,
  handler: Handler,
) {
  router.route({ path, method, handler: handler as never });
}

export function addWingsRoutes(router: HttpRouter) {
  /* ---- list ---- */

  route(router, "/api/servers", "GET", async (ctx, request) => {
    const node = await requireNode(ctx, request);
    if (node instanceof Response) return node;
    const sessions = await ctx.db.query("waSessions").collect();
    return json(
      sessions
        .filter((s: Row) => s.nodeId === node._id)
        .map((s: Row) => serverView(s)),
    );
  });

  /* ---- create ---- */

  route(router, "/api/servers", "POST", async (ctx, request) => {
    const node = await requireNode(ctx, request);
    if (node instanceof Response) return node;

    const body = (await request.json().catch(() => ({}))) as Row;
    const ownerId = body.owner_id as string | undefined;
    if (!ownerId) return json({ error: "owner_id is required" }, 400);

    // The node that answered owns the server. That is the allocation promise:
    // an ip:port on this machine, claimed before the row exists.
    const free = await ctx.db
      .query("allocations")
      .withIndex("by_node", (q: Q) => q.eq("nodeId", node._id))
      .collect();
    const allocation = (free as Row[]).find((a) => !a.assigned);
    if (!allocation) return json({ error: "no free allocations" }, 409);

    const limits = (body.limits ?? {}) as Row;
    const uuid = body.uuid ? String(body.uuid) : makeUuid();
    const now = Date.now();

    const sessionId = await ctx.db.insert("waSessions", {
      ownerId,
      name: String(body.name ?? "server").slice(0, 64),
      status: "disconnected",
      pairMethod: "qr",
      cpu: 0,
      memoryMb: 0,
      messagesSent: 0,
      messagesReceived: 0,
      uuid,
      uuidShort: uuid.slice(0, 8),
      nodeId: node._id,
      allocationId: allocation._id,
      nestId: body.nest_id,
      eggId: body.egg_id,
      memory: (limits.memory as number) ?? 512,
      swap: (limits.swap as number) ?? 0,
      disk: (limits.disk as number) ?? 2048,
      io: (limits.io as number) ?? 500,
      cpuMilli: (limits.cpu as number) ?? 500,
      startup: body.startup ? String(body.startup) : undefined,
      image: body.image ? String(body.image) : undefined,
      skipScripts: Boolean(body.skip_scripts),
      power: "stopped",
      installState: body.skip_scripts ? "installed" : "installing",
      createdAt: now,
      lastSeenAt: now,
      statusChangedAt: now,
    });

    await ctx.db.patch(allocation._id, { assigned: true, sessionId });

    // Exactly the transcript a real node writes when it takes a server.
    await log(
      ctx,
      sessionId,
      "info",
      `[wings] server received — volume /var/lib/baileys/volumes/${uuid}`,
    );
    await log(
      ctx,
      sessionId,
      "info",
      `[wings] allocation ${allocation.ip}:${allocation.port} bound`,
    );
    if (body.image) {
      await log(ctx, sessionId, "info", `[wings] pulling image ${body.image}`);
    }
    if (!body.skip_scripts) {
      await log(ctx, sessionId, "info", `[wings] install script queued`);
    }

    const session = await ctx.db.get(sessionId);
    return json(serverView(session as Row), 201);
  });

  /* ---- status ---- */

  route(router, "/api/servers/:uuid", "GET", async (ctx, request) => {
    const node = await requireNode(ctx, request);
    if (node instanceof Response) return node;
    const session = await byUuid(ctx, String(ctx.params.uuid), node._id);
    if (session === null) return json({ error: "not found" }, 404);
    return json(serverView(session));
  });

  /* ---- power ---- */

  route(
    router,
    "/api/servers/:uuid/power",
    "POST",
    async (ctx, request) => {
      const node = await requireNode(ctx, request);
      if (node instanceof Response) return node;
      const session = await byUuid(ctx, String(ctx.params.uuid), node._id);
      if (session === null) return json({ error: "not found" }, 404);
      if (session.suspended) {
        return json({ error: "server is suspended" }, 409);
      }

      const body = (await request.json().catch(() => ({}))) as Row;
      const action = String(body.action ?? "");
      if (!POWER.includes(action as (typeof POWER)[number])) {
        return json(
          { error: `action must be one of ${POWER.join(", ")}` },
          400,
        );
      }

      const now = Date.now();
      if (action === "start") {
        await ctx.db.patch(session._id, {
          status: "awaiting_pairing",
          power: "running",
          lastSeenAt: now,
          statusChangedAt: now,
        });
        await log(ctx, session._id, "command", `[wings] power → start`);
        await log(
          ctx,
          session._id,
          "info",
          `[baileys] connecting to wss://web.whatsapp.com/ws/chat`,
        );
      } else {
        await ctx.db.patch(session._id, {
          status: "disconnected",
          power: "stopped",
          jid: undefined,
          qrPayload: undefined,
          cpu: 0,
          memoryMb: 0,
          lastSeenAt: now,
          statusChangedAt: now,
        });
        await log(
          ctx,
          session._id,
          "command",
          action === "kill"
            ? "[wings] power → kill (SIGKILL, no flush)"
            : `[wings] power → ${action}`,
        );
        if (action === "restart") {
          await ctx.db.patch(session._id, {
            status: "awaiting_pairing",
            power: "running",
            statusChangedAt: now,
          });
          await log(
            ctx,
            session._id,
            "info",
            `[baileys] reconnecting after restart`,
          );
        }
      }

      return json({ action, accepted: true });
    },
  );

  /* ---- the volume ---- */

  route(
    router,
    "/api/servers/:uuid/files",
    "GET",
    async (ctx, request) => {
      const node = await requireNode(ctx, request);
      if (node instanceof Response) return node;
      const path = new URL(request.url).searchParams.get("path");
      const session = await byUuid(ctx, String(ctx.params.uuid), node._id);
      if (session === null) return json({ error: "not found" }, 404);

      if (path === null) {
        const rows = await ctx.db
          .query("sessionFiles")
          .withIndex("by_session", (q: Q) => q.eq("sessionId", session._id))
          .collect();
        return json(
          (rows as Row[]).map((f) => ({
            name: f.path,
            size: f.size,
            is_dir: f.isDir,
            modified_at: f.updatedAt,
          })),
        );
      }

      const file = await readFile(ctx, session._id, path);
      if (file === null) return json({ error: "no such file" }, 404);
      return text(String(file.contents));
    },
  );

  route(
    router,
    "/api/servers/:uuid/files",
    "PUT",
    async (ctx, request) => {
      const node = await requireNode(ctx, request);
      if (node instanceof Response) return node;
      const path = new URL(request.url).searchParams.get("path") ?? "";
      const session = await byUuid(ctx, String(ctx.params.uuid), node._id);
      if (session === null) return json({ error: "not found" }, 404);

      const contents = await request.text();
      if (contents.length > MAX_FILE_BYTES) {
        return json({ error: "file over 512 KB" }, 413);
      }
      const clean = normalisePath(path);
      if (!clean) return json({ error: "bad path" }, 400);

      await writeFile(ctx, session._id, clean, contents);
      await log(
        ctx,
        session._id,
        "debug",
        `[wings] wrote ${clean} (${contents.length} B)`,
      );
      return json({ path: clean, size: contents.length });
    },
  );

  /* ---- install ---- */

  route(
    router,
    "/api/servers/:uuid/install",
    "POST",
    async (ctx, request) => {
      const node = await requireNode(ctx, request);
      if (node instanceof Response) return node;
      const session = await byUuid(ctx, String(ctx.params.uuid), node._id);
      if (session === null) return json({ error: "not found" }, 404);
      if (session.status === "connected") {
        return json({ error: "stop the server before installing" }, 409);
      }

      const body = (await request.json().catch(() => ({}))) as Row;
      const eggSlug = body.egg_slug as string | undefined;
      const egg = eggSlug
        ? await ctx.db
            .query("eggs")
            .withIndex("by_slug", (q: Q) => q.eq("slug", eggSlug))
            .unique()
        : body.egg_id
          ? await ctx.db.get(body.egg_id as never)
          : null;
      if (!egg) return json({ error: "unknown egg" }, 404);
      if (egg.status !== "published") {
        return json({ error: "egg is not published" }, 409);
      }

      const files = await ctx.db
        .query("eggFiles")
        .withIndex("by_egg", (q: Q) => q.eq("eggId", egg._id))
        .collect();
      for (const file of files) {
        const clean = normalisePath(file.path);
        if (clean) await writeFile(ctx, session._id, clean, file.contents);
      }

      await ctx.db.patch(session._id, {
        eggId: egg._id,
        nestId: egg.nestId,
        startup: egg.startup,
        image: egg.image,
        installState: "installing",
      });

      const installId = await ctx.db.insert("sessionInstalls", {
        sessionId: session._id,
        eggId: egg._id,
        eggName: egg.name,
        runtime: egg.runtime,
        startup: egg.startup,
        variables: (body.variables as string[]) ?? egg.env ?? [],
        status: "queued",
        log: [`queued ${egg.name} on ${egg.runtime}`],
        createdAt: Date.now(),
      });
      await ctx.db.patch(egg._id, { installs: egg.installs + 1 });
      await log(
        ctx,
        session._id,
        "info",
        `[wings] install queued — ${egg.name} (${egg.runtime})`,
      );

      return json({ install: installId, files: files.length }, 201);
    },
  );

  /* ---- heartbeat ---- */

  route(router, "/api/nodes/:id/ping", "POST", async (ctx, request) => {
    const node = await requireNode(ctx, request);
    if (node instanceof Response) return node;
    if (String(ctx.params.id) !== String(node.id)) {
      return json({ error: "that is not your node" }, 403);
    }
    await ctx.db.patch(node._id, { online: true, lastSeenAt: Date.now() });
    return json({ ok: true, node: node.id, daemon: node.daemonVersion });
  });
}
