import { AdminHead } from "@/components/admin/AdminShell";
import { BookingBadge } from "@/pages/Dashboard";
import { Button } from "@/components/ui/button";
import { readAdminToken } from "@/lib/admin-token";
import { useMutation, useQuery } from "convex/react";
import { CalendarClock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";

export default function AdminBookings() {
  const token = readAdminToken() ?? "";
  const bookings = useQuery(api.admin.listAllBookings, { token });
  const setStatus = useMutation(api.admin.setBookingStatus);

  const set = (id: string, status: "confirmed" | "cancelled") => {
    void setStatus({ token, id: id as never, status }).then(() =>
      toast.success(status === "confirmed" ? "Confirmed" : "Slot freed"),
    );
  };

  return (
    <div>
      <AdminHead
        eyebrow="Admin · Schedule"
        title="Bookings"
        description="Requests made through the public booking page. Confirming one holds the slot; cancelling returns it to the calendar."
      />

      {(bookings ?? []).length === 0 ? (
        <div className="slab p-10 text-center text-sm text-muted-foreground">
          No bookings yet. Requests appear here the moment someone books a
          slot.
        </div>
      ) : (
        <div className="space-y-3">
          {(bookings ?? []).map((b) => (
            <div key={b._id} className="slab p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-display text-lg font-bold">
                      {b.date}
                    </span>
                    <span className="font-mono text-sm text-ember">
                      {b.slot}
                    </span>
                    <BookingBadge status={b.status} />
                  </div>
                  <p className="mt-1.5 text-sm font-semibold">{b.topic}</p>
                  <p className="mt-0.5 text-xs text-mist">
                    {b.name} · {b.email}
                  </p>
                  {b.notes && (
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {b.notes}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  {b.status !== "confirmed" && (
                    <Button
                      size="sm"
                      onClick={() => set(b._id, "confirmed")}
                    >
                      <Check className="size-3" />
                      Confirm
                    </Button>
                  )}
                  {b.status !== "cancelled" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-300 hover:bg-rose-500/10"
                      onClick={() => set(b._id, "cancelled")}
                    >
                      <X className="size-3" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-mist">
        <CalendarClock className="size-3.5" />
        Booked slots are held automatically — the public calendar will not offer
        them again.
      </p>
    </div>
  );
}
