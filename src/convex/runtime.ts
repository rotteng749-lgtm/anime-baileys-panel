"use node";

import { v } from "convex/values";
import type { GenericId } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * The wings agent contract, as actions.
 *
 * The database half lives in `runtimeDb.ts`; this half exists because
 * delivering a webhook is a network call, and Convex only lets a Node action
 * make one. So the agent's events land here, get written down, and — in the
 * same pass — are pushed to whatever endpoints asked to hear about them.
 *
 * Nothing here decides socket state. It records what the agent reported and
 * forwards it outward.
 */

/** How long a receiver gets before the delivery counts as failed. */
const DELIVERY_TIMEOUT_MS = 8_000;

type Delivery = {
  webhookId?: GenericId<"webhooks">;
  ownerId: GenericId<"users">;
  sessionId?: GenericId<"waSessions">;
  event: string;
  url: string;
  payload: unknown;
};

type DeliveryResult = {
  webhookId?: GenericId<"webhooks">;
  ownerId: GenericId<"users">;
  sessionId?: GenericId<"waSessions">;
  event: string;
  url: string;
  ok: boolean;
  statusCode?: number;
  detail?: string;
  durationMs: number;
};

/** POST a payload, and never throw: a dead endpoint is a fact, not a crash. */
async function post(
  url: string,
  payload: unknown,
  event: string,
): Promise<{ ok: boolean; status: number; detail: string; durationMs: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "kaizen-wings/1.0 (+baileys-runtime)",
        "x-kaizen-event": event,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.text().catch(() => "");
    return {
      ok: response.ok,
      status: response.status,
      detail: body.slice(0, 240),
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: String(error instanceof Error ? error.message : error).slice(0, 240),
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Presence plus the servers this agent should be holding. */
export const heartbeat = action({
  args: {
    token: v.string(),
    name: v.string(),
    version: v.string(),
    sessions: v.number(),
    pid: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(api.runtimeDb.heartbeat, args);
  },
});

/** Claim queued commands: power verbs, sends, pairing refreshes, installs. */
export const poll = action({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(api.runtimeDb.poll, args);
  },
});

/** Report what actually happened. */
export const ack = action({
  args: {
    token: v.string(),
    commandId: v.string(),
    status: v.union(v.literal("done"), v.literal("error")),
    result: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    return await ctx.runMutation(api.runtimeDb.ack, args);
  },
});

/**
 * A real Baileys event, straight off the socket.
 *
 * `connection.update`, `messages.upsert`, `creds.update`, receipts, meters,
 * power transitions and install transcripts all arrive here. The row is
 * written first, then the webhooks are rung — so a receiver that was down when
 * the event happened still shows up as a failed delivery instead of a gap.
 */
export const event = action({
  args: {
    token: v.string(),
    uuid: v.optional(v.string()),
    event: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; delivered: number }> => {
    const applied = (await ctx.runMutation(api.runtimeDb.applyEvent, args)) as unknown as {
      deliveries?: Delivery[];
    };

    const deliveries = applied.deliveries ?? [];
    if (deliveries.length === 0) return { ok: true, delivered: 0 };

    const results: DeliveryResult[] = [];
    for (const delivery of deliveries) {
      const result = await post(delivery.url, delivery.payload, delivery.event);
      results.push({
        webhookId: delivery.webhookId,
        ownerId: delivery.ownerId,
        sessionId: delivery.sessionId,
        event: delivery.event,
        url: delivery.url,
        ok: result.ok,
        statusCode: result.status,
        detail: result.detail,
        durationMs: result.durationMs,
      });
    }

    await ctx.runMutation(api.runtimeDb.recordDeliveries, {
      token: args.token,
      results,
    });

    return { ok: true, delivered: results.length };
  },
});

/**
 * Fire one event at one endpoint, so "is my receiver wired up?" is a button
 * rather than a guess.
 */
export const webhookTest = action({
  args: { webhookId: v.id("webhooks") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; status: number; detail: string; durationMs: number }> => {
    const hook = await ctx.runQuery(api.runtimeDb.webhookForTest, {
      webhookId: args.webhookId,
    });
    if (hook === null) throw new Error("That endpoint is not yours");

    const now = Date.now();
    const payload = {
      id: `evt_${now.toString(36)}_test`,
      event: "ping",
      delivered_at: now,
      server: null,
      data: {
        test: true,
        message: "Kaizen panel — test delivery. Your endpoint is reachable.",
      },
    };

    const result = await post(hook.url, payload, "ping");
    await ctx.runMutation(api.keys.recordTestDelivery, {
      webhookId: args.webhookId,
      ok: result.ok,
      statusCode: result.status,
      detail: result.detail,
      durationMs: result.durationMs,
    });

    return {
      ok: result.ok,
      status: result.status,
      detail: result.detail,
      durationMs: result.durationMs,
    };
  },
});
