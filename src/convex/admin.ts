import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { seedCatalogRows } from "./catalog";

/**
 * The admin area.
 *
 * Admin access is deliberately separate from member accounts: a username and a
 * password, checked here, never touching the member auth tables. Passwords are
 * stored as PBKDF2-style salted SHA-256 digests and the browser only ever
 * holds an opaque bearer token, stored hashed.
 */

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

/**
 * The slice of the Convex context the token helpers touch. Typed loosely on
 * purpose: the guard is shared by every query and mutation in this file, and
 * the real context is structurally compatible with it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminCtx = any;

async function digest(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 40; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `abp_${out}`;
}

/** Resolve the bearer token, or throw. Every admin read goes through here. */
async function getAdmin(ctx: AdminCtx, token: string | undefined) {
  if (!token) throw new Error("Not signed in");
  const tokenHash = await digest(token);
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q: { eq: (f: "tokenHash", v: string) => unknown }) =>
      q.eq("tokenHash", tokenHash),
    )
    .unique();
  if (session === null || session.expiresAt < Date.now()) {
    throw new Error("Session expired");
  }
  return session;
}


export const adminExists = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("adminAccounts").first()) !== null,
});

export const adminMe = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    try {
      await getAdmin(ctx, args.token);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  },
});

/**
 * Claim the first admin account. Only possible while none exists, so this
 * cannot be used to add a second operator later.
 */
export const createFirstAdmin = mutation({
  args: { username: v.string(), password: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if ((await ctx.db.query("adminAccounts").first()) !== null) {
      throw new Error("An admin already exists");
    }
    const username = args.username.trim().toLowerCase();
    if (username.length < 3) throw new Error("Username is too short");
    if (args.password.length < 8) {
      throw new Error("Use at least 8 characters for the password");
    }

    const salt = randomToken().slice(4, 20);
    await ctx.db.insert("adminAccounts", {
      username,
      passwordHash: await digest(`${salt}:${args.password}`),
      salt,
      label: args.label?.trim() || "operator",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const signIn = mutation({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    const account = await ctx.db
      .query("adminAccounts")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    // Always spend the hashing work so a missing account is not obvious.
    const salt = account?.salt ?? "unknown";
    const expected = account?.passwordHash ?? (await digest("unknown:unknown"));
    const actual = await digest(`${salt}:${args.password}`);
    if (account === null || actual !== expected) {
      throw new Error("Wrong username or password");
    }

    const token = randomToken();
    await ctx.db.insert("adminSessions", {
      tokenHash: await digest(token),
      label: account.label,
      expiresAt: Date.now() + SESSION_TTL_MS,
      createdAt: Date.now(),
    });
    return { token, label: account.label };
  },
});

export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await digest(args.token);
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (session !== null) await ctx.db.delete(session._id);
  },
});

/* ------------------------------------------------------------------ */
/* Overview                                                           */
/* ------------------------------------------------------------------ */

export const overview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);

    const [items, posts, bookings, inquiries, users, sessions, keys, hooks] =
      await Promise.all([
        ctx.db.query("catalogItems").collect(),
        ctx.db.query("communityPosts").collect(),
        ctx.db.query("bookings").collect(),
        ctx.db.query("inquiries").collect(),
        ctx.db.query("users").collect(),
        ctx.db.query("waSessions").collect(),
        ctx.db.query("panelKeys").collect(),
        ctx.db.query("webhooks").collect(),
      ]);

    return {
      catalog: items.length,
      published: items.filter((i) => i.status === "published").length,
      posts: posts.length,
      bookings: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      unread: inquiries.filter((i) => !i.read).length,
      members: users.length,
      devices: sessions.length,
      online: sessions.filter((s) => s.status === "connected").length,
      keys: keys.length,
      webhooks: hooks.length,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Catalog management                                                 */
/* ------------------------------------------------------------------ */

export const listAllItems = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    return await ctx.db.query("catalogItems").order("desc").collect();
  },
});

