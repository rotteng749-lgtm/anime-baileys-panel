import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normalisePath } from "./eggs";

/**
 * The agent's file manager.
 *
 * Each session has a small disk: upload scripts, manifests, notes and config,
 * edit them in place, and pull them back out. Paths are normalised and
 * directory-scoped, so a file can only ever live inside its own session.
 */

const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 200;

/**
 * The slice of the Convex context the helpers in this file touch. Typed loosely
 * on purpose: the same guard is shared by every mutation, and the real context
 * is structurally compatible with it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FileCtx = any;

async function owned(ctx: FileCtx, sessionId: string) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Sign in to use the file manager");
  const session = await ctx.db.get(sessionId);
  if (session === null || session.ownerId !== userId) {
    throw new Error("That session is not yours");
  }
  return session;
}

export const listFiles = query({
  args: {
    sessionId: v.id("waSessions"),
    dir: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return [];

    const dir = (args.dir ?? "").replace(/^\/+|\/+$/g, "");
    const prefix = dir ? `${dir}/` : "";
    const rows = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return rows
      // Only show direct children of the requested directory.
      .filter((f) => f.path.startsWith(prefix))
      .map((f) => {
        const rest = f.path.slice(prefix.length);
        const slash = rest.indexOf("/");
        const name = slash === -1 ? rest : rest.slice(0, slash);
        const isDir = f.isDir || slash !== -1;
        return {
          _id: f._id,
          name,
          path: slash === -1 ? f.path : `${prefix}${name}`,
          isDir,
          size: f.size,
          updatedAt: f.updatedAt,
        };
      })
      .filter((entry) => entry.name !== "" && entry.name !== ".")
      .filter(
        (entry, i, all) =>
          all.findIndex((o) => o.path === entry.path && o.isDir === entry.isDir) ===
          i,
      )
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  },
});

/** Read one file's contents, for the editor. */
export const readFile = query({
  args: { sessionId: v.id("waSessions"), path: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return null;
    const path = normalisePath(args.path);
    if (!path) return null;
    const file = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session_path", (q) =>
        q.eq("sessionId", args.sessionId).eq("path", path),
      )
      .unique();
    if (file === null) return null;
    return { path: file.path, contents: file.contents, updatedAt: file.updatedAt };
  },
});

/** Every file on the session, for the runner's virtual disk. */
export const allFiles = query({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return [];
    return await ctx.db
      .query("sessionFiles")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

async function put(
  ctx: FileCtx,
  sessionId: string,
  path: string,
  contents: string,
  isDir = false,
) {
  const existing = await ctx.db
    .query("sessionFiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_session_path", (q: any) =>
      q.eq("sessionId", sessionId).eq("path", path),
    )
    .unique();

  const now = Date.now();
  if (existing !== null) {
    await ctx.db.patch(existing._id, { contents, size: contents.length, updatedAt: now });
    return existing._id;
  }
  return await ctx.db.insert("sessionFiles", {
    sessionId,
    path,
    contents,
    isDir,
    size: contents.length,
    updatedAt: now,
  });
}

/** Create or overwrite a single file. */
export const writeFile = mutation({
  args: {
    sessionId: v.id("waSessions"),
    path: v.string(),
    contents: v.string(),
  },
  handler: async (ctx, args) => {
    await owned(ctx, args.sessionId);
    const path = normalisePath(args.path);
    if (!path) throw new Error("That path is not allowed");
    if (args.contents.length > MAX_FILE_BYTES) {
      throw new Error("That file is too large (512 KB limit)");
    }
    const id = await put(ctx, args.sessionId, path, args.contents);
    await ctx.db.insert("sessionLogs", {
      sessionId: args.sessionId,
      level: "debug",
      message: `[wings] wrote ${path}`,
      createdAt: Date.now(),
    });
    return id;
  },
});

/**
 * Upload one or more files in a single call.
 *
 * The panel reads each file client-side and posts the text, so a folder of
 * scripts lands in one round trip instead of one mutation per file.
 */
export const uploadFiles = mutation({
  args: {
    sessionId: v.id("waSessions"),
    dir: v.optional(v.string()),
    files: v.array(v.object({ path: v.string(), contents: v.string() })),
  },
  handler: async (ctx, args) => {
    await owned(ctx, args.sessionId);
    if (args.files.length === 0) throw new Error("Nothing to upload");
    if (args.files.length > MAX_FILES) {
      throw new Error(`Upload at most ${MAX_FILES} files at a time`);
    }

    const base = (args.dir ?? "").replace(/^\/+|\/+$/g, "");
    const written: string[] = [];

    for (const file of args.files) {
      const relative = normalisePath(file.path);
      if (!relative) continue;
      if (file.contents.length > MAX_FILE_BYTES) {
        throw new Error(`${relative} is too large (512 KB limit)`);
      }
      const path = base ? `${base}/${relative}` : relative;
      await put(ctx, args.sessionId, path, file.contents);
      written.push(path);
    }

    if (written.length === 0) throw new Error("No valid files in that upload");

    await ctx.db.insert("sessionLogs", {
      sessionId: args.sessionId,
      level: "success",
      message: `[wings] uploaded ${written.length} file${written.length === 1 ? "" : "s"}`,
      createdAt: now(),
    });
    return written;
  },
});

/** Make a directory. Every ancestor is created too. */
export const makeDirectory = mutation({
  args: { sessionId: v.id("waSessions"), path: v.string() },
  handler: async (ctx, args) => {
    await owned(ctx, args.sessionId);
    const path = normalisePath(args.path);
    if (!path) throw new Error("That path is not allowed");
    const parts = path.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const dir = parts.slice(0, i).join("/");
      await put(ctx, args.sessionId, dir, "", true);
    }
    return path;
  },
});

export const deleteFile = mutation({
  args: { sessionId: v.id("waSessions"), path: v.string() },
  handler: async (ctx, args) => {
    await owned(ctx, args.sessionId);
    const path = normalisePath(args.path);
    if (!path) throw new Error("That path is not allowed");

    const rows = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    // Deleting a directory takes everything under it.
    const doomed = rows.filter((f) => f.path === path || f.path.startsWith(`${path}/`));
    for (const file of doomed) await ctx.db.delete(file._id);

    await ctx.db.insert("sessionLogs", {
      sessionId: args.sessionId,
      level: "warn",
      message: `[wings] removed ${path}${doomed.length > 1 ? ` (${doomed.length} entries)` : ""}`,
      createdAt: Date.now(),
    });
    return doomed.length;
  },
});

export const renameFile = mutation({
  args: {
    sessionId: v.id("waSessions"),
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, args) => {
    await owned(ctx, args.sessionId);
    const from = normalisePath(args.from);
    const to = normalisePath(args.to);
    if (!from || !to) throw new Error("That path is not allowed");
    if (from === to) return;

    const rows = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const moving = rows.filter(
      (f) => f.path === from || f.path.startsWith(`${from}/`),
    );
    if (moving.length === 0) throw new Error("Nothing to rename");

    for (const file of moving) {
      const path = file.path.replace(from, to);
      const clash = await ctx.db
        .query("sessionFiles")
        .withIndex("by_session_path", (q) =>
          q.eq("sessionId", args.sessionId).eq("path", path),
        )
        .unique();
      if (clash !== null) throw new Error(`${path} already exists`);
      await ctx.db.patch(file._id, { path, updatedAt: Date.now() });
    }
    return moving.length;
  },
});

function now() {
  return Date.now();
}
