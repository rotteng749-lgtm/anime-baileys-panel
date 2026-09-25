import { KaizenWordmark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { clearAdminToken, readAdminToken } from "@/lib/admin-token";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils";
import {
  Boxes,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  Radio,
  Users,
} from "lucide-react";
import { type ReactNode } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";

const NAV = [
  { to: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/catalog", label: "Catalog", icon: Boxes },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarClock },
  { to: "/admin/posts", label: "Posts", icon: MessagesSquare },
  { to: "/admin/inbox", label: "Inbox", icon: Radio },
  { to: "/admin/members", label: "Members", icon: Users },
] as const;

/**
 * The admin area.
 *
 * Guarded separately from the member panel: the shell checks the bearer token
 * against the server before rendering anything, and bounces to the sign-in
 * screen if it is missing or expired.
 */
export function AdminShell() {
  const token = readAdminToken();
  const me = useQuery(api.admin.adminMe, token ? { token } : "skip");
  const signOut = useMutation(api.admin.signOut);
  const navigate = useNavigate();

  if (!token) return <Navigate to="/admin" replace />;
  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs text-mist">Checking session…</p>
      </div>
    );
  }
  if (!me.ok) {
    clearAdminToken();
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="relative min-h-screen">
      <div className="anime-grid pointer-events-none fixed inset-0 opacity-50" />
      <div className="ash-mist pointer-events-none fixed inset-0" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-abyss/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3 sm:px-8">
          <KaizenWordmark compact />
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.3em] text-ember sm:inline">
            Admin
          </span>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/5 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <item.icon className="size-3.5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={async () => {
              if (token) await signOut({ token });
              clearAdminToken();
              navigate("/admin");
            }}
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/40 px-5 py-2 lg:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-white/5 text-foreground"
                    : "text-muted-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}

/** Heading block shared by every admin section. */
export function AdminHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-ember">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
