import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
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
      createdAt: now,
      lastSeenAt: now,
      statusChangedAt: now,
    });
    await ctx.db.insert("sessionLogs", {
      sessionId,
      level: "info",
      message: `[kaizen] session "${args.name}" provisioned — runtime baileys/6.x`,
      createdAt: now,
    });
    return sessionId;
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
