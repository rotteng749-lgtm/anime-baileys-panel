import { AdminHead } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Eye,
  Loader2,
  PackageOpen,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { readAdminToken } from "@/lib/admin-token";
import { cn } from "@/lib/utils";

/**
 * Egg moderation.
 *
 * Anyone can submit an egg; this is where it becomes real. Pending eggs are the
 * queue — read the manifest, check the files, then publish or send it back.
 */

const STATUS_TONE: Record<string, string> = {
  published: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  pending: "border-amber-300/40 bg-amber-300/10 text-amber-300",
  draft: "border-white/10 bg-white/5 text-mist",
};

export default function AdminEggs() {
  const token = readAdminToken() ?? "";
  const eggs = useQuery(api.admin.listAllEggs, token ? { token } : "skip");
  const setStatus = useMutation(api.admin.setEggStatus);
  const removeEgg = useMutation(api.admin.removeEgg);
  const [busy, setBusy] = useState<string | undefined>();
  const [filter, setFilter] = useState<"all" | "pending" | "published">("pending");

  const rows = (eggs ?? []).filter((e) => filter === "all" || e.status === filter);
  const pendingCount = (eggs ?? []).filter((e) => e.status === "pending").length;

  const act = async (
    id: string,
    fn: () => Promise<unknown>,
    message: string,
  ) => {
    setBusy(id);
    try {
      await fn();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That did not work");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div>
      <AdminHead
        eyebrow="Catalog"
        title="Eggs"
        description={
          pendingCount > 0
            ? `${pendingCount} egg${pendingCount === 1 ? "" : "s"} waiting on a steward.`
            : "Every submitted egg, and what you published."
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {(["pending", "published", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors",
              filter === key
                ? "border-neon/50 bg-neon/10 text-neon"
                : "border-edge text-mist hover:text-foreground",
            )}
          >
            {key}
            {key === "pending" && pendingCount > 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="slab p-10 text-center">
          <PackageOpen className="mx-auto mb-3 size-7 text-mist" />
          <p className="text-sm text-muted-foreground">
            No {filter === "all" ? "" : filter} eggs right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((egg) => (
            <div key={egg._id} className="slab p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-bold">{egg.name}</h3>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
                        STATUS_TONE[egg.status] ?? STATUS_TONE.draft,
                      )}
                    >
                      {egg.status}
                    </span>
                    {egg.official && (
                      <span className="rounded-full border border-neon/30 px-2 py-0.5 text-[10px] font-semibold text-neon">
                        official
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {egg.description}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-mist">
                    {egg.runtime} · {egg.startup} · {egg.fileCount} files ·{" "}
                    {(egg.bytes / 1024).toFixed(1)} KB · {egg.installs} installs ·
                    by {egg.author}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {egg.status !== "published" && (
                    <Button
                      size="sm"
                      disabled={busy === egg._id}
                      onClick={() =>
                        act(
                          egg._id,
                          () => setStatus({ token, id: egg._id, status: "published" }),
                          `${egg.name} is live`,
                        )
                      }
                    >
                      {busy === egg._id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      Publish
                    </Button>
                  )}
                  {egg.status === "published" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === egg._id}
                      onClick={() =>
                        act(
                          egg._id,
                          () => setStatus({ token, id: egg._id, status: "draft" }),
                          `${egg.name} pulled back`,
                        )
                      }
                    >
                      <Undo2 className="size-3" />
                      Unpublish
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === egg._id}
                    onClick={() =>
                      act(
                        egg._id,
                        () => removeEgg({ token, id: egg._id }),
                        `${egg.name} removed`,
                      )
                    }
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-mist">
        <Eye className="mt-0.5 size-3.5 shrink-0" />
        Publishing an egg makes it installable by every member. Read its files
        first — an egg&apos;s script runs with a live socket in scope.
      </p>
    </div>
  );
}
