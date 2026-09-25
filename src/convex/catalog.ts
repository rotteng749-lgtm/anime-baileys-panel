import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ACCENTS, CATALOG_CATEGORIES } from "./schema";

/**
 * The public catalog.
 *
 * These are the building blocks someone installs on their own panel: blast
 * runners, auto-reply packs, commerce helpers and the device plumbing under
 * them. Everything here is readable without an account; writing needs one.
 */

/** Published entries, newest or most installed first, optionally filtered. */
export const listItems = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    sort: v.optional(v.union(v.literal("new"), v.literal("popular"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("catalogItems")
      .withIndex("by_created")
      .order("desc")
      .collect();

    const term = args.search?.trim().toLowerCase();
    const rows = all
      .filter((item) => item.status === "published")
      .filter((item) => !args.category || item.category === args.category)
      .filter((item) => {
        if (!term) return true;
        const haystack = [
          item.title,
          item.tagline,
          item.summary,
          item.category,
          ...item.tags,
        ]
          .join(" ")
          .toLowerCase();
        return term.split(/\s+/).every((word) => haystack.includes(word));
      });

    if (args.sort === "popular") {
      rows.sort((a, b) => b.installs - a.installs || b.rating - a.rating);
    }
    return rows.slice(0, Math.min(args.limit ?? 60, 120));
  },
});

/** Headline entries for the landing page. */
export const featuredItems = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("catalogItems")
      .withIndex("by_created")
      .order("desc")
      .collect();
    return rows
      .filter((item) => item.status === "published" && item.featured)
      .slice(0, 3);
  },
});

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("catalogItems")
      .withIndex("by_created")
      .order("desc")
      .collect();
    const counts = new Map<string, number>();
    for (const item of rows) {
      if (item.status !== "published") continue;
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return CATALOG_CATEGORIES.map((name) => ({
      name,
      count: counts.get(name) ?? 0,
    }));
  },
});

export const getItem = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("catalogItems")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (item === null || item.status !== "published") return null;
    const comments = await ctx.db
      .query("catalogComments")
      .withIndex("by_item", (q) => q.eq("itemId", item._id))
      .order("desc")
      .take(40);
    const author = item.authorId ? await ctx.db.get(item.authorId) : null;
    return { ...item, comments: comments.reverse(), authorName: author?.name ?? item.authorName };
  },
});

/** Entries in the same category, excluding the one being viewed. */
export const relatedItems = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("catalogItems")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (item === null) return [];
    const rows = await ctx.db
      .query("catalogItems")
      .withIndex("by_category", (q) => q.eq("category", item.category))
      .collect();
    return rows
      .filter((r) => r.status === "published" && r._id !== item._id)
      .slice(0, 3);
  },
});

/** Bump the install counter when someone takes an entry. */
export const installItem = mutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("catalogItems")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (item === null || item.status !== "published") {
      throw new Error("That entry is not available");
    }
    await ctx.db.patch(item._id, { installs: item.installs + 1 });
    return { ok: true, title: item.title };
  },
});

