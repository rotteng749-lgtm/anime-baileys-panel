import { mutation } from "./_generated/server";
import { seedEggs, seedRuntimes } from "./eggsSeed";

/**
 * Seeds the two things a fresh install needs before anything else makes
 * sense: the base runtimes an egg can target, and a set of starter eggs that
 * already ship real, runnable files.
 *
 * Both are idempotent — they only fill in what is missing.
 */

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    const runtimes = await seedRuntimes(ctx);
    const eggs = await seedEggs(ctx);
    return { runtimes, eggs };
  },
});
