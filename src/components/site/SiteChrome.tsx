import { KaizenWordmark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, LogIn, Mail, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/catalog", label: "Catalog" },
  { to: "/eggs", label: "Eggs" },
  { to: "/wings", label: "Wings" },
  { to: "/docs", label: "Docs" },
  { to: "/book", label: "Book a slot" },
  { to: "/contact", label: "Contact" },
] as const;

/** Public site chrome. The admin sign-in lives behind its own door. */
export function SiteHeader() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-abyss/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link to="/" className="shrink-0">
          <KaizenWordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(link.to)
                  ? "bg-white/5 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin">
              <ShieldCheck className="size-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </Button>
          {isAuthenticated ? (
            <Button size="sm" asChild>
              <Link to="/dashboard">
                <LayoutDashboard className="size-3.5" />
                Panel
              </Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth?returnTo=/dashboard">
                <LogIn className="size-3.5" />
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-9 sm:flex-row sm:px-8">
        <KaizenWordmark compact />
        <p className="max-w-md text-center text-xs leading-relaxed text-mist">
          A self-hosted WhatsApp automation panel. Unofficial — not affiliated
          with WhatsApp or Meta.
        </p>
        <div className="flex items-center gap-4 text-xs">
          <Link
            to="/book"
            className="font-semibold text-neon transition-colors hover:text-ember"
          >
            Book a slot
          </Link>
          <Link
            to="/contact"
            className="flex items-center gap-1.5 font-semibold text-mist transition-colors hover:text-foreground"
          >
            <Mail className="size-3" />
            Contact
          </Link>
          <a
            href="https://github.com/whiskeysockets/Baileys"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-mist transition-colors hover:text-foreground"
          >
            Baileys
          </a>
        </div>
      </div>
    </footer>
  );
}
