import { randomToken, slugify } from "./infrastructure";

/**
 * Nests, nodes and allocations.
 *
 * Idempotent, like every other seed here: a deployment that already has a node
 * keeps it, and a fresh one gets a node with a wings token it can actually use.
 */

/** The shelves an egg lives on. The nest is the first thing you pick. */
export const NESTS = [
  {
    slug: "whatsapp-bots",
    name: "WhatsApp Bots",
    description:
      "Agents that answer on a linked number: keyword responders, blast runners, bridges.",
    emoji: "💬",
    accent: "neon" as const,
  },
  {
    slug: "commerce",
    name: "Commerce",
    description:
      "Order intake, catalogue replies, payment nudges and delivery updates.",
    emoji: "🛒",
    accent: "ember" as const,
  },
  {
    slug: "community",
    name: "Community",
    description:
      "Group moderation, welcome flows, raid defence and announcement bots.",
    emoji: "🛡️",
    accent: "holo" as const,
  },
  {
    slug: "developer",
    name: "Developer",
    description:
      "Building blocks: webhooks, queues, AI bridges and anything custom.",
    emoji: "🛠️",
    accent: "sakura" as const,
  },
  {
    slug: "media",
    name: "Media",
    description:
      "Downloaders, converters and anything that moves a file out of a chat.",
    emoji: "🎬",
    accent: "sakura" as const,
  },
];

/** Where the eggs filed under each nest actually live. */
export const EGG_NEST: Record<string, string> = {
  "starter-bot": "whatsapp-bots",
  "blast-runner": "commerce",
  "auto-reply-pack": "whatsapp-bots",
  "webhook-bridge": "developer",
  "kaizen-bot": "whatsapp-bots",
  "group-guard": "community",
  "media-grabber": "media",
};

/**
 * The node this deployment ships with.
 *
 * A real one is a VPS running the wings daemon; this is the same record with a
 * token the panel accepts, so the API is exercisable out of the box. The token
 * is fixed so the docs can show a working curl, and it is stored hashed.
 */
export const DEFAULT_NODE_TOKEN = "wings_demo_node_token_change_me";

export const NODES = [
  {
    id: "node-jkt-01",
    name: "Jakarta 01",
    location: "Jakarta, ID",
    fqdn: "jkt1.baileys.example",
    totalMemoryMb: 8192,
    totalDiskMb: 102400,
    totalCpu: 4,
  },
];

/** Ports a node hands out, one per server. */
const PORT_RANGE = [4500, 4501, 4502, 4503, 4504, 4505, 4506, 4507];

async function digest(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type SeedCtx = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
};

/** Nests, nodes and the allocations that go with them. */
export async function seedInfrastructure(ctx: SeedCtx) {
  let added = 0;

  const nestRows = (await ctx.db.query("nests").collect()) as {
    _id: string;
    slug: string;
  }[];
  const nestsBySlug = new Map(nestRows.map((n) => [n.slug, n._id]));

  for (const nest of NESTS) {
    if (nestsBySlug.has(nest.slug)) continue;
    const id = await ctx.db.insert("nests", { ...nest, createdAt: Date.now() });
    nestsBySlug.set(nest.slug, id);
    added += 1;
  }

  const nodeRows = (await ctx.db.query("nodes").collect()) as {
    _id: string;
    id: string;
  }[];
  const nodesById = new Map(nodeRows.map((n) => [n.id, n._id]));

  for (const node of NODES) {
    if (nodesById.has(node.id)) continue;
    const nodeId = await ctx.db.insert("nodes", {
      ...node,
      scheme: "https",
      tokenPrefix: DEFAULT_NODE_TOKEN.slice(0, 12),
      tokenHash: await digest(DEFAULT_NODE_TOKEN),
      daemonVersion: "1.0.0",
      online: true,
      lastSeenAt: Date.now(),
      createdAt: Date.now(),
    });
    nodesById.set(node.id, nodeId);

    const ip = `10.${20 + nodesById.size}.0.1`;
    for (const [i, port] of PORT_RANGE.entries()) {
      await ctx.db.insert("allocations", {
        nodeId,
        ip,
        port,
        portRange: [port + 100, port + 200],
        assigned: false,
        createdAt: Date.now() - i,
      });
      added += 1;
    }
  }

  // File the shipped eggs under their nests, now that the nests exist.
  const eggRows = (await ctx.db.query("eggs").collect()) as {
    _id: string;
    slug: string;
    nestId?: string;
  }[];
  for (const egg of eggRows) {
    if (egg.nestId) continue;
    const nestId = nestsBySlug.get(EGG_NEST[egg.slug]);
    if (nestId) await ctx.db.patch(egg._id as never, { nestId });
  }

  return added;
}

export { slugify, randomToken };
