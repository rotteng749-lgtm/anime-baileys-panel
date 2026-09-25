import { AdminHead } from "@/components/admin/AdminShell";
import { readAdminToken } from "@/lib/admin-token";
import { useQuery } from "convex/react";
import { Smartphone, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";

export default function AdminMembers() {
  const token = readAdminToken() ?? "";
  const members = useQuery(api.admin.listMembers, { token });

  return (
    <div>
      <AdminHead
        eyebrow="Admin · Accounts"
        title="Members"
        description="Everyone with an account. Each one owns their own devices, posts and bookings."
      />

      {(members ?? []).length === 0 ? (
        <div className="slab p-10 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-3 size-6 text-mist" />
          No accounts yet.
        </div>
      ) : (
        <div className="well divide-y divide-white/5">
          {(members ?? []).map((m) => (
            <div key={m._id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon/30 to-holo/30 text-xs font-bold">
                {(m.name ?? m.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {m.name ?? "Unnamed member"}
                </p>
                <p className="truncate text-[11px] text-mist">{m.email}</p>
              </div>
              {m.role && (
                <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] font-bold uppercase text-mist">
                  {m.role}
                </span>
              )}
              <span className="shrink-0 font-mono text-[10px] text-mist">
                {m.emailVerificationTime ? "verified" : "pending"}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-mist">
        <Smartphone className="size-3.5" />
        Member passwords are handled by the member auth system; the admin area
        only ever stores its own salted digest.
      </p>
    </div>
  );
}
