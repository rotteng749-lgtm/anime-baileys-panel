import { CatalogCard } from "@/components/catalog/CatalogCard";
import { SectionTag } from "@/components/Brand";
import { EmptyState } from "@/components/panel/Parts";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Input } from "@/components/ui/input";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { BookMarked, Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useStarterCatalog } from "@/hooks/use-panel";
import { cn } from "@/lib/utils";

type Sort = "popular" | "new";

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [sort, setSort] = useState<Sort>("popular");
  const deferred = useDeferredValue(search);

  const categories = useQuery(api.catalog.listCategories, {});
  const items = useQuery(api.catalog.listItems, {
    search: deferred || undefined,
    category,
    sort,
  });
  useStarterCatalog(items?.length);

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
          <SectionTag tone="ember">Catalog</SectionTag>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Pieces you install on{" "}
            <span className="gradient-text">your own panel.</span>
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Every entry here runs against your linked devices. Nothing is
            rented, nothing phones home — read what it does, install it, and it
            works the same on your deployment as it does here.
          </p>
        </motion.div>

        {/* Search + filters */}
        <div className="mt-10 flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mist" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blast, receipts, webhooks…"
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
            <FilterChip
              active={category === undefined}
              onClick={() => setCategory(undefined)}
            >
              All
            </FilterChip>
            {(categories ?? []).map((c) => (
              <FilterChip
                key={c.name}
                active={category === c.name}
                onClick={() => setCategory(c.name)}
              >
                {c.name}
                <span className="ml-1.5 text-[10px] opacity-60">{c.count}</span>
              </FilterChip>
            ))}

            <div className="ml-auto flex items-center gap-1 rounded-lg border border-edge p-1">
              {(
                [
                  { id: "popular", label: "Most installed" },
                  { id: "new", label: "Newest" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    sort === opt.id
                      ? "bg-neon/15 text-neon"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mt-8">
          {items === undefined ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="slab h-56 animate-pulse opacity-60" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title="Nothing matches that"
              description={
                search
                  ? `No entries for "${search}". Try a broader term, or clear the filters.`
                  : "There is nothing in this category yet."
              }
            />
          ) : (
            <>
              <p className="mb-4 text-xs text-mist">
                {items.length} {items.length === 1 ? "entry" : "entries"}
                {deferred ? ` for "${deferred}"` : ""}
              </p>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, i) => (
                  <CatalogCard key={item._id} item={item} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function FilterChip({
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
