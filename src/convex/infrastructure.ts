import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Nests, nodes and allocations.
 *
 * The three concepts a hosting panel is built on, kept because they answer
 * three different questions:
 *
 *   - a **nest** is what kind of thing this is ("WhatsApp bots", "Discord
 *     bots", "Game servers") and which eggs live on the shelf;
 *   - a **node** is one machine running wings, with a bearer token the panel
 *     dials over HTTPS;
 *   - an **allocation** is a reserved ip:port. One server takes one primary
 *     allocation; the rest of the port range is free for the next one.
 *
 * The panel never opens a socket itself. It writes here, then asks the node's
 * wings to act — same handshake, same bearer token, same power verbs.
 */

/* ------------------------------------------------------------------ */
/* Nests                                                              */
/* ------------------------------------------------------------------ */

export const listNests = query({
  args: {},
  handler: async (ctx) => {
    const nests = await ctx.db.query("nests").collect();
    const eggs = await ctx.db.query("eggs").collect();
    return nests.map((nest) => ({
      ...nest,
      eggCount: eggs.filter(
        (e) => e.nestId === nest._id && e.status === "published",
      ).length,
    }));
  },
});

export const getNest = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const nest = await ctx.db
      .query("nests")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return nest;
  },
});

/* ------------------------------------------------------------------ */
/* Nodes                                                              */
/* ------------------------------------------------------------------ */

/** The SHA-256 the node tokens are stored as. Shared with the seeder. */
export async function digest(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Every node, with its allocations and how much of it is spoken for. */
export const listNodes = query({
  args: {},
  handler: async (ctx) => {
    const nodes = await ctx.db.query("nodes").collect();
    const sessions = await ctx.db.query("waSessions").collect();
    const allocations = await ctx.db.query("allocations").collect();
    return nodes.map((node) => {
      const mine = allocations.filter((a) => a.nodeId === node._id);
      const assigned = mine.filter((a) => a.assigned);
      return {
        ...node,
        allocationCount: mine.length,
        allocationUsed: assigned.length,
        // What the node is actually running, in the same units it advertises.
        memoryUsed: sessions
          .filter((s) => s.nodeId === node._id)
          .reduce((n, s) => n + (s.memory ?? 0), 0),
        diskUsed: sessions
          .filter((s) => s.nodeId === node._id)
          .reduce((n, s) => n + (s.disk ?? 0), 0),
        serverCount: sessions.filter((s) => s.nodeId === node._id).length,
      };
    });
  },
});

/** Register a node and hand back its wings token. Shown once, stored hashed. */
export const createNode = mutation({
  args: {
    name: v.string(),
    location: v.string(),
    fqdn: v.string(),
    totalMemoryMb: v.number(),
    totalDiskMb: v.number(),
    totalCpu: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to add a node");

    const existing = await ctx.db.query("nodes").collect();
    const token = `wings_${randomToken(48)}`;
    const id = `${slugify(args.location)}-${String(existing.length + 1).padStart(2, "0")}`;

    await ctx.db.insert("nodes", {
      id,
      name: args.name,
      location: args.location,
      fqdn: args.fqdn,
      scheme: "https",
      tokenPrefix: token.slice(0, 12),
      tokenHash: await digest(token),
      totalMemoryMb: args.totalMemoryMb,
      totalDiskMb: args.totalDiskMb,
      totalCpu: args.totalCpu,
      daemonVersion: "1.0.0",
      online: false,
      createdAt: Date.now(),
    });

    return { id, token };
  },
});

/** Issue a new wings token for a node; the old one stops working at once. */
export const rotateNodeToken = mutation({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to rotate a node token");
    const node = await ctx.db.get(args.nodeId);
    if (node === null) throw new Error("No such node");

    const token = `wings_${randomToken(48)}`;
    await ctx.db.patch(args.nodeId, {
      tokenHash: await digest(token),
      tokenPrefix: token.slice(0, 12),
    });
    return { token };
  },
});

