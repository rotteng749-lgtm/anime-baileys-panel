import { SectionTag } from "@/components/Brand";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  FileCode,
  FileJson,
  Loader2,
  PackageCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useEggsReady } from "@/hooks/use-eggs";
import { cn } from "@/lib/utils";

/**
 * Publish an egg.
 *
 * The same shape as a hosting panel's egg importer: one manifest describing what
 * the agent is, and as many files as it needs to run. Everything here is
 * validated server-side — the manifest is parsed, not trusted, and paths that
 * try to climb out of the egg's own directory are dropped.
 */

const BLANK_MANIFEST = `{
  "name": "",
  "author": "",
  "description": "",
  "category": "Developer",
  "tags": ["baileys"],
  "runtime": "nodejs_22",
  "startup": "node index.js",
  "installScript": "npm install",
  "config": {
    "env": {
      "PREFIX": "",
      "OWNER_JID": ""
    }
  }
}`;

type Staged = { path: string; contents: string; size: number };

export default function EggPublish() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const eggs = useQuery(api.eggs.listEggs, {});
  const runtimes = useQuery(api.eggs.listRuntimes, {});
  useEggsReady(eggs?.length, runtimes?.length);

  const publish = useMutation(api.eggs.publishEgg);
  const [manifest, setManifest] = useState(BLANK_MANIFEST);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Record<string, unknown> | undefined>();
  const [jsonError, setJsonError] = useState<string | undefined>();

  // Re-parse as the author types so the summary below is always honest.
  const reparse = (next: string) => {
    setManifest(next);
    try {
      setParsed(JSON.parse(next));
      setJsonError(undefined);
    } catch (err) {
      setParsed(undefined);
      setJsonError(err instanceof Error ? err.message : "Not valid JSON");
    }
  };

  const ingest = async (list: FileList | File[]) => {
    const incoming: Staged[] = [];
    for (const f of Array.from(list)) {
      const relative =
        (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      incoming.push({
        path: relative,
        contents: await f.text(),
        size: f.size,
      });
    }
    setStaged((prev) => {
      const seen = new Set(prev.map((p) => p.path));
      return [...prev, ...incoming.filter((f) => !seen.has(f.path))];
    });
  };

  const submit = async () => {
    setBusy(true);
    try {
      const out = await publish({
        manifest,
        files: staged.map((f) => ({ path: f.path, contents: f.contents })),
      });
      toast.success("Egg submitted — an admin reviews it before it goes live");
      navigate(`/eggs/${out.slug}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  };

  const envKeys =
    parsed && typeof parsed.config === "object" && parsed.config !== null
      ? Object.keys(
          (parsed.config as { env?: Record<string, string> }).env ?? {},
        )
      : [];

  return (
    <div className="relative min-h-screen">
      <div className="anime-grid pointer-events-none absolute inset-x-0 top-0 h-[300px] opacity-40" />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-4xl px-5 py-12 sm:px-8">
        <Link
          to="/eggs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Eggs
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <SectionTag tone="sakura">publish</SectionTag>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Ship an egg
          </h1>
        </div>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          An egg is a manifest plus its files. Anyone can upload one; a steward
          reviews it before it appears in the catalog. Read what you are
          shipping — an egg&apos;s script runs with a live socket in scope.
        </p>

        {!isAuthenticated ? (
          <div className="slab mt-8 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Publishing needs an account, so the egg can be credited to someone.
            </p>
            <Button className="mt-5" asChild>
              <Link to="/auth?returnTo=/eggs/publish">
                Sign in to publish
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* ---- Manifest ---- */}
            <section className="slab overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
                <FileJson className="size-3.5 text-neon" />
                <span className="font-mono text-[11px] text-mist">
                  manifest.json
                </span>
                <span
                  className={cn(
                    "ml-auto font-mono text-[10px]",
                    jsonError ? "text-rose-300" : "text-mist",
                  )}
                >
                  {jsonError ?? "valid json"}
                </span>
              </div>
              <Textarea
                value={manifest}
                onChange={(e) => reparse(e.target.value)}
                spellCheck={false}
                className="well m-3 min-h-[280px] resize-none border-0 bg-transparent p-4 font-mono text-[12px] leading-relaxed outline-none"
              />
            </section>

            {/* ---- Files ---- */}
            <section className="slab overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2.5">
                <FileCode className="size-3.5 text-holo" />
                <span className="font-mono text-[11px] text-mist">
                  files · {staged.length}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="size-3" />
                    Add files
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStaged([])}
                    disabled={staged.length === 0}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => e.target.files && void ingest(e.target.files)}
              />
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length) void ingest(e.dataTransfer.files);
                }}
                className="p-3"
              >
                {staged.length === 0 ? (
                  <div className="well px-4 py-10 text-center">
                    <Upload className="mx-auto mb-3 size-6 text-mist" />
                    <p className="text-sm text-muted-foreground">
                      Drop a folder of scripts here, or use Add files.
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-mist">
                      index.js, package.json, README.md — anything text.
                    </p>
                  </div>
                ) : (
                  <ul className="well max-h-[280px] divide-y divide-white/5 overflow-y-auto">
                    {staged.map((f) => (
                      <li
                        key={f.path}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <FileCode className="size-3.5 shrink-0 text-mist" />
                        <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                          {f.path}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-mist">
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setStaged((prev) => prev.filter((p) => p.path !== f.path))
                          }
                          className="shrink-0 rounded p-1 text-mist transition-colors hover:text-rose-300"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* ---- Summary ---- */}
            <section className="slab p-5">
              <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mist">
                What the panel will read
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { k: "Name", v: String(parsed?.name ?? "—") },
                  { k: "Runtime", v: String(parsed?.runtime ?? "—") },
                  { k: "Startup", v: String(parsed?.startup ?? "node index.js") },
                  {
                    k: "Install",
                    v: String(parsed?.installScript ?? "npm install"),
                  },
                  { k: "Category", v: String(parsed?.category ?? "Developer") },
                  {
                    k: "Environment",
                    v: envKeys.length ? envKeys.join(", ") : "none",
                  },
                ].map((row) => (
                  <div key={row.k} className="stat-chip px-4 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-mist">
                      {row.k}
                    </dt>
                    <dd className="mt-1.5 truncate font-mono text-xs">{row.v}</dd>
                  </div>
                ))}
              </dl>
              {runtimes && runtimes.length > 0 && (
                <p className="mt-4 text-xs text-mist">
                  Known runtimes:{" "}
                  {runtimes.map((r) => r.id).join(", ")}
                </p>
              )}
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={submit} disabled={busy || !!jsonError}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PackageCheck className="size-4" />
                )}
                Submit for review
              </Button>
              <p className="text-xs text-mist">
                {staged.length} file{staged.length === 1 ? "" : "s"} ·{" "}
                <span className="font-mono">
                  {(staged.reduce((n, f) => n + f.size, 0) / 1024).toFixed(1)} KB
                </span>
              </p>
            </div>
          </div>
        )}

        <p className="mt-10 text-xs text-mist">
          Not sure where to start?{" "}
          <Link to="/eggs" className="font-semibold text-neon">
            Look at an existing egg
          </Link>{" "}
          and copy its shape.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
