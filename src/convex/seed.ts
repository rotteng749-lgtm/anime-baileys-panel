import { mutation } from "./_generated/server";
import { seedEggs, seedRuntimes } from "./eggsSeed";
import { seedInfrastructure } from "./infraSeed";
import { backfillServerRows } from "./infrastructure";
import { ensureDefaultAdmin } from "./admin";

/**
 * Seeds everything a fresh install needs before anything else makes sense:
 * the base runtimes an egg can target, the nests, nodes and allocations a
 * server is placed on, and a set of starter eggs that already ship real,
 * runnable files.
 *
 * Every step is idempotent — it only fills in what is missing.
 */

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const runtimes = await seedRuntimes(ctx);
    const infrastructure = await seedInfrastructure(ctx);
    const eggs = await seedEggs(ctx);
    // Runs after the nodes exist, so a session can claim a free ip:port.
    const backfilled = await backfillServerRows(ctx);
    // The panel needs an operator before the admin area is usable at all.
    const admin = await ensureDefaultAdmin(ctx);
    return { runtimes, infrastructure, eggs, backfilled, admin };
  },
});