export const upsertItem = mutation({
  args: {
    token: v.string(),
    id: v.optional(v.id("catalogItems")),
    slug: v.string(),
    title: v.string(),
    tagline: v.string(),
    summary: v.string(),
    body: v.string(),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
    priceLabel: v.optional(v.string()),
    accent: v.union(
      v.literal("neon"),
      v.literal("holo"),
      v.literal("sakura"),
      v.literal("ember"),
    ),
    status: v.optional(v.union(v.literal("published"), v.literal("draft"))),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    const slug = args.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (slug.length < 3) throw new Error("Slug is too short");
    if (args.title.trim().length < 3) throw new Error("Title is too short");

    const patch = {
      slug,
      title: args.title.trim(),
      tagline: args.tagline.trim(),
      summary: args.summary.trim(),
      body: args.body,
      category: args.category,
      tags: args.tags ?? [],
      priceLabel: args.priceLabel?.trim() || "Included",
      accent: args.accent,
      status: args.status ?? ("published" as const),
      featured: args.featured ?? false,
    };

    if (args.id) {
      await ctx.db.patch(args.id, patch);
      return args.id;
    }
    return await ctx.db.insert("catalogItems", {
      ...patch,
      authorName: "panel",
      installs: 0,
      rating: 0,
      createdAt: Date.now(),
    });
  },
});

export const removeItem = mutation({
  args: { token: v.string(), id: v.id("catalogItems") },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    const comments = await ctx.db
      .query("catalogComments")
      .withIndex("by_item", (q) => q.eq("itemId", args.id))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);
    await ctx.db.delete(args.id);
  },
});

export const loadStarterCatalog = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    return await seedCatalogRows(ctx);
  },
});

/* ------------------------------------------------------------------ */
/* Bookings, posts, inquiries                                         */
/* ------------------------------------------------------------------ */

export const listAllBookings = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    return await ctx.db.query("bookings").order("desc").collect();
  },
});

export const setBookingStatus = mutation({
  args: {
    token: v.string(),
    id: v.id("bookings"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const listAllPosts = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    return await ctx.db.query("communityPosts").order("desc").collect();
  },
});

export const removePost = mutation({
  args: { token: v.string(), id: v.id("communityPosts") },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    await ctx.db.delete(args.id);
  },
});

export const listInquiries = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    return await ctx.db.query("inquiries").order("desc").collect();
  },
});

export const setInquiryRead = mutation({
  args: { token: v.string(), id: v.id("inquiries"), read: v.boolean() },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    await ctx.db.patch(args.id, { read: args.read });
  },
});

/* ------------------------------------------------------------------ */
/* Eggs                                                               */
/* ------------------------------------------------------------------ */

/** Every egg with its file count, newest first — pending ones float up. */
export const listAllEggs = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    const eggs = await ctx.db.query("eggs").order("desc").collect();
    const rows = [];
    for (const egg of eggs) {
      const files = await ctx.db
        .query("eggFiles")
        .withIndex("by_egg", (q) => q.eq("eggId", egg._id))
        .collect();
      rows.push({
        ...egg,
        fileCount: files.length,
        bytes: files.reduce((n, f) => n + f.contents.length, 0),
      });
    }
    return rows;
  },
});

/** Approve a submitted egg, or send it back to draft. */
export const setEggStatus = mutation({
  args: {
    token: v.string(),
    id: v.id("eggs"),
    status: v.union(v.literal("published"), v.literal("pending"), v.literal("draft")),
  },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    await ctx.db.patch(args.id, { status: args.status });
  },
});

/** Withdraw an egg and every file it shipped. */
export const removeEgg = mutation({
  args: { token: v.string(), id: v.id("eggs") },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    const files = await ctx.db
      .query("eggFiles")
      .withIndex("by_egg", (q) => q.eq("eggId", args.id))
      .collect();
    for (const file of files) await ctx.db.delete(file._id);
    await ctx.db.delete(args.id);
  },
});

/* ------------------------------------------------------------------ */
/* Members                                                            */
/* ------------------------------------------------------------------ */

export const listMembers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await getAdmin(ctx, args.token);
    return await ctx.db.query("users").collect();
  },
});
