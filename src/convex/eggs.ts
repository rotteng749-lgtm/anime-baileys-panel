import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { EGG_CATEGORIES } from "./schema";

/**
 * Eggs and runtimes.
 *
 * An egg is a manifest plus the files it ships: a runtime to build against, an
 * install script, and the command the agent starts with. Runtimes are the base
 * builds an egg targets, the way base images sit under a game egg.
 *
 * Members can publish their own eggs by uploading a manifest and its files;
 * those land as `pending` until an admin approves them.
 */

/* ------------------------------------------------------------------ */
/* Browse                                                             */
/* ------------------------------------------------------------------ */

export const listEggs = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    includePending: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("eggs")
      .withIndex("by_created")
      .order("desc")
      .collect();

    const term = args.search?.trim().toLowerCase();
    return rows
      .filter((egg) => {
        if (args.includePending && userId) {
          return egg.status === "published" || egg.authorId === userId;
        }
        return egg.status === "published";
      })
      .filter((egg) => !args.category || egg.category === args.category)
      .filter((egg) => {
        if (!term) return true;
        return [egg.name, egg.description, egg.category, egg.runtime, ...egg.tags]
          .join(" ")
          .toLowerCase()
          .split(/\s+/)
          .every((word) =>
            [egg.name, egg.description, egg.category, egg.runtime, ...egg.tags]
              .join(" ")
              .toLowerCase()
              .includes(word),
          );
      })
      .sort((a, b) => b.installs - a.installs);
  },
});

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("eggs")
      .withIndex("by_created")
      .order("desc")
      .collect();
    const counts = new Map<string, number>();
    for (const egg of rows) {
      if (egg.status !== "published") continue;
      counts.set(egg.category, (counts.get(egg.category) ?? 0) + 1);
    }
    return EGG_CATEGORIES.map((name) => ({
      name,
      count: counts.get(name) ?? 0,
    }));
  },
});

export const listRuntimes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("runtimes").collect();
  },
});

export const getEgg = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const egg = await ctx.db
      .query("eggs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (egg === null) return null;
    const visible =
      egg.status === "published" || (userId !== null && egg.authorId === userId);
    if (!visible) return null;
    const files = await ctx.db
      .query("eggFiles")
      .withIndex("by_egg", (q) => q.eq("eggId", egg._id))
      .collect();
    return {
      ...egg,
      files: files
        .map((f) => ({ path: f.path, contents: f.contents }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    };
  },
});

/* ------------------------------------------------------------------ */
/* Files                                                              */
/* ------------------------------------------------------------------ */

export const writeEggFile = mutation({
  args: {
    eggId: v.id("eggs"),
    path: v.string(),
    contents: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to edit an egg");
    const egg = await ctx.db.get(args.eggId);
    if (egg === null) throw new Error("That egg no longer exists");
    if (egg.authorId !== userId) throw new Error("That egg is not yours");

    const existing = await ctx.db
      .query("eggFiles")
      .withIndex("by_egg", (q) => q.eq("eggId", args.eggId))
      .collect();
    const found = existing.find((f) => f.path === args.path);
    if (found) {
      await ctx.db.patch(found._id, { contents: args.contents });
    } else {
      await ctx.db.insert("eggFiles", {
        eggId: args.eggId,
        path: args.path,
        contents: args.contents,
        createdAt: Date.now(),
      });
    }
  },
});

/* ------------------------------------------------------------------ */
/* Publishing                                                         */
/* ------------------------------------------------------------------ */

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Publish an egg from an uploaded manifest.
 *
 * The manifest is a JSON object shaped like a hosting-panel egg: name, author,
 * description, runtime, startup, an install script, and the files it ships.
 * Anything it declares is validated here rather than trusted.
 */
export const publishEgg = mutation({
  args: {
    manifest: v.string(),
    files: v.array(v.object({ path: v.string(), contents: v.string() })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to publish an egg");

    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(args.manifest);
    } catch {
      throw new Error("The manifest is not valid JSON");
    }

    const name = String(manifest.name ?? "").trim();
    if (name.length < 3) throw new Error("The manifest needs a name");
    const description = String(manifest.description ?? "").trim();
    if (description.length < 10) throw new Error("Add a longer description");
    const runtime = String(manifest.runtime ?? "").trim();
    if (!runtime) throw new Error("The manifest needs a runtime");
    const startup = String(manifest.startup ?? "node index.js").trim();
    const installScript = String(
      manifest.installScript ?? "npm install",
    ).trim();

    const config = (manifest.config ?? {}) as Record<string, unknown>;
    const env = Array.isArray(config.env)
      ? (config.env as unknown[]).map((e) => `${String(e)}=`)
      : Object.keys((config.env ?? {}) as Record<string, unknown>).map(
          (k) => `${k}=`,
        );

    const tags = Array.isArray(manifest.tags)
      ? (manifest.tags as unknown[]).map((t) => String(t)).slice(0, 8)
      : [];

    const slug = `${slugify(name)}-${randomSuffix()}`;
    const user = await ctx.db.get(userId);

    const eggId = await ctx.db.insert("eggs", {
      slug,
      name,
      author: String(manifest.author ?? user?.name ?? user?.email ?? "member"),
      authorId: userId,
      description,
      category: String(manifest.category ?? "Developer"),
      tags,
      runtime,
      startup,
      installScript,
      env,
      accent: pickAccent(slug),
      official: false,
      status: "pending",
      installs: 0,
      createdAt: Date.now(),
    });

    for (const file of args.files) {
      const path = normalisePath(file.path);
      if (!path) continue;
      await ctx.db.insert("eggFiles", {
        eggId,
        path,
        contents: file.contents,
        createdAt: Date.now(),
      });
    }

    return { eggId, slug };
  },
});

