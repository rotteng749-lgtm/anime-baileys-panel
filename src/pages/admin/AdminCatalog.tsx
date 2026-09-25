import { AdminHead } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readAdminToken } from "@/lib/admin-token";
import { useMutation, useQuery } from "convex/react";
import {
  Eye,
  EyeOff,
  Loader2,
  PackagePlus,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { ACCENT_STYLES, type AccentKey } from "@/components/catalog/CatalogCard";
import { CATALOG_CATEGORIES } from "@/convex/schema";
import { cn } from "@/lib/utils";

type Draft = {
  id?: string;
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  body: string;
  category: string;
  tags: string;
  priceLabel: string;
  accent: AccentKey;
  status: "published" | "draft";
  featured: boolean;
};

const EMPTY: Draft = {
  slug: "",
  title: "",
  tagline: "",
  summary: "",
  body: "",
  category: CATALOG_CATEGORIES[0],
  tags: "",
  priceLabel: "Included",
  accent: "neon",
  status: "published",
  featured: false,
};

export default function AdminCatalog() {
  const token = readAdminToken() ?? "";
  const items = useQuery(api.admin.listAllItems, { token });
  const upsert = useMutation(api.admin.upsertItem);
  const remove = useMutation(api.admin.removeItem);
  const seed = useMutation(api.admin.loadStarterCatalog);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const startEdit = (item: NonNullable<typeof items>[number]) => {
    setDraft({
      id: item._id,
      slug: item.slug,
      title: item.title,
      tagline: item.tagline,
      summary: item.summary,
      body: item.body,
      category: item.category,
      tags: item.tags.join(", "),
      priceLabel: item.priceLabel,
      accent: item.accent as AccentKey,
      status: item.status,
      featured: item.featured,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      await upsert({
        token,
        id: draft.id as never,
        slug: draft.slug,
        title: draft.title,
        tagline: draft.tagline,
        summary: draft.summary,
        body: draft.body,
        category: draft.category,
        tags: draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        priceLabel: draft.priceLabel,
        accent: draft.accent,
        status: draft.status,
        featured: draft.featured,
      });
      toast.success(draft.id ? "Entry updated" : "Entry created");
      setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AdminHead
        eyebrow="Admin · Catalog"
        title="Catalog entries"
        description="What people browse and install. Write it like documentation, not marketing."
        actions={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                const result = await seed({ token });
                toast.success(
                  result.added > 0
                    ? `Added ${result.added} starter entries`
                    : "Starter catalog already loaded",
                );
              }}
            >
              <Sparkles className="size-4" />
              Load starter catalog
            </Button>
            <Button onClick={() => setDraft(EMPTY)}>
              <PackagePlus className="size-4" />
              New entry
            </Button>
          </>
        }
      />

      {draft && (
        <form onSubmit={save} className="app-frame mb-8 space-y-4 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">
              {draft.id ? "Edit entry" : "New entry"}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-title">Title</Label>
              <Input
                id="c-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Blast Runner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-slug">Slug</Label>
              <Input
                id="c-slug"
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder="blast-runner"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-tagline">Tagline</Label>
            <Input
              id="c-tagline"
              value={draft.tagline}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              placeholder="Scheduled campaigns with per-device throttling"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-summary">Summary</Label>
            <Textarea
              id="c-summary"
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              className="min-h-20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-body">Body</Label>
            <Textarea
              id="c-body"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Blank lines separate paragraphs."
              className="min-h-40"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="c-category">Category</Label>
              <select
                id="c-category"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="h-11 w-full rounded-lg border border-input bg-gradient-to-b from-abyss/70 to-abyss/40 px-3 text-sm outline-none"
              >
                {CATALOG_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-surface">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-price">Access label</Label>
              <Input
                id="c-price"
                value={draft.priceLabel}
                onChange={(e) =>
                  setDraft({ ...draft, priceLabel: e.target.value })
                }
                placeholder="Included"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-tags">Tags (comma separated)</Label>
              <Input
                id="c-tags"
                value={draft.tags}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                placeholder="csv, throttle"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-mist">Accent</Label>
              {(Object.keys(ACCENT_STYLES) as AccentKey[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setDraft({ ...draft, accent: a })}
                  className={cn(
                    "size-7 rounded-lg border-2 transition-all",
                    draft.accent === a
                      ? "border-foreground scale-110"
                      : "border-transparent opacity-50 hover:opacity-100",
                  )}
                  style={{
                    background: {
                      neon: "oklch(0.78 0.16 200)",
                      holo: "oklch(0.68 0.19 300)",
                      sakura: "oklch(0.76 0.15 350)",
                      ember: "oklch(0.72 0.17 45)",
                    }[a],
                  }}
                  aria-label={a}
                />
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-mist">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
                className="size-3.5 accent-(--neon)"
              />
              Feature on the home page
            </label>

            <label className="flex items-center gap-2 text-xs text-mist">
              <input
                type="checkbox"
                checked={draft.status === "published"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    status: e.target.checked ? "published" : "draft",
                  })
                }
                className="size-3.5 accent-(--neon)"
              />
              Published
            </label>

            <Button type="submit" className="ml-auto" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {draft.id ? "Save changes" : "Create entry"}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {(items ?? []).map((item) => {
          const accent =
            ACCENT_STYLES[item.accent as AccentKey] ?? ACCENT_STYLES.neon;
          return (
            <div
              key={item._id}
              className="slab flex flex-wrap items-center gap-4 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-display font-bold">
                    {item.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
                      item.status === "published"
                        ? "border-emerald-400/40 text-emerald-300"
                        : "border-edge text-mist",
                    )}
                  >
                    {item.status}
                  </span>
                  {item.featured && (
                    <span className="shrink-0 rounded-full border border-ember/40 px-2 py-0.5 text-[10px] font-bold uppercase text-ember">
                      featured
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] text-mist">
                  /{item.slug} · {item.category} · {item.installs} installs
                </p>
              </div>

              <span className={cn("shrink-0 text-xs font-semibold", accent.text)}>
                {item.priceLabel}
              </span>

              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="icon-sm"
                  variant="outline"
                  title="Edit"
                  onClick={() => startEdit(item)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title={item.status === "published" ? "Unpublish" : "Publish"}
                  onClick={async () => {
                    await upsert({
                      token,
                      id: item._id,
                      slug: item.slug,
                      title: item.title,
                      tagline: item.tagline,
                      summary: item.summary,
                      body: item.body,
                      category: item.category,
                      tags: item.tags,
                      priceLabel: item.priceLabel,
                      accent: item.accent,
                      status:
                        item.status === "published" ? "draft" : "published",
                      featured: item.featured,
                    });
                    toast.success("Status updated");
                  }}
                >
                  {item.status === "published" ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5" />
                  )}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-rose-300 hover:bg-rose-500/10"
                  title="Delete"
                  onClick={async () => {
                    await remove({ token, id: item._id });
                    toast.success("Entry deleted");
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {items !== undefined && items.length === 0 && (
          <div className="slab p-10 text-center text-sm text-muted-foreground">
            The catalog is empty. Load the starter entries, or write the first
            one yourself.
          </div>
        )}
      </div>
    </div>
  );
}
