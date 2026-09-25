import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * What people post.
 *
 * A signed-in member publishes a template, a snippet, a bot or a guide. It
 * shows on their dashboard and in the public feed, and an admin can remove it.
 */

export const listPosts = query({
  args: {
    authorId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("communityPosts")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(args.limit ?? 30, 100));
    if (args.authorId) {
      return rows.filter((p) => p.authorId === args.authorId);
    }
    return rows;
  },
});

export const myPosts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("communityPosts")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .order("desc")
      .collect();
  },
});

export const createPost = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    kind: v.union(
      v.literal("template"),
      v.literal("snippet"),
      v.literal("bot"),
      v.literal("guide"),
    ),
    link: v.optional(v.string()),
    itemSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authorId = await getAuthUserId(ctx);
    if (authorId === null) throw new Error("Sign in to post");

    const title = args.title.trim();
    const body = args.body.trim();
    if (title.length < 4) throw new Error("Give the post a real title");
    if (body.length < 10) throw new Error("Add a bit more detail");
    if (args.link && !/^https?:\/\/\S+$/i.test(args.link.trim())) {
      throw new Error("Links must start with http:// or https://");
    }

    const user = await ctx.db.get(authorId);
    return await ctx.db.insert("communityPosts", {
      authorId,
      authorName: user?.name ?? user?.email ?? "member",
      title,
      body,
      kind: args.kind,
      link: args.link?.trim() || undefined,
      itemSlug: args.itemSlug || undefined,
      createdAt: Date.now(),
    });
  },
});

export const deletePost = mutation({
  args: { postId: v.id("communityPosts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const post = await ctx.db.get(args.postId);
    if (post === null) return;
    if (userId === null || post.authorId !== userId) {
      throw new Error("That is not your post");
    }
    await ctx.db.delete(post._id);
  },
});

/* ------------------------------------------------------------------ */
/* Direct messages to the operator                                    */
/* ------------------------------------------------------------------ */

export const createInquiry = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const message = args.message.trim();
    if (message.length < 10) throw new Error("Tell me a little more");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email.trim())) {
      throw new Error("Enter a valid email address");
    }
    await ctx.db.insert("inquiries", {
      name: args.name.trim() || "Anonymous",
      email: args.email.trim(),
      subject: args.subject.trim() || "No subject",
      message,
      read: false,
      createdAt: Date.now(),
    });
  },
});