function randomSuffix() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function pickAccent(seed: string): "neon" | "holo" | "sakura" | "ember" {
  const sum = seed.split("").reduce((n, c) => n + c.charCodeAt(0), 0);
  const order = ["neon", "holo", "sakura", "ember"] as const;
  return order[sum % order.length];
}

/** Reject anything that could escape the egg's own directory. */
export function normalisePath(input: string) {
  const cleaned = input.trim().replace(/^\.?\//, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("/") || cleaned.includes("..")) return null;
  if (cleaned.length > 120) return null;
  return cleaned;
}

/* ------------------------------------------------------------------ */
/* Install                                                            */
/* ------------------------------------------------------------------ */

/** Install an egg onto one of your sessions. */
export const installEgg = mutation({
  args: {
    sessionId: v.id("waSessions"),
    eggSlug: v.string(),
    variables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in to install an egg");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("That session is not yours");
    }
    if (session.status === "connected") {
      throw new Error("Disconnect the session before installing");
    }

    const egg = await ctx.db
      .query("eggs")
      .withIndex("by_slug", (q) => q.eq("slug", args.eggSlug))
      .unique();
    if (egg === null || egg.status !== "published") {
      throw new Error("That egg is not available");
    }

    // Lay the egg's files down before the install script runs.
    const files = await ctx.db
      .query("eggFiles")
      .withIndex("by_egg", (q) => q.eq("eggId", egg._id))
      .collect();
    for (const file of files) {
      const path = normalisePath(file.path);
      if (!path) continue;
      const existing = await ctx.db
        .query("sessionFiles")
        .withIndex("by_session_path", (q) =>
          q.eq("sessionId", args.sessionId).eq("path", path),
        )
        .unique();
      if (existing !== null) {
        await ctx.db.patch(existing._id, {
          contents: file.contents,
          isDir: false,
          size: file.contents.length,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("sessionFiles", {
          sessionId: args.sessionId,
          path,
          contents: file.contents,
          isDir: false,
          size: file.contents.length,
          updatedAt: Date.now(),
        });
      }
    }

    const installId = await ctx.db.insert("sessionInstalls", {
      sessionId: args.sessionId,
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
    await ctx.db.insert("sessionLogs", {
      sessionId: args.sessionId,
      level: "info",
      message: `[wings] install queued — ${egg.name} (${egg.runtime})`,
      createdAt: Date.now(),
    });

    return installId;
  },
});

export const getInstall = query({
  args: { installId: v.id("sessionInstalls") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const install = await ctx.db.get(args.installId);
    if (install === null) return null;
    const session = await ctx.db.get(install.sessionId);
    if (session === null || session.ownerId !== userId) return null;
    return install;
  },
});

export const listInstalls = query({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return [];
    return await ctx.db
      .query("sessionInstalls")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
  },
});

/** The install queue runs a step at a time; the panel ticks it forward. */
export const advanceInstall = mutation({
  args: { installId: v.id("sessionInstalls") },
  handler: async (ctx, args) => {
    const install = await ctx.db.get(args.installId);
    if (install === null) return;
    if (
      install.status === "installed" ||
      install.status === "failed"
    ) {
      return;
    }

    const now = Date.now();
    const elapsed = now - install.createdAt;
    const log = [...install.log];

    if (install.status === "queued") {
      const egg = install.eggId ? await ctx.db.get(install.eggId) : null;
      log.push(`resolving runtime ${install.runtime}`);
      log.push(`install script: ${egg?.installScript ?? "npm install"}`);
      await ctx.db.patch(args.installId, { status: "installing", log });
      return;
    }

    if (install.status === "installing" && elapsed > 2_500) {
      log.push("dependencies resolved");
      log.push(`installed with ${install.startup}`);
      await ctx.db.patch(args.installId, {
        status: "installed",
        log,
        completedAt: now,
      });
      await ctx.db.insert("sessionLogs", {
        sessionId: install.sessionId,
        level: "success",
        message: `[wings] install complete — ${install.eggName} ready`,
        createdAt: now,
      });
    }
  },
});
