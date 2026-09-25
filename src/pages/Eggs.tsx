import { SectionTag } from "@/components/Brand";
import { EggCard } from "@/components/eggs/EggCard";
import { EmptyState } from "@/components/panel/Parts";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Box,
  Cpu,
  PackageCheck,
  Search,
  Terminal,
  X,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { useEggsReady } from "@/hooks/use-eggs";
import { cn } from "@/lib/utils";

export default function Eggs() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [nest, setNest] = useState<string | undefined>();
  const deferred = useDeferredValue(search);

  const categories = useQuery(api.eggs.listCategories, {});
  const runtimes = useQuery(api.eggs.listRuntimes, {});
  const nests = useQuery(api.infrastructure.listNests, {});
  const eggs = useQuery(api.eggs.listEggs, {
    search: deferred || undefined,
    category,
  });

  // The nest filter is a client-side grouping: the query returns the shelf, the
  // chips decide which one you are looking at.
  const onNest = (eggs ?? []).filter((e) => !nest || e.nestId === nest);

  useEggsReady(eggs?.length, runtimes?.length);

  return (
    <div className="relative min-h-screen">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-40" />

      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="max-w-2xl"
        >
          <SectionTag tone="ember">Eggs</SectionTag>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Bot templates that{" "}
            <span className="gradient-text">ship real files.</span>
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Each egg is a manifest, an install script and a set of files — the
            scripts, config and a README, laid onto a session when you install
            it. Read them before you take one.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/eggs/publish">
                <PackageCheck className="size-4" />
                Ship your own
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/wings">
                <Terminal className="size-4" />
                How wings runs them
              </Link>
            </Button>
          </div>
        </motion.div>

        <div className="mt-10 flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mist" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blast, webhook, starter…"
              className="h-12 pl-10 pr-10 text-base"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-mist transition-colors hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip active={nest === undefined} onClick={() => setNest(undefined)}>
              All nests
            </Chip>
            {(nests ?? []).map((n) => (
              <Chip
                key={n._id}
                active={nest === n._id}
                onClick={() => setNest(nest === n._id ? undefined : n._id)}
              >
                <span className="mr-1.5">{n.emoji}</span>
                {n.name}
                <span className="ml-1.5 text-[10px] opacity-60">{n.eggCount}</span>
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-mist">
              category
            </span>
            <Chip active={category === undefined} onClick={() => setCategory(undefined)}>
              All
            </Chip>
            {(categories ?? []).map((c) => (
              <Chip
                key={c.name}
                active={category === c.name}
                onClick={() => setCategory(c.name)}
              >
                {c.name}
                <span className="ml-1.5 text-[10px] opacity-60">{c.count}</span>
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_260px]">
          <div>
            {eggs === undefined ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="slab h-60 animate-pulse opacity-60" />
                ))}
              </div>
            ) : onNest.length === 0 ? (
              <EmptyState
                icon={Box}
                title="No eggs match that"
                description={
                  search
                    ? `Nothing for "${search}". Try a broader term or clear the filters.`
                    : "No eggs on this shelf yet."
                }
              />
            ) : (
              <>
                <p className="mb-4 text-xs text-mist">
                  {onNest.length} {onNest.length === 1 ? "egg" : "eggs"}
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  {onNest.map((egg, i) => (
                    <EggCard key={egg._id} egg={egg} index={i} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Runtimes */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="slab p-5">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-neon" />
                <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
                  Runtimes
                </h2>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                The base an egg is built against, the way a base image sits
                under a game egg.
              </p>
              <div className="mt-4 space-y-2">
                {(runtimes ?? []).map((r) => (
                  <div
                    key={r._id}
                    className="stat-chip px-3 py-2.5"
                  >
                    <p className="text-xs font-bold">{r.label}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-mist">
                      baileys {r.baileysVersion}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "clip-shuriken border px-4 py-1.5 text-xs font-bold tracking-wide transition-all",
        active
          ? "border-neon/50 bg-neon/12 text-neon shadow-[0_0_18px_-6px_oklch(0.78_0.16_200/80%)]"
          : "border-edge text-muted-foreground hover:border-edge-strong hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
