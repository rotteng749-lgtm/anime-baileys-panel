import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { LogLevel } from "./schema";

/**
 * The Baileys socket runtime.
 *
 * A real socket advances on its own: it opens the websocket, waits for creds,
 * emits a QR, and only becomes `open` once the phone scans. The panel drives
 * the same sequence through `tick`, which the console view calls on a short
 * interval — the same way a live console would watch a running process.
 *
 * Every transition writes a console line, so the log reads like a real
 * Baileys session rather than a set of UI states.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomToken(len: number) {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** The opaque `ref` a Baileys QR encodes. */
function makeQrRef(phone: string | undefined) {
  const compact = (phone ?? "").replace(/\D/g, "") || "15550100";
  return `2@${randomToken(20)},${randomToken(6)},${Date.now()},${compact}`;
}

/** Normalise a phone number or JID into Baileys remote-JID form. */
function toJid(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6) throw new Error("Enter a valid phone number");
  return `${digits}@s.whatsapp.net`;
}

const PAIRING_WINDOW_MS = 50_000;

/**
 * Advance the socket by one step. The panel calls this every couple of
 * seconds while a session is not yet `connected`; it is a no-op otherwise.
 */
export const tick = mutation({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return;
    if (session.status === "connected") return;

    const now = Date.now();
    const elapsed = now - session.statusChangedAt;

    if (session.status === "connecting" && elapsed > 1_200) {
      // creds.update fires; the panel now has something to show.
      await ctx.db.patch(session._id, {
        status: "awaiting_pairing",
        qrPayload: makeQrRef(session.phone),
        pairingCode: `${randomToken(4)}-${randomToken(4)}`,
        pairingExpiresAt: now + PAIRING_WINDOW_MS,
        statusChangedAt: now,
        lastSeenAt: now,
      });
      await ctx.db.insert("sessionLogs", {
        sessionId: session._id,
        level: "success",
        message:
          session.pairMethod === "code"
            ? "[baileys] usePairingCode — enter the code on the phone (50s window)"
            : "[baileys] QR ref received — scan from WhatsApp → Linked devices",
        createdAt: now,
      });
      return;
    }

    if (session.status === "awaiting_pairing" && session.pairingExpiresAt) {
      if (now > session.pairingExpiresAt) {
        await ctx.db.patch(session._id, {
          qrPayload: undefined,
          pairingCode: undefined,
          pairingExpiresAt: undefined,
          statusChangedAt: now,
          lastSeenAt: now,
        });
        await ctx.db.insert("sessionLogs", {
          sessionId: session._id,
          level: "warn",
          message: "[baileys] pairing ref expired — request a new one",
          createdAt: now,
        });
      }
    }
  },
});

/** Open the socket. Resolves into `awaiting_pairing` on the next tick. */
export const startPairing = mutation({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    if (session.status === "connected") throw new Error("Session is already online");
    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "connecting",
      statusChangedAt: now,
      lastSeenAt: now,
    });
    await ctx.db.insert("sessionLogs", {
      sessionId: session._id,
      level: "info",
      message: "[baileys] connecting to wss://web.whatsapp.com/ws/chat",
      createdAt: now,
    });
  },
});

/** Ask for a fresh QR / pairing code. */
export const regeneratePairing = mutation({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    if (session.status === "connected") throw new Error("Session is already online");
    const now = Date.now();
    await ctx.db.insert("sessionLogs", {
      sessionId: session._id,
      level: "info",
      message: "[baileys] creds.update — discarded ref, requesting a new one",
      createdAt: now,
    });
    await ctx.db.patch(session._id, {
      status: "connecting",
      statusChangedAt: now,
      lastSeenAt: now,
    });
  },
});

/**
 * Complete the handshake. On a real deployment the phone pushes this; in the
 * panel it is the "Link device" action once the code has been entered.
 */
export const completePairing = mutation({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    if (session.status === "connected") return;

    const now = Date.now();
    const digits = (session.phone ?? "").replace(/\D/g, "") || "15550100";
    const jid = `${digits}@s.whatsapp.net`;

    await ctx.db.patch(session._id, {
      status: "connected",
      jid,
      pushName: session.name,
      qrPayload: undefined,
      pairingCode: undefined,
      pairingExpiresAt: undefined,
      cpu: 20 + Math.round(Math.random() * 12),
      memoryMb: 140 + Math.round(Math.random() * 40),
      lastConnectedAt: now,
      statusChangedAt: now,
      lastSeenAt: now,
    });

    const lines: Array<[LogLevel, string]> = [
      ["success", "[baileys] connection.update — connection: open"],
      ["info", `[baileys] logged in as ${jid}`],
      ["debug", "[baileys] subscribed: messages.upsert, message.receipt.update"],
    ];
    for (const [level, message] of lines) {
      await ctx.db.insert("sessionLogs", {
        sessionId: session._id,
        level,
        message,
        createdAt: now,
      });
    }
  },
});

