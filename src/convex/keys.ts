import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Webhook endpoints that receive Baileys events. */

export const listWebhooks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("webhooks")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .order("desc")
      .collect();
  },
});

export const createWebhook = mutation({
  args: {
    url: v.string(),
    events: v.array(v.string()),
    sessionId: v.optional(v.id("waSessions")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const url = args.url.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      throw new Error("Enter a full http:// or https:// URL");
    }
    return await ctx.db.insert("webhooks", {
      ownerId: userId,
      sessionId: args.sessionId,
      url,
      events: args.events.length ? args.events : ["messages.upsert"],
      enabled: true,
      deliveries: 0,
      failures: 0,
      createdAt: Date.now(),
    });
  },
});

export const toggleWebhook = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const hook = await ctx.db.get(args.webhookId);
    if (hook === null) throw new Error("Webhook not found");
    const userId = await getAuthUserId(ctx);
    if (userId === null || hook.ownerId !== userId) {
      throw new Error("Not your webhook");
    }
    await ctx.db.patch(hook._id, { enabled: !hook.enabled });
  },
});

export const deleteWebhook = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const hook = await ctx.db.get(args.webhookId);
    if (hook === null) return;
    const userId = await getAuthUserId(ctx);
    if (userId === null || hook.ownerId !== userId) {
      throw new Error("Not your webhook");
    }
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhook", (q) => q.eq("webhookId", args.webhookId))
      .collect();
    for (const row of deliveries) await ctx.db.delete(row._id);
    await ctx.db.delete(hook._id);
  },
});

/**
 * The last few deliveries for this operator's endpoints.
 *
 * A webhook row only says it is enabled; this says whether anything actually
 * reached the URL, which is the thing people ask about.
 */
export const listDeliveries = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.min(args.limit ?? 20, 100));
  },
});

/** Record a delivery the panel itself made (the test button). */
export const recordTestDelivery = mutation({
  args: {
    webhookId: v.id("webhooks"),
    ok: v.boolean(),
    statusCode: v.optional(v.number()),
    detail: v.optional(v.string()),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const hook = await ctx.db.get(args.webhookId);
    if (hook === null || hook.ownerId !== userId) {
      throw new Error("Not your webhook");
    }
    const now = Date.now();
    await ctx.db.insert("webhookDeliveries", {
      webhookId: hook._id,
      ownerId: userId,
      sessionId: hook.sessionId,
      event: "ping",
      url: hook.url,
      ok: args.ok,
      statusCode: args.statusCode,
      detail: args.detail,
      durationMs: args.durationMs,
      createdAt: now,
    });
    await ctx.db.patch(hook._id, {
      deliveries: hook.deliveries + 1,
      failures: hook.failures + (args.ok ? 0 : 1),
      lastStatus: args.statusCode,
      lastDeliveredAt: now,
    });
    return { ok: args.ok };
  },
});

/* ------------------------------------------------------------------ */
/* Panel API keys                                                     */
/* ------------------------------------------------------------------ */

function randomKey() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let body = "";
  for (let i = 0; i < 32; i++) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `kz_live_${body}`;
}

async function hashSecret(secret: string) {
  const data = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const listKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("panelKeys")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .order("desc")
      .collect();
    // The hash never leaves the server.
    return rows.map((row) => ({
      _id: row._id,
      _creationTime: row._creationTime,
      name: row.name,
      prefix: row.prefix,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
    }));
  },
});

/** The full secret is returned exactly once, at creation time. */
export const createKey = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const secret = randomKey();
    const id = await ctx.db.insert("panelKeys", {
      ownerId: userId,
      name: args.name.trim() || "Untitled key",
      prefix: secret.slice(0, 15),
      secretHash: await hashSecret(secret),
      createdAt: Date.now(),
    });
    return { id, secret };
  },
});

export const deleteKey = mutation({
  args: { keyId: v.id("panelKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.keyId);
    if (key === null) return;
    const userId = await getAuthUserId(ctx);
    if (userId === null || key.ownerId !== userId) {
      throw new Error("Not your key");
    }
    await ctx.db.delete(key._id);
  },
});
