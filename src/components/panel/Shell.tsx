import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  Activity,
  Boxes,
  Cable,
  CalendarClock,
  FileStack,
  KeyRound,
  LogOut,
  MessagesSquare,
  Radio,
  Settings2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { KaizenWordmark, SectionTag } from "@/components/Brand";

/**
 * The panel chrome, modelled on a game-server panel: a fixed left rail, a
 * status bar along the top, and nested routes for each section. The rail is
 * drawn as an extruded slab so the whole app reads as one physical console.
 */

const NAV = [
  { to: "/dashboard", label: "Overview", icon: Activity, end: true },
  { to: "/dashboard/sessions", label: "Sessions", icon: Cable },
  { to: "/dashboard/console", label: "Console", icon: Radio },
  { to: "/dashboard/messages", label: "Messages", icon: MessagesSquare },
  { to: "/dashboard/webhooks", label: "Webhooks", icon: Boxes },
  { to: "/dashboard/keys", label: "API Keys", icon: KeyRound },
  { to: "/dashboard/posts", label: "Your posts", icon: FileStack },
  { to: "/dashboard/bookings", label: "Bookings", icon: CalendarClock },
] as const;

export function PanelShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="anime-grid pointer-events-none fixed inset-0 opacity-60" />

      <div className="relative flex min-h-screen">
        {/* ---- Rail ---- */}
        <aside
          className={cn(
            "rail fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-5 py-5">
            <Link to="/dashboard" onClick={() => setOpen(false)}>
              <KaizenWordmark />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-mist transition-colors hover:bg-white/10 hover:text-foreground lg:hidden"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-edge-strong to-transparent" />

          <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-mist">
              Control
            </p>
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : false}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "btn-3d text-foreground"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r bg-neon shadow-[0_0_10px_oklch(0.8_0.16_200)]" />
                      )}
                      <Icon
                        className={cn(
                          "size-4 transition-colors",
                          isActive ? "text-neon" : "text-mist group-hover:text-mist",
                        )}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border/60 p-3">
            <div className="stat-chip flex items-center gap-3 p-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-neon/30 to-holo/30 text-xs font-bold text-foreground">
                {(user?.name ?? user?.email ?? "K").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  {user?.name ?? "Operator"}
                </p>
                <p className="truncate text-[10px] text-mist">
                  {user?.email ?? "signed in"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="rounded-md p-1.5 text-mist transition-colors hover:bg-rose-500/15 hover:text-rose-300"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {open && (
          <button
            type="button"
            aria-label="Close navigation overlay"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-abyss/70 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* ---- Main ---- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-abyss/80 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="btn-3d flex size-9 items-center justify-center lg:hidden"
                aria-label="Open navigation"
              >
                <Settings2 className="size-4" />
              </button>

              <div className="min-w-0 flex-1">
                <Breadcrumbs path={location.pathname} />
              </div>

              <SectionTag tone="ember" className="hidden sm:inline-flex">
                baileys 6.x
              </SectionTag>
            </div>
          </header>

          <main className="relative flex-1 px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

const CRUMBS: Record<string, string> = {
  dashboard: "Overview",
  sessions: "Sessions",
  console: "Console",
  messages: "Messages",
  webhooks: "Webhooks",
  keys: "API Keys",
  posts: "Your posts",
  bookings: "Bookings",
};

function Breadcrumbs({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);
  const title = CRUMBS[parts[1] ?? "dashboard"] ?? "Overview";
  return (
    <div className="flex min-w-0 items-center gap-2">          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-mist">
            Panel
          </span>
      <span className="text-mist/60">/</span>
      <span className="truncate font-display text-sm font-bold tracking-wide">
        {title}
      </span>
    </div>
  );
}

/** Page heading used at the top of each panel section. */
export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <SectionTag>{eyebrow}</SectionTag>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
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