export const removeNode = mutation({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to remove a node");
    const allocations = await ctx.db
      .query("allocations")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .collect();
    for (const allocation of allocations) {
      await ctx.db.delete(allocation._id);
    }
    await ctx.db.delete(args.nodeId);
  },
});

/* ------------------------------------------------------------------ */
/* Allocations                                                        */
/* ------------------------------------------------------------------ */

/** What a node has, and what is still free. */
export const listAllocations = query({
  args: { nodeId: v.optional(v.id("nodes")) },
  handler: async (ctx, args) => {
    const nodeId = args.nodeId;
    if (nodeId === undefined) {
      return await ctx.db.query("allocations").collect();
    }
    return await ctx.db
      .query("allocations")
      .withIndex("by_node", (q) => q.eq("nodeId", nodeId))
      .collect();
  },
});

/** Claim the first free allocation on a node for a session. */
export const assignAllocation = mutation({
  args: {
    nodeId: v.id("nodes"),
    sessionId: v.id("waSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to assign an allocation");

    const free = await ctx.db
      .query("allocations")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .collect();
    const allocation = free.find((a) => !a.assigned);
    if (allocation === undefined) {
      throw new Error("That node has no free allocations left");
    }

    await ctx.db.patch(allocation._id, {
      assigned: true,
      sessionId: args.sessionId,
    });
    return allocation._id;
  },
});

export const releaseAllocation = mutation({
  args: { allocationId: v.id("allocations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to release an allocation");
    const allocation = await ctx.db.get(args.allocationId);
    if (allocation === null) return;
    await ctx.db.patch(args.allocationId, {
      assigned: false,
      sessionId: undefined,
    });
  },
});

/* ------------------------------------------------------------------ */
/* Server identity                                                    */
/* ------------------------------------------------------------------ */

export function randomToken(length: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

type SeedCtx = {
  // The seeder only ever calls query().collect() and insert().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
};

/** A v4-shaped uuid. Wings addresses the volume by this. */
export function makeUuid() {
  const hex = randomToken(32).replace(/[a-z]/g, "c");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Give every session the server-object fields it is missing.
 *
 * Sessions created before the hosting model existed have no uuid, no resource
 * limits and no power state. This fills them in once, without touching the
 * socket, so the panel and the wings API see the same shape either way.
 */
export const backfillServers = mutation({
  args: {},
  handler: async (ctx) => backfillServerRows(ctx),
});

/**
 * Give every session the server-object fields it is missing.
 *
 * Sessions created before the hosting model existed have no uuid, no resource
 * limits and no power state. This fills them in once, without touching the
 * socket, so the panel and the wings API see the same shape either way.
 */
export async function backfillServerRows(ctx: SeedCtx) {
    const sessions = await ctx.db.query("waSessions").collect();
    const nodes = await ctx.db.query("nodes").collect();
    const node = nodes[0];
    let patched = 0;

    for (const session of sessions) {
      if (session.uuid) continue;

      const uuid = makeUuid();
      let allocationId = session.allocationId;
      if (node && !allocationId) {
        const free = (await ctx.db
          .query("allocations")
          .withIndex("by_node", (q: { eq: (f: "nodeId", v: unknown) => unknown }) =>
            q.eq("nodeId", node._id),
          )
          .collect()) as {
          _id: string;
          assigned: boolean;
        }[];
        const allocation = free.find((a) => !a.assigned);
        if (allocation) {
          await ctx.db.patch(allocation._id, {
            assigned: true,
            sessionId: session._id,
          });
          allocationId = allocation._id;
        }
      }

      await ctx.db.patch(session._id, {
        uuid,
        uuidShort: uuid.slice(0, 8),
        nodeId: node?._id,
        allocationId,
        memory: session.memory ?? 512,
        swap: session.swap ?? 0,
        disk: session.disk ?? 2048,
        io: session.io ?? 500,
        cpuMilli: session.cpuMilli ?? 500,
        power: session.status === "connected" ? "running" : "stopped",
        installState: "installed",
        lastSeenAt: session.lastSeenAt ?? Date.now(),
      });
      patched += 1;
    }

    return patched;
}
