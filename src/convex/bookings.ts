import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Scheduling.
 *
 * Sessions are the scarce resource: one operator, one calendar. Booking a slot
 * is how someone claims time to talk through a migration, a campaign or a
 * flaky number, and the admin confirms it from the admin area.
 */

/** Working hours, in 30-minute blocks. */
export const SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
] as const;

/** The next 21 weekdays, as ISO dates. */
export const listAvailability = query({
  args: {},
  handler: async (ctx) => {
    const taken = await ctx.db.query("bookings").collect();
    const booked = new Map<string, Set<string>>();
    for (const b of taken) {
      if (b.status === "cancelled") continue;
      const set = booked.get(b.date) ?? new Set<string>();
      set.add(b.slot);
      booked.set(b.date, set);
    }

    const days: Array<{ date: string; weekday: string; slots: string[] }> = [];
    const cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    while (days.length < 21) {
      cursor.setDate(cursor.getDate() + 1);
      const dow = cursor.getDay();
      if (dow === 0 || dow === 6) continue;
      const iso = cursor.toISOString().slice(0, 10);
      const used = booked.get(iso) ?? new Set<string>();
      days.push({
        date: iso,
        weekday: cursor.toLocaleDateString("en-US", { weekday: "short" }),
        slots: SLOTS.filter((s) => !used.has(s)),
      });
    }
    return days;
  },
});

export const createBooking = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    date: v.string(),
    slot: v.string(),
    topic: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new Error("Pick a date from the calendar");
    }
    if (!(SLOTS as readonly string[]).includes(args.slot)) {
      throw new Error("Pick one of the listed times");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email.trim())) {
      throw new Error("Enter a valid email address");
    }
    const topic = args.topic.trim();
    if (topic.length < 3) throw new Error("What should we cover?");

    // One person per slot.
    const clash = await ctx.db
      .query("bookings")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    if (clash.some((b) => b.slot === args.slot && b.status !== "cancelled")) {
      throw new Error("That slot was just taken — pick another");
    }

    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("bookings", {
      userId: userId ?? undefined,
      name: args.name.trim() || "Guest",
      email: args.email.trim(),
      date: args.date,
      slot: args.slot,
      topic,
      notes: args.notes?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/** Bookings made by the signed-in member. */
export const myBookings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Cancel one of your own bookings. */
export const cancelBooking = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (booking === null) return;
    if (userId === null || booking.userId !== userId) {
      throw new Error("That booking is not yours");
    }
    await ctx.db.patch(booking._id, { status: "cancelled" });
  },
});
