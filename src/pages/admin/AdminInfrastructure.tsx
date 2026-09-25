import { AdminHead } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Copy,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  MapPin,
  Network,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { DEFAULT_NODE_TOKEN } from "@/lib/demo";
import { cn } from "@/lib/utils";

/**
 * Infrastructure.
 *
 * The three concepts a hosting panel is built on, in one place: the nests eggs
 * are filed under, the nodes that run wings, and the allocations — the reserved
 * ip:ports a server actually claims.
 */

export default function AdminInfrastructure() {
  const nests = useQuery(api.infrastructure.listNests, {});
  const nodes = useQuery(api.infrastructure.listNodes, {});
  const allocations = useQuery(api.infrastructure.listAllocations, {});
  const rotate = useMutation(api.infrastructure.rotateNodeToken);
  const removeNode = useMutation(api.infrastructure.removeNode);
  const [busy, setBusy] = useState<string | undefined>();

  const act = async (id: string, fn: () => Promise<unknown>, message: string) => {
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
        eyebrow="Fleet"
        title="Infrastructure"
        description="The shelves eggs sit on, the machines running wings, and the ip:ports a server can claim."
      />

      {/* ---- Nests ---- */}
      <section className="mb-9">
        <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
          <Layers className="size-3.5" />
          Nests
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(nests ?? []).map((nest) => (
            <div key={nest._id} className="slab p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">{nest.emoji}</span>
                <p className="font-display text-sm font-bold">{nest.name}</p>
                <span className="ml-auto font-mono text-[10px] text-mist">
                  {nest.eggCount} eggs
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {nest.description}
              </p>
              <p className="mt-2 font-mono text-[10px] text-mist">/{nest.slug}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Nodes ---- */}
      <section className="mb-9">
        <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
          <Server className="size-3.5" />
          Nodes
        </h2>
        {(nodes ?? []).length === 0 ? (
          <p className="slab p-6 text-center text-sm text-muted-foreground">
            No nodes yet.
          </p>
        ) : (
          <div className="space-y-3">
            {(nodes ?? []).map((node) => {
              const mine = (allocations ?? []).filter(
                (a) => a.nodeId === node._id,
              );
              return (
                <div key={node._id} className="slab p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-bold">
                          {node.name}
                        </h3>
                        <span
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            node.online
                              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                              : "border-white/10 bg-white/5 text-mist",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              node.online ? "bg-emerald-400" : "bg-mist",
                            )}
                          />
                          {node.online ? "online" : "offline"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-mist">
                        <span className="flex items-center gap-1.5">
                          <Network className="size-3" />
                          {node.id}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3" />
                          {node.location}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Globe className="size-3" />
                          {node.scheme}://{node.fqdn}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <HardDrive className="size-3" />
                          {node.totalDiskMb} MB disk
                        </span>
                        <span>daemon {node.daemonVersion}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === node._id}
                        onClick={() =>
                          act(
                            node._id,
                            () => rotate({ nodeId: node._id }),
                            "New wings token issued",
                          )
                        }
                      >
                        <RefreshCw className="size-3" />
                        Rotate token
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === node._id}
                        onClick={() =>
                          act(
                            node._id,
                            () => removeNode({ nodeId: node._id }),
                            `${node.name} removed`,
                          )
                        }
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Resource bar, in the units the node advertises. */}
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        k: "Memory",
                        used: node.memoryUsed,
                        total: node.totalMemoryMb,
                        unit: "MB",
                      },
                      {
                        k: "Disk",
                        used: node.diskUsed,
                        total: node.totalDiskMb,
                        unit: "MB",
                      },
                      {
                        k: "Servers",
                        used: node.serverCount,
                        total: node.allocationCount,
                        unit: "",
                      },
                    ].map((bar) => (
                      <div key={bar.k}>
                        <div className="flex items-baseline justify-between font-mono text-[10px]">
                          <span className="uppercase tracking-widest text-mist">
                            {bar.k}
                          </span>
                          <span className="text-foreground">
                            {bar.used} / {bar.total} {bar.unit}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-neon to-holo"
                            style={{
                              width: `${Math.min(100, bar.total === 0 ? 0 : (bar.used / bar.total) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Allocations */}
                  <div className="mt-4">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-mist">
                      allocations · {node.allocationUsed}/{node.allocationCount}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mine.map((a) => (
                        <span
                          key={a._id}
                          title={a.assigned ? "claimed by a server" : "free"}
                          className={cn(
                            "rounded border px-2 py-1 font-mono text-[10px]",
                            a.assigned
                              ? "border-neon/40 bg-neon/10 text-neon"
                              : "border-edge text-mist",
                          )}
                        >
                          {a.ip}:{a.port}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="mt-4 flex items-start gap-2 text-[11px] text-mist">
                    <KeyRound className="mt-0.5 size-3 shrink-0" />
                    Token{" "}
                    <span className="font-mono text-foreground">
                      {node.tokenPrefix}…
                    </span>{" "}
                    is stored hashed. Rotating issues a new one; the old stops
                    working immediately.
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- The wings API ---- */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-mist">
          <Network className="size-3.5" />
          Wings API
        </h2>
        <div className="slab overflow-hidden">
          <p className="border-b border-border/60 px-5 py-3 text-sm leading-relaxed text-muted-foreground">
            The panel never opens a socket itself — it asks a node&apos;s wings
            over HTTPS, with the node&apos;s bearer token. A node only ever
            reaches the servers on its own allocations.
          </p>
          <pre className="well m-3 overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-sky-200">
            {[
              "POST   /api/servers                create",
              "GET    /api/servers                list this node's servers",
              "GET    /api/servers/:uuid          status",
              "POST   /api/servers/:uuid/power    start | stop | restart | kill",
              "GET    /api/servers/:uuid/files    the volume",
              "PUT    /api/servers/:uuid/files    write one file",
              "POST   /api/servers/:uuid/install  lay an egg down and install",
              "POST   /api/nodes/:id/ping         heartbeat",
            ].join("\n")}
          </pre>
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3">
            <code className="rounded bg-white/5 px-2 py-1 font-mono text-[11px] text-mist">
              Authorization: Bearer &lt;wings token&gt;
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard
                  .writeText(DEFAULT_NODE_TOKEN)
                  .then(() => toast.success("Demo token copied"));
              }}
            >
              <Copy className="size-3" />
              Copy the demo token
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
