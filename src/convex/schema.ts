import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/** Lifecycle of a Baileys socket as surfaced in the panel. */
export const SESSION_STATUSES = [
  "disconnected",
  "connecting",
  "awaiting_pairing",
  "connected",
  "conflict",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PAIR_METHODS = ["qr", "code"] as const;
export type PairMethod = (typeof PAIR_METHODS)[number];

/** Log levels a session console can render. */
export const LOG_LEVELS = [
  "info",
  "success",
  "warn",
  "error",
  "debug",
  "command",
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const MESSAGE_KINDS = [
  "text",
  "image",
  "sticker",
  "poll",
  "location",
  "contact",
  "file",
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const WEBHOOK_EVENTS = [
  "connection.update",
  "messages.upsert",
  "message.receipt.update",
  "creds.update",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ------------------------------------------------------------------
    // Kaizen Panel — Baileys WhatsApp control plane
    // ------------------------------------------------------------------

    /** A WhatsApp device linked through a Baileys socket. */
    waSessions: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      status: v.union(
        v.literal("disconnected"),
        v.literal("connecting"),
        v.literal("awaiting_pairing"),
        v.literal("connected"),
        v.literal("conflict"),
      ),
      /** "qr" = scan the code, "code" = enter the pairing code. */
      pairMethod: v.union(v.literal("qr"), v.literal("code")),
      /** The number being linked, e.g. "+1 555 0100". */
      phone: v.optional(v.string()),
      /** Baileys remote JID once paired, e.g. "15550100@s.whatsapp.net". */
      jid: v.optional(v.string()),
      pushName: v.optional(v.string()),
      /** Payload rendered as the pairing QR inside the panel. */
      qrPayload: v.optional(v.string()),
      /** Human-typed pairing code, e.g. "K7QX-2M4P". */
      pairingCode: v.optional(v.string()),
      pairingExpiresAt: v.optional(v.number()),

      autoReply: v.optional(v.boolean()),
      prefix: v.optional(v.string()),
      webhookUrl: v.optional(v.string()),
      /** Fake-but-plausible resource meters, Pterodactyl style. */
      cpu: v.number(),
      memoryMb: v.number(),
      messagesSent: v.number(),
      messagesReceived: v.number(),

      createdAt: v.number(),
      lastConnectedAt: v.optional(v.number()),
      lastSeenAt: v.number(),
      /** When the socket last changed lifecycle state; drives the handshake. */
      statusChangedAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_owner_status", ["ownerId", "status"]),

    /** Append-only console stream for a session. */
    sessionLogs: defineTable({
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
      createdAt: v.number(),
    }).index("by_session", ["sessionId"]),

    /** Every message observed on the socket, both directions. */
    waMessages: defineTable({
      sessionId: v.id("waSessions"),
      direction: v.union(v.literal("inbound"), v.literal("outbound")),
      jid: v.string(),
      pushName: v.optional(v.string()),
      body: v.string(),
      kind: v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("sticker"),
        v.literal("poll"),
        v.literal("location"),
        v.literal("contact"),
        v.literal("file"),
      ),
      status: v.union(
        v.literal("queued"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("read"),
        v.literal("failed"),
      ),
      createdAt: v.number(),
    })
      .index("by_session", ["sessionId"])
      .index("by_created", ["createdAt"]),

    /** Outbound webhook endpoints that receive Baileys events. */
    webhooks: defineTable({
      ownerId: v.id("users"),
      sessionId: v.optional(v.id("waSessions")),
      url: v.string(),
      events: v.array(v.string()),
      enabled: v.boolean(),
      deliveries: v.number(),
      failures: v.number(),
      lastStatus: v.optional(v.number()),
      lastDeliveredAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    /** Panel API keys for driving sessions from your own runtime. */
    panelKeys: defineTable({
      ownerId: v.id("users"),
      name: v.string(),
      /** Only the prefix is stored; the full secret is shown once. */
      prefix: v.string(),
      secretHash: v.string(),
      lastUsedAt: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_owner", ["ownerId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