export const addComment = mutation({
  args: { itemId: v.id("catalogItems"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to join the thread");
    const body = args.body.trim();
    if (body.length < 2) throw new Error("Write a little more than that");
    if (body.length > 800) throw new Error("Keep it under 800 characters");

    const user = await ctx.db.get(userId);
    const item = await ctx.db.get(args.itemId);
    if (item === null) throw new Error("That entry no longer exists");

    await ctx.db.insert("catalogComments", {
      itemId: args.itemId,
      authorId: userId,
      authorName: user?.name ?? user?.email ?? "member",
      body,
      createdAt: Date.now(),
    });
  },
});

/* ------------------------------------------------------------------ */
/* Starter catalog                                                    */
/* ------------------------------------------------------------------ */

const STARTER: Array<{
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  body: string;
  category: (typeof CATALOG_CATEGORIES)[number];
  tags: string[];
  priceLabel: string;
  accent: (typeof ACCENTS)[number];
  installs: number;
  rating: number;
  featured: boolean;
}> = [
  {
    slug: "blast-runner",
    title: "Blast Runner",
    tagline: "Scheduled campaigns with per-device throttling",
    summary:
      "Queue a campaign, spread it across your linked devices, and keep a send rate that will not get a number flagged.",
    body: `Blast Runner takes a CSV or a pasted list, validates every number into a remote JID, then drains the queue across every connected session.\n\nIt ships with per-device throttling, duplicate suppression, and a dead-number quarantine list. Failed sends come back as receipts rather than exceptions, so one bad number never stops a campaign.\n\nEvery run is written to the message log with the campaign id attached, which means you can audit exactly what went out and when.`,
    category: "Blast",
    tags: ["csv", "throttle", "queue"],
    priceLabel: "Included",
    accent: "neon",
    installs: 412,
    rating: 4.8,
    featured: true,
  },
  {
    slug: "auto-reply-packs",
    title: "Auto-reply Packs",
    tagline: "Keyword rules, away messages and menu replies",
    summary:
      "Drop-in rules that answer the boring questions — hours, pricing, location — before you wake up.",
    body: `A rule is a trigger, a match mode and a reply. Triggers can be a keyword, a regex, or any inbound message. Match modes are exact, contains or prefix.\n\nOut-of-office rules fire between your configured hours and suppress replies inside an active conversation, so a customer never gets two answers to the same question.`,
    category: "Auto-reply",
    tags: ["rules", "keywords", "oow"],
    priceLabel: "Included",
    accent: "holo",
    installs: 368,
    rating: 4.6,
    featured: true,
  },
  {
    slug: "catalog-broadcast",
    title: "Catalog Broadcast",
    tagline: "Send a product list without the mass-message penalty",
    summary:
      "Splits a long product list into labelled chunks and paces them so each conversation reads like a person, not a newsletter.",
    body: "Catalog Broadcast turns one long list into a short thread. It groups items, adds an index message, then paces each chunk with a human-ish delay.\n\nSupports images and price lines, and it keeps a single logical campaign across several devices.",
    category: "Commerce",
    tags: ["catalog", "pacing"],
    priceLabel: "Included",
    accent: "sakura",
    installs: 254,
    rating: 4.4,
    featured: false,
  },
  {
    slug: "webhook-bridge",
    title: "Webhook Bridge",
    tagline: "Forward every Baileys event to your own service",
    summary:
      "Signed, retried, filtered webhooks for connection updates, inbound messages, receipts and credential rotation.",
    body: `Point an endpoint at the panel and pick the events you care about. Payloads are signed with an HMAC so you can verify them.\n\nFailed deliveries retry with backoff, and the panel keeps a per-endpoint counter of deliveries and failures so you can see when something is rotting.`,
    category: "Developer",
    tags: ["webhook", "hmac", "events"],
    priceLabel: "Included",
    accent: "ember",
    installs: 196,
    rating: 4.9,
    featured: true,
  },
  {
    slug: "device-pool",
    title: "Device Pool",
    tagline: "Round-robin sending across every linked number",
    summary:
      "Treats your linked devices as one pool. Sends land on whichever number is least busy.",
    body: "Device Pool hides the fact that you have several numbers. Call send() once and the pool picks a healthy device, skipping any that are disconnected or cooling off.\n\nUseful when one number cannot carry the whole conversation load.",
    category: "Devices",
    tags: ["pool", "failover"],
    priceLabel: "Included",
    accent: "neon",
    installs: 173,
    rating: 4.5,
    featured: false,
  },
  {
    slug: "media-vault",
    title: "Media Vault",
    tagline: "Reusable stickers, images and file attachments",
    summary:
      "Store the assets you send often once, then reference them by name in any conversation.",
    body: "Upload a sticker pack, a price sheet or the PDF you always resend, then send it with a name instead of a URL.\n\nAttachments survive restarts, so a campaign scheduled on Monday still finds its assets on Tuesday.",
    category: "Commerce",
    tags: ["media", "stickers"],
    priceLabel: "Included",
    accent: "holo",
    installs: 141,
    rating: 4.3,
    featured: false,
  },
];

/**
 * Load the starter catalog. Idempotent — existing slugs are left alone, so it
 * is safe to run again after adding your own entries. Shared by the public
 * seed mutation and the admin area.
 */
export async function seedCatalogRows(ctx: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}) {
  const existing = new Set<string>();
  for (const row of await ctx.db.query("catalogItems").collect()) {
    existing.add(row.slug);
  }

  let added = 0;
  for (const item of STARTER) {
    if (existing.has(item.slug)) continue;
    await ctx.db.insert("catalogItems", {
      ...item,
      authorName: "panel",
      status: "published",
      createdAt: Date.now() - added * 60_000,
    });
    added += 1;
  }
  return { added };
}

export const seedCatalog = mutation({
  args: {},
  handler: async (ctx) => await seedCatalogRows(ctx),
});
