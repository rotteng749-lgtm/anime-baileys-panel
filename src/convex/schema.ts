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

/** Sections of the public catalog. */
export const CATALOG_CATEGORIES = [
  "Blast",
  "Auto-reply",
  "Commerce",
  "Developer",
  "Devices",
] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

/** Accent ramps a catalog card can be drawn in. */
export const ACCENTS = ["neon", "holo", "sakura", "ember"] as const;
export type Accent = (typeof ACCENTS)[number];

/** What a community post is. */
export const POST_KINDS = [
  "template",
  "snippet",
  "bot",
  "guide",
] as const;
export type PostKind = (typeof POST_KINDS)[number];

/** Booking lifecycle. */
export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Sections of the egg catalog. */
export const EGG_CATEGORIES = [
  "Starter",
  "Blast",
  "Auto-reply",
  "Commerce",
  "Developer",
] as const;
export type EggCategory = (typeof EGG_CATEGORIES)[number];

/** Install lifecycle for an egg on a session. */
export const INSTALL_STATUSES = [
  "queued",
  "installing",
  "installed",
  "failed",
] as const;
export type InstallStatus = (typeof INSTALL_STATUSES)[number];

/** File types the agent's file manager is tuned for. */
export const ALLOWED_EXTENSIONS = [
  "js",
  "mjs",
  "cjs",
  "json",
  "txt",
  "md",
  "env",
  "yaml",
  "yml",
  "sh",
  "ts",
  "html",
  "css",
] as const;

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

      // ----------------------------------------------------------------
      // The server object, Pterodactyl's `servers` row
      // ----------------------------------------------------------------

      /** Stable identifier wings addresses the volume by. */
      uuid: v.optional(v.string()),
      /** The short form shown in the panel, e.g. "a1b2c3". */
      uuidShort: v.optional(v.string()),
      /** The machine running wings for this session. */
      nodeId: v.optional(v.id("nodes")),
      /** The reserved ip:port this session answers on. */
      allocationId: v.optional(v.id("allocations")),
      nestId: v.optional(v.id("nests")),
      eggId: v.optional(v.id("eggs")),

      /** Resource limits, in the same units the panel quotes. */
      memory: v.optional(v.number()),
      swap: v.optional(v.number()),
      disk: v.optional(v.number()),
      io: v.optional(v.number()),
      /** CPU in millicores, the unit Docker takes. */
      cpuMilli: v.optional(v.number()),

      /** Overridden startup command, set when an egg is installed. */
      startup: v.optional(v.string()),
      /** The runtime image, the egg's equivalent of a Docker image. */
      image: v.optional(v.string()),
      /** Skip the install script on the next install. */
      skipScripts: v.optional(v.boolean()),

      /** Power state, as the panel reports it. */
      power: v.optional(
        v.union(v.literal("running"), v.literal("stopped")),
      ),
      /**
       * What the operator asked for.
       *
       * The panel never invents state: it writes the intent here, queues a
       * command for the agent, and waits for the agent to report back. When
       * `desiredPower` and `power` disagree the UI shows the server as
       * pending rather than pretending it moved.
       */
      desiredPower: v.optional(
        v.union(v.literal("running"), v.literal("stopped")),
      ),
      /**
       * What the agent last reported about the process:
       * offline | starting | pairing | live | reconnecting | stopping |
       * stopped | crashed.
       */
      workerState: v.optional(v.string()),
      /** The agent process that owns this socket, once one attached. */
      workerId: v.optional(v.id("workers")),
      /** Why the last run ended, straight from the agent. */
      lastExit: v.optional(v.string()),
      /** OS process id holding the socket, for the console header. */
      pid: v.optional(v.number()),
      /** When the agent last pushed the Baileys keys down to the panel. */
      credsSyncedAt: v.optional(v.number()),
      suspended: v.optional(v.boolean()),
      /** Installing, installed, or failed — the install queue's headline. */
      installState: v.optional(v.string()),

      createdAt: v.number(),
      lastConnectedAt: v.optional(v.number()),
      lastSeenAt: v.number(),
      /** When the socket last changed lifecycle state; drives the handshake. */
      statusChangedAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_owner_status", ["ownerId", "status"])
      .index("by_uuid", ["uuid"]),

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
      /**
       * The panel-side id for a queued send.
       *
       * The panel writes the row the moment a message is queued, then the
       * agent confirms it with this same id and the real Baileys key, so a
       * queued message and the message that actually went out are one row.
       */
      clientId: v.optional(v.string()),
      /** The Baileys message id (`key.id`) once the socket sent it. */
      waMessageId: v.optional(v.string()),
      /** Which server sent or received it, stamped at insert time. */
      sessionName: v.optional(v.string()),
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
      .index("by_created", ["createdAt"])
      .index("by_client", ["clientId"]),

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

    /** One row per delivery attempt, so "did it actually go out?" is a fact. */
    webhookDeliveries: defineTable({
      /** Absent when the delivery came from a server's own ad-hoc URL. */
      webhookId: v.optional(v.id("webhooks")),
      ownerId: v.id("users"),
      sessionId: v.optional(v.id("waSessions")),
      event: v.string(),
      url: v.string(),
      ok: v.boolean(),
      statusCode: v.optional(v.number()),
      detail: v.optional(v.string()),
      durationMs: v.number(),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_webhook", ["webhookId"])
      .index("by_created", ["createdAt"]),

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

    // ------------------------------------------------------------------
    // Public catalog — the WangSAP-style service library
    // ------------------------------------------------------------------

    catalogItems: defineTable({
      slug: v.string(),
      title: v.string(),
      tagline: v.string(),
      summary: v.string(),
      body: v.string(),
      category: v.string(),
      tags: v.array(v.string()),
      priceLabel: v.string(),
      /** Accent used on the card, matched to the theme's ramps. */
      accent: v.union(
        v.literal("neon"),
        v.literal("holo"),
        v.literal("sakura"),
        v.literal("ember"),
      ),
      authorName: v.string(),
      authorId: v.optional(v.id("users")),
      installs: v.number(),
      rating: v.number(),
      featured: v.boolean(),
      status: v.union(v.literal("published"), v.literal("draft")),
      createdAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_category", ["category"])
      .index("by_created", ["createdAt"]),

    catalogComments: defineTable({
      itemId: v.id("catalogItems"),
      authorId: v.optional(v.id("users")),
      authorName: v.string(),
      body: v.string(),
      createdAt: v.number(),
    }).index("by_item", ["itemId"]),

    // ------------------------------------------------------------------
    // Community — what people post
    // ------------------------------------------------------------------

    communityPosts: defineTable({
      authorId: v.id("users"),
      authorName: v.string(),
      title: v.string(),
      body: v.string(),
      kind: v.union(
        v.literal("template"),
        v.literal("snippet"),
        v.literal("bot"),
        v.literal("guide"),
      ),
      link: v.optional(v.string()),
      /** Optional catalog entry this post refers to. */
      itemSlug: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_author", ["authorId"])
      .index("by_created", ["createdAt"]),

    // ------------------------------------------------------------------
    // Bookings and direct messages to the operator
    // ------------------------------------------------------------------

    bookings: defineTable({
      userId: v.optional(v.id("users")),
      name: v.string(),
      email: v.string(),
      /** ISO date, e.g. "2026-03-18". */
      date: v.string(),
      slot: v.string(),
      topic: v.string(),
      notes: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("cancelled"),
      ),
      createdAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_user", ["userId"]),

    inquiries: defineTable({
      name: v.string(),
      email: v.string(),
      subject: v.string(),
      message: v.string(),
      read: v.boolean(),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    // ------------------------------------------------------------------
    // Admin — username + password, separate from member accounts
    // ------------------------------------------------------------------

    adminAccounts: defineTable({
      username: v.string(),
      passwordHash: v.string(),
      salt: v.string(),
      label: v.string(),
      createdAt: v.number(),
    }).index("by_username", ["username"]),

    adminSessions: defineTable({
      tokenHash: v.string(),
      label: v.string(),
      expiresAt: v.number(),
      createdAt: v.number(),
    }).index("by_token", ["tokenHash"]),

    // ------------------------------------------------------------------
    // Nests, nodes and allocations — the hosting-panel concepts
    // ------------------------------------------------------------------

    /**
     * A nest: the big category an egg lives in.
     *
     * Minecraft, Steam, Discord, WhatsApp — a nest is a shelf of eggs that
     * share a shape, and it is the first thing you pick when you create a
     * server.
     */
    nests: defineTable({
      slug: v.string(),
      name: v.string(),
      description: v.string(),
      emoji: v.string(),
      accent: v.union(
        v.literal("neon"),
        v.literal("holo"),
        v.literal("sakura"),
        v.literal("ember"),
      ),
      createdAt: v.number(),
    }).index("by_slug", ["slug"]),

    /**
     * A node: one machine running wings.
     *
     * The panel never talks to a socket directly — it talks to the node's
     * daemon over HTTPS with a bearer token, exactly like a hosting panel
     * does. The token is stored hashed and shown once.
     */
    nodes: defineTable({
      /** The node's own identifier, e.g. "node-jkt-01". */
      id: v.string(),
      name: v.string(),
      /** Free-text location, e.g. "Jakarta, ID". */
      location: v.string(),
      /** Host the panel dials, e.g. "jkt1.panel.example". */
      fqdn: v.string(),
      scheme: v.union(v.literal("http"), v.literal("https")),
      tokenPrefix: v.string(),
      tokenHash: v.string(),
      /** What the machine has, in total. */
      totalMemoryMb: v.number(),
      totalDiskMb: v.number(),
      totalCpu: v.number(),
      daemonVersion: v.string(),
      online: v.boolean(),
      lastSeenAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_node_id", ["id"])
      .index("by_token", ["tokenHash"]),

    /**
     * A wings agent: the daemon that owns the real Baileys sockets.
     *
     * Convex cannot hold a long-lived websocket, so the socket lives in a
     * process the operator runs next to their machines — this row is that
     * process's presence. It authenticates with the node's bearer token and
     * reports in on a heartbeat; when the heartbeats stop, the panel says the
     * node is offline instead of pretending the socket is still up.
     */
    workers: defineTable({
      nodeId: v.id("nodes"),
      /** Hostname the agent reported, e.g. "jkt1-wings". */
      name: v.string(),
      version: v.string(),
      /** Live sockets it says it is holding right now. */
      sessions: v.number(),
      pid: v.optional(v.number()),
      startedAt: v.number(),
      lastSeenAt: v.number(),
    })
      .index("by_node", ["nodeId"])
      .index("by_seen", ["lastSeenAt"]),

    /**
     * Work the panel hands to an agent.
     *
     * Power verbs, sends, pairing refreshes and installs all land here as rows
     * and the agent claims them on its next poll. Nothing in the panel writes
     * a socket state directly — this queue is the only path, which is why the
     * console can tell the truth about what actually happened.
     */
    runtimeCommands: defineTable({
      nodeId: v.id("nodes"),
      sessionId: v.optional(v.id("waSessions")),
      kind: v.union(
        v.literal("start"),
        v.literal("stop"),
        v.literal("restart"),
        v.literal("kill"),
        v.literal("send"),
        v.literal("pairing"),
        v.literal("logout"),
        v.literal("install"),
      ),
      payload: v.optional(v.any()),
      status: v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("done"),
        v.literal("error"),
      ),
      result: v.optional(v.string()),
      attempts: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_node_status", ["nodeId", "status"])
      .index("by_session", ["sessionId"])
      .index("by_created", ["createdAt"]),

    /**
     * An allocation: a reserved ip:port.
     *
     * One server takes one primary allocation; additional ports hang off the
     * same pair. An allocation that is not assigned is free for the next
     * server.
     */
    allocations: defineTable({
      nodeId: v.id("nodes"),
      ip: v.string(),
      port: v.number(),
      /** Additional ports on the same ip, if the node allows them. */
      portRange: v.optional(v.array(v.number())),
      assigned: v.boolean(),
      sessionId: v.optional(v.id("waSessions")),
      createdAt: v.number(),
    })
      .index("by_node", ["nodeId"])
      .index("by_session", ["sessionId"]),

    // ------------------------------------------------------------------
    // Eggs — installable Baileys bot templates
    //
    // Same shape as a server-hosting egg: a manifest plus the files it
    // ships, an install script, and the command the agent starts with.
    // ------------------------------------------------------------------

    eggs: defineTable({
      slug: v.string(),
      name: v.string(),
      author: v.string(),
      authorId: v.optional(v.id("users")),
      description: v.string(),
      /** The nest this egg is filed under. */
      nestId: v.optional(v.id("nests")),
      category: v.string(),
      tags: v.array(v.string()),
      /** Which base runtime this egg targets, e.g. "nodejs_22". */
      runtime: v.string(),
      /** The runtime image wings pulls, the egg's Docker image equivalent. */
      image: v.optional(v.string()),
      /** The command the agent runs when the bot starts. */
      startup: v.string(),
      /** The signal wings sends on stop — the egg's stop command. */
      stopCommand: v.optional(v.string()),
      /** The install script, run once before first start. */
      installScript: v.string(),
      /** Default environment variables baked into the install. */
      env: v.optional(v.array(v.string())),
      /** Files the install writes, as path + mode + contents overrides. */
      configFiles: v.optional(
        v.array(
          v.object({
            path: v.string(),
            contents: v.string(),
          }),
        ),
      ),
      accent: v.union(
        v.literal("neon"),
        v.literal("holo"),
        v.literal("sakura"),
        v.literal("ember"),
      ),
      official: v.boolean(),
      status: v.union(v.literal("published"), v.literal("pending"), v.literal("draft")),
      installs: v.number(),
      createdAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_nest", ["nestId"])
      .index("by_created", ["createdAt"]),

    /** Files an egg ships with — the .js, .json and anything else. */
    eggFiles: defineTable({
      eggId: v.id("eggs"),
      path: v.string(),
      contents: v.string(),
      createdAt: v.number(),
    }).index("by_egg", ["eggId"]),

    /** Base runtimes, the thing an egg is built against. */
    runtimes: defineTable({
      id: v.string(),
      label: v.string(),
      nodeVersion: v.string(),
      baileysVersion: v.string(),
      description: v.string(),
      deprecated: v.optional(v.boolean()),
    }).index("by_runtime_id", ["id"]),

    // ------------------------------------------------------------------
    // Wings — the per-session agent
    // ------------------------------------------------------------------

    /** A file on a session's disk. Folders carry empty contents. */
    sessionFiles: defineTable({
      sessionId: v.id("waSessions"),
      path: v.string(),
      contents: v.string(),
      isDir: v.boolean(),
      size: v.number(),
      updatedAt: v.number(),
    })
      .index("by_session", ["sessionId"])
      .index("by_session_path", ["sessionId", "path"]),

    /** An egg installed onto a session, with its install transcript. */
    sessionInstalls: defineTable({
      sessionId: v.id("waSessions"),
      eggId: v.optional(v.id("eggs")),
      eggName: v.string(),
      runtime: v.string(),
      startup: v.string(),
      variables: v.optional(v.array(v.string())),
      status: v.union(
        v.literal("queued"),
        v.literal("installing"),
        v.literal("installed"),
        v.literal("failed"),
      ),
      log: v.array(v.string()),
      createdAt: v.number(),
      completedAt: v.optional(v.number()),
    })
      .index("by_session", ["sessionId"])
      .index("by_created", ["createdAt"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
