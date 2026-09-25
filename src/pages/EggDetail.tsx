import { SectionTag } from "@/components/Brand";
import { ACCENT_STYLES, type AccentKey } from "@/components/catalog/CatalogCard";
import { FileTree } from "@/components/eggs/FileTree";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Cpu,
  Download,
  Loader2,
  Play,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useEggsReady } from "@/hooks/use-eggs";
import { useInstallFlow } from "@/hooks/use-install";
import { useAuth } from "@/hooks/use-auth";
import type { SessionId } from "@/hooks/use-panel";
import { cn } from "@/lib/utils";

export default function EggDetail() {
  const { slug = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const egg = useQuery(api.eggs.getEgg, { slug });
  const eggs = useQuery(api.eggs.listEggs, {});
  const runtimes = useQuery(api.eggs.listRuntimes, {});
  const sessions = useQuery(
    api.sessions.listSessions,
    isAuthenticated ? {} : "skip",
  );
  const { install, installing, installId, variables, setVariable } =
    useInstallFlow();

  useEggsReady(eggs?.length, runtimes?.length);

  if (egg === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-mist" />
      </div>
    );
  }

  if (egg === null) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 text-center">
          <h1 className="font-display text-3xl font-bold">That egg is not here</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            It may still be waiting for review, or the link is mistyped.
          </p>
          <Button variant="outline" className="mt-7" asChild>
            <Link to="/eggs">
              <ArrowLeft className="size-4" />
              Back to the eggs
            </Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const accent =
    ACCENT_STYLES[(egg.accent as AccentKey) in ACCENT_STYLES
      ? (egg.accent as AccentKey)
      : "neon"];

  const target = variables.__sessionId ?? "";

  return (
    <div className="relative min-h-screen">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-40" />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <Link
          to="/eggs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Eggs
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]"
        >
          <div>
            <div className="flex items-center gap-2">
              <SectionTag tone={accent.tag}>{egg.category}</SectionTag>
              {egg.official && (
                <span className="flex items-center gap-1 rounded-full border border-neon/30 px-2 py-0.5 text-[10px] font-semibold text-neon">
                  <ShieldCheck className="size-3" />
                  official
                </span>
              )}
            </div>

            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight">
              {egg.name}
            </h1>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {egg.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-mist">
              <span className="flex items-center gap-1.5">
                <Download className="size-3.5" />
                {egg.installs} installs
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="size-3.5" />
                {egg.runtime}
              </span>
              <span>by {egg.author}</span>
            </div>

            <div className="rune-rule my-8" />

            <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
              Manifest
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { k: "Startup", v: egg.startup, mono: true },
                { k: "Install", v: egg.installScript, mono: true },
                { k: "Runtime", v: egg.runtime, mono: true },
                {
                  k: "Environment",
                  v: (egg.env ?? []).join(", ") || "none",
                  mono: true,
                },
              ].map((row) => (
                <div key={row.k} className="stat-chip px-4 py-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-mist">
                    {row.k}
                  </dt>
                  <dd
                    className={cn(
                      "mt-1.5 text-sm",
                      row.mono && "font-mono text-xs",
                    )}
                  >
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>

            <h2 className="mt-8 font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
              Shipped files
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              These land on the session when you install. Read them first — you
              are about to run this code.
            </p>
            <FileTree className="mt-4" files={egg.files} />
          </div>

          {/* Install rail */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className={cn("slab p-6", accent.glow)}>
              <h2 className="font-display text-lg font-bold">Install</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Picks a session, writes the files, then runs the install script.
              </p>

              {!isAuthenticated ? (
                <Button className="mt-5 w-full" asChild>
                  <Link to={`/auth?returnTo=/eggs/${egg.slug}`}>
                    Sign in to install
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (sessions ?? []).length === 0 ? (
                <p className="mt-5 rounded-lg border border-edge bg-abyss/40 p-4 text-xs text-muted-foreground">
                  You have no sessions yet.{" "}
                  <Link to="/dashboard" className="font-semibold text-neon">
                    Create one →
                  </Link>
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="egg-session">Session</Label>
                    <select
                      id="egg-session"
                      value={target}
                      onChange={(e) =>
                        setVariable("__sessionId", e.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-input bg-gradient-to-b from-abyss/70 to-abyss/40 px-3 text-sm outline-none"
                    >
                      <option value="" className="bg-surface">
                        Choose a session…
                      </option>
                      {(sessions ?? []).map((s) => (
                        <option key={s._id} value={s._id} className="bg-surface">
                          {s.name} — {s.status}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(egg.env ?? []).map((entry) => {
                    const key = entry.split("=")[0];
                    return (
                      <div key={key} className="space-y-2">
                        <Label htmlFor={`var-${key}`}>{key}</Label>
                        <Input
                          id={`var-${key}`}
                          value={variables[key] ?? ""}
                          onChange={(e) => setVariable(key, e.target.value)}
                          placeholder={entry}
                        />
                      </div>
                    );
                  })}

                  <Button
                    className="w-full"
                    disabled={!target || installing}
                    onClick={async () => {
                      const id = await install({
                        sessionId: target as SessionId,
                        eggSlug: egg.slug,
                        variables: Object.entries(variables)
                          .filter(([k, v]) => !k.startsWith("__") && v)
                          .map(([k, v]) => `${k}=${v}`),
                      });
                      if (id) {
                        toast.success("Install queued — watch it run");
                      }
                    }}
                  >
                    {installing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Queueing…
                      </>
                    ) : (
                      <>
                        <Play className="size-4" />
                        Install on session
                      </>
                    )}
                  </Button>

                  {installId && (
                    <Link
                      to={`/dashboard/console?session=${target}&install=${installId}`}
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold text-neon transition-colors hover:text-ember"
                    >
                      <Terminal className="size-3.5" />
                      Watch the install log
                    </Link>
                  )}
                </div>
              )}

              <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-mist">
                <Box className="mt-0.5 size-3 shrink-0" />
                Installing lays the egg&apos;s files onto the session. You can
                edit or remove any of them afterwards in the file manager.
              </p>
            </div>
          </aside>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
}
