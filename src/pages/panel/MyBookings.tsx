import { EmptyState } from "@/components/panel/Parts";
import { PageHead } from "@/components/panel/Shell";
import { BookingBadge } from "@/pages/Dashboard";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { CalendarPlus, CalendarX2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";

export default function MyBookings() {
  const bookings = useQuery(api.bookings.myBookings, {});
  const cancel = useMutation(api.bookings.cancelBooking);

  return (
    <div>
      <PageHead
        eyebrow="Yours"
        title="Your bookings"
        description="Slots you have requested. Confirmed ones are locked in; pending ones are waiting on a reply."
        actions={
          <Button asChild>
            <Link to="/book">
              <CalendarPlus className="size-4" />
              Book another
            </Link>
          </Button>
        }
      />

      {(bookings ?? []).length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No bookings yet"
          description="Book a half hour to talk through a migration, a flaky number, or a campaign that needs pacing."
          action={
            <Button asChild>
              <Link to="/book">
                <CalendarPlus className="size-4" />
                Find a slot
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(bookings ?? []).map((b) => (
            <div key={b._id} className="slab flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">
                    {b.date} <span className="text-ember">{b.slot}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-mist">
                    booked by {b.name} · {b.email}
                  </p>
                </div>
                <BookingBadge status={b.status} />
              </div>

              <p className="mt-4 text-sm font-semibold">{b.topic}</p>
              {b.notes && (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {b.notes}
                </p>
              )}

              {b.status !== "cancelled" && (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-300 hover:bg-rose-500/10"
                    onClick={() => {
                      void cancel({ bookingId: b._id });
                      toast.success("Booking cancelled");
                    }}
                  >
                    <CalendarX2 className="size-3" />
                    Cancel this slot
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
