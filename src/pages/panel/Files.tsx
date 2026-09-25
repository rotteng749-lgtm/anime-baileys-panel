import { PageHead } from "@/components/panel/Shell";
import { EmptyState } from "@/components/panel/Parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronLeft,
  Download,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderPlus,
  Loader2,
  Pencil,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useSessions, type SessionId } from "@/hooks/use-panel";
import { cn } from "@/lib/utils";

/**
 * The agent's file manager.
 *
 * Upload a folder of scripts and config in one go, edit them in place, and pull
 * them back out. Text files only — this is a place for scripts and manifests,
 * not binary assets.
 */

const TEXT_EXTENSIONS = [
  "js", "mjs", "cjs", "json", "txt", "md", "env", "yaml", "yml",
  "sh", "ts", "html", "css", "",
];

function isTextFile(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.includes(ext);
}

function iconFor(name: string, isDir: boolean) {
  if (isDir) return Folder;
  if (name.endsWith(".json")) return FileJson;
  if (/\.(js|mjs|cjs|ts)$/.test(name)) return FileCode;
  return FileText;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function Files() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("session") ?? undefined;
  const sessions = useSessions();
  // Resolve the raw id from the URL against the live list so every mutation
  // below gets a real branded session id.
  const sessionId = (sessions ?? []).find((s) => s._id === requested)
    ?._id as SessionId | undefined;

  const [dir, setDir] = useState("");
  const [openPath, setOpenPath] = useState<string | undefined>(
    params.get("path") ?? undefined,
  );
  // The draft carries the path it belongs to, so opening a different file
  // discards the previous edit without an effect to reset it.
  const [draft, setDraft] = useState<{ path: string; text: string } | undefined>();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useQuery(
    api.files.listFiles,
    sessionId ? { sessionId, dir: dir || undefined } : "skip",
  );
  const file = useQuery(
    api.files.readFile,
    sessionId && openPath ? { sessionId, path: openPath } : "skip",
  );

  const uploadFiles = useMutation(api.files.uploadFiles);
  const writeFile = useMutation(api.files.writeFile);
  const makeDirectory = useMutation(api.files.makeDirectory);
  const deleteFile = useMutation(api.files.deleteFile);
  const renameFile = useMutation(api.files.renameFile);

  const text = draft && draft.path === openPath ? draft.text : (file?.contents ?? "");
  const dirty = text !== (file?.contents ?? "");

  const crumbs = dir ? dir.split("/") : [];

  const doUpload = useCallback(
    async (files: File[]) => {
      if (!sessionId || files.length === 0) return;
      const readable: Array<{ path: string; contents: string }> = [];
      const skipped: string[] = [];

      for (const f of files) {
        // webkitRelativePath preserves folders dropped from the OS.
        const relative = (f as File & { webkitRelativePath?: string })
          .webkitRelativePath;
        const path = relative && relative !== f.name ? relative : f.name;
        if (!isTextFile(f.name)) {
          skipped.push(f.name);
          continue;
        }
        if (f.size > 512 * 1024) {
          skipped.push(`${f.name} (too large)`);
          continue;
        }
        readable.push({ path, contents: await f.text() });
      }

      if (readable.length === 0) {
        toast.error("No text files in that selection");
        return;
      }

      setUploading(true);
      try {
        const written = await uploadFiles({
          sessionId,
          dir: dir || undefined,
          files: readable,
        });
        toast.success(`Uploaded ${written.length} file${written.length === 1 ? "" : "s"}`);
        if (skipped.length > 0) {
          toast.message(`Skipped ${skipped.length}: ${skipped.slice(0, 3).join(", ")}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [sessionId, dir, uploadFiles],
  );

  const save = async () => {
    if (!sessionId || !openPath) return;
    setSaving(true);
    try {
      await writeFile({ sessionId, path: openPath, contents: text });
      setDraft(undefined);
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    if (!file) return;
    const blob = new Blob([file.contents], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.path.split("/").pop() ?? "file.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!sessionId) {
    return (
      <div>
        <PageHead
          eyebrow="Agent"
          title="Files"
          description="Upload scripts, manifests and config to a session, then edit them in place."
        />
        {(sessions ?? []).length === 0 ? (
          <EmptyState
            icon={Folder}
            title="No sessions yet"
            description="Create a session first — the file manager works on a session's own disk."
          />
        ) : (
          <div className="slab p-6">
            <p className="text-sm text-muted-foreground">Choose a session to open its files.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(sessions ?? []).map((s) => (
                <Button
                  key={s._id}
                  variant="outline"
                  onClick={() => setParams({ session: s._id })}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHead
        eyebrow="Agent"
        title="Files"
        description="Upload scripts, manifests and config to this session, then edit them in place."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={sessionId}
              onChange={(e) => {
                setParams({ session: e.target.value });
                setDir("");
                setOpenPath(undefined);
              }}
              className="h-10 rounded-lg border border-edge bg-gradient-to-b from-surface-3 to-surface px-3 text-sm font-semibold outline-none"
            >
              {(sessions ?? []).map((s) => (
                <option key={s._id} value={s._id} className="bg-surface">
                  {s.name}
                </option>
              ))}
            </select>
            <Button variant="outline" asChild>
              <a href={`/dashboard/console?session=${sessionId}`}>Console</a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* ---- Browser ---- */}
        <div className="slab flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
            {crumbs.length > 0 && (
              <button
                type="button"
                onClick={() => setDir(crumbs.slice(0, -1).join("/"))}
                className="rounded p-1 text-mist transition-colors hover:text-foreground"
                title="Up"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-mist">
              /{dir}
            </p>
            <button
              type="button"
              title="New folder"
              onClick={async () => {
                const name = window.prompt("Folder name");
                if (!name) return;
                await makeDirectory({
                  sessionId,
                  path: dir ? `${dir}/${name}` : name,
                });
              }}
              className="rounded p-1 text-mist transition-colors hover:text-foreground"
            >
              <FolderPlus className="size-4" />
            </button>
            <button
              type="button"
              title="Upload files"
              onClick={() => inputRef.current?.click()}
              className="rounded p-1 text-mist transition-colors hover:text-foreground"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => void doUpload(Array.from(e.target.files ?? []))}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void doUpload(Array.from(e.dataTransfer.files));
            }}
            className={cn(
              "relative flex-1",
              dragOver && "bg-neon/5",
            )}
          >
            {dragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-neon/60">
                <p className="font-display text-sm font-bold text-neon">
                  Drop to upload
                </p>
              </div>
            )}

            <div className="max-h-[520px] overflow-y-auto p-2">
              {(entries ?? []).length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <Folder className="mx-auto mb-3 size-6 text-mist" />
                  <p className="text-xs text-mist">This folder is empty.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="size-3" />
                    Upload files
                  </Button>
                </div>
              ) : (
                (entries ?? []).map((entry) => {
                  const Icon = iconFor(entry.name, entry.isDir);
                  const selected = entry.path === openPath;
                  return (
                    <div
                      key={entry.path}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                        selected
                          ? "bg-neon/12 text-neon"
                          : "hover:bg-white/5",
                      )}
                    >
                      {renaming === entry.path ? (
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key !== "Enter") return;
                            await renameFile({
                              sessionId,
                              from: entry.path,
                              to: renameValue,
                            });
                            setRenaming(null);
                            toast.success("Renamed");
                          }}
                          onBlur={() => setRenaming(null)}
                          className="h-7 py-0 text-xs"
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              entry.isDir
                                ? setDir(entry.path)
                                : setOpenPath(entry.path)
                            }
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <Icon className="size-3.5 shrink-0" />
                            <span className="truncate font-mono text-[12px]">
                              {entry.name}
                            </span>
                          </button>
                          {!entry.isDir && (
                            <span className="shrink-0 font-mono text-[10px] text-mist">
                              {formatSize(entry.size)}
                            </span>
                          )}
                          <button
                            type="button"
                            title="Rename"
                            onClick={() => {
                              setRenaming(entry.path);
                              setRenameValue(entry.name);
                            }}
                            className="shrink-0 rounded p-1 text-mist opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  `Delete ${entry.name}?`,
                                )
                              )
                                return;
                              await deleteFile({
                                sessionId,
                                path: entry.path,
                              });
                              if (selected) setOpenPath(undefined);
                              toast.success("Deleted");
                            }}
                            className="shrink-0 rounded p-1 text-mist opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-300"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ---- Editor ---- */}
        <div className="slab flex min-h-[420px] flex-col overflow-hidden">
          {file ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2.5">
                <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-mist">
                  {file.path}
                </p>
                {dirty && (
                  <span className="rounded-full border border-ember/40 bg-ember/10 px-2 py-0.5 text-[10px] font-semibold text-ember">
                    unsaved
                  </span>
                )}
                <Button size="sm" variant="ghost" onClick={download}>
                  <Download className="size-3" />
                </Button>
                <Button size="sm" onClick={save} disabled={!dirty || saving}>
                  {saving ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Save className="size-3" />
                  )}
                  Save
                </Button>
              </div>
              <textarea
                value={text}
                onChange={(e) =>
                  openPath &&
                  setDraft({ path: openPath, text: e.target.value })
                }
                spellCheck={false}
                className="well m-3 min-h-[380px] flex-1 resize-none border-0 bg-transparent p-4 font-mono text-[12px] leading-relaxed outline-none"
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <FileCode className="mb-3 size-7 text-mist" />
              <p className="text-sm text-muted-foreground">
                Pick a file to edit it.
              </p>
              <p className="mt-1 text-xs text-mist">
                Drag files onto the browser, or use the upload button.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