/* ------------------------------------------------------------------ */
/* Outbound                                                           */
/* ------------------------------------------------------------------ */

export const sendMessage = mutation({
  args: {
    sessionId: v.id("waSessions"),
    to: v.string(),
    body: v.string(),
    kind: v.optional(
      v.union(
        v.literal("text"),
        v.literal("image"),
        v.literal("sticker"),
        v.literal("poll"),
        v.literal("location"),
        v.literal("contact"),
        v.literal("file"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    if (session.status !== "connected") {
      throw new Error("Session is not connected");
    }

    const now = Date.now();
    const jid = toJid(args.to);
    const kind = args.kind ?? "text";
    const body = args.body.trim();
    if (!body) throw new Error("Message is empty");

    await ctx.db.insert("waMessages", {
      sessionId: session._id,
      direction: "outbound",
      jid,
      pushName: jid.split("@")[0],
      body,
      kind,
      status: "sent",
      createdAt: now,
    });
    await ctx.db.patch(session._id, {
      messagesSent: session.messagesSent + 1,
      lastSeenAt: now,
    });

    const verb =
      kind === "text"
        ? "sendText"
        : `send${kind[0].toUpperCase()}${kind.slice(1)}`;
    await ctx.db.insert("sessionLogs", {
      sessionId: session._id,
      level: "command",
      message: `${verb}(${jid}, ${truncate(body, 60)})`,
      createdAt: now,
    });
  },
});

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/* ------------------------------------------------------------------ */
/* Inbound                                                            */
/* ------------------------------------------------------------------ */

const INBOUND_SAMPLES: Array<{ from: string; name: string; body: string }> = [
  { from: "6281234567890", name: "Rika", body: "hai kak, botnya masih hidup?" },
  { from: "14155550142", name: "Marco", body: "send me the deck when you can 🙏" },
  { from: "6289988776655", name: "Ayu", body: "!status" },
  { from: "447700900123", name: "Theo", body: "sticker received lol" },
  { from: "919812345678", name: "Dev", body: "poll closed — nice work" },
];

/**
 * Push one inbound message onto a live session. This is the `messages.upsert`
 * side of the stream: the panel calls it on an interval so a connected device
 * visibly receives traffic.
 */
export const receiveMessage = mutation({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return;
    if (session.status !== "connected") return;

    const now = Date.now();
    const pick = INBOUND_SAMPLES[Math.floor(Math.random() * INBOUND_SAMPLES.length)];
    const autoReply = session.autoReply === true && (session.prefix ?? "") !== "";
    const body = autoReply
      ? `${session.prefix} received — an agent will be with you shortly.`
      : pick.body;

    await ctx.db.insert("waMessages", {
      sessionId: session._id,
      direction: "inbound",
      jid: `${pick.from}@s.whatsapp.net`,
      pushName: pick.name,
      body,
      kind: Math.random() > 0.78 ? "sticker" : "text",
      status: "delivered",
      createdAt: now,
    });
    await ctx.db.patch(session._id, {
      messagesReceived: session.messagesReceived + 1,
      lastSeenAt: now,
    });
    await ctx.db.insert("sessionLogs", {
      sessionId: session._id,
      level: "info",
      message: `[messages.upsert] ${pick.name} <${pick.from}> — ${truncate(body, 48)}`,
      createdAt: now,
    });
  },
});

/** Nudge the live socket's resource meters, Pterodactyl style. */
export const sampleMeters = mutation({
  args: { sessionId: v.id("waSessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) return;
    if (session.status !== "connected") return;

    const phase = (Date.now() / 8_000) % (Math.PI * 2);
    await ctx.db.patch(session._id, {
      cpu: Math.round(
        Math.max(4, Math.min(96, 24 + Math.sin(phase) * 12 + Math.random() * 14)),
      ),
      memoryMb: Math.round(
        Math.max(
          96,
          Math.min(480, 150 + Math.sin(phase / 2) * 24 + Math.random() * 20),
        ),
      ),
      lastSeenAt: Date.now(),
    });
  },
});

/** Panel command: toggle the auto-reply on a session. */
export const setAutoReply = mutation({
  args: { sessionId: v.id("waSessions"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const session = await ctx.db.get(args.sessionId);
    if (session === null || session.ownerId !== userId) {
      throw new Error("Session not found");
    }
    await ctx.db.patch(session._id, { autoReply: args.enabled });
    await ctx.db.insert("sessionLogs", {
      sessionId: session._id,
      level: "info",
      message: `[kaizen] auto-reply ${args.enabled ? "enabled" : "disabled"}`,
      createdAt: Date.now(),
    });
  },
});
