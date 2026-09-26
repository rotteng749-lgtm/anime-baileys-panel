import { KaizenMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { KeyRound, Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { ADMIN_TOKEN_KEY } from "@/lib/admin-token";

/**
 * Admin sign-in.
 *
 * Deliberately not the member flow: a username and a password, checked against
 * a salted digest. On a fresh install there is no account yet, so the same
 * screen offers to claim the first one — after that, that path is closed.
 */
/**
 * The operator account a fresh panel ships with, matching
 * `ensureDefaultAdmin` on the server. It is provisioned automatically the
 * first time this screen sees an empty install, so the panel is usable out of
 * the box — change the password afterwards if this is a real deployment.
 */
const DEFAULT_USERNAME = "panxcz";
const DEFAULT_PASSWORD = "Panxcz-1";

export default function AdminLogin() {
  const exists = useQuery(api.admin.adminExists, {});
  const createFirstAdmin = useMutation(api.admin.createFirstAdmin);
  const bootstrapDefaultAdmin = useMutation(api.admin.bootstrapDefaultAdmin);
  const signIn = useMutation(api.admin.signIn);
  const check = useQuery(
    api.admin.adminMe,
    localStorage.getItem(ADMIN_TOKEN_KEY)
      ? { token: localStorage.getItem(ADMIN_TOKEN_KEY)! }
      : "skip",
  );

  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: this is a one-shot side effect, and re-rendering for it
  // would only re-run the effect it guards.
  const provisioned = useRef(false);

  // Fresh install? Put the default operator in the database before anyone
  // types a password, and pre-fill the form with it.
  useEffect(() => {
    if (exists !== false || provisioned.current) return;
    provisioned.current = true;
    void bootstrapDefaultAdmin().then(
      (result) => {
        if (result.created) {
          toast.success(`Default operator ready — ${result.username}`);
        }
      },
      () => {
        provisioned.current = false;
      },
    );
  }, [exists, bootstrapDefaultAdmin]);

  // Already holding a valid token? Skip the form.
  useEffect(() => {
    if (check?.ok) {
      window.location.assign("/admin/overview");
    }
  }, [check]);

  const setupMode = exists === false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (setupMode) {
        await createFirstAdmin({ username, password, label: label || undefined });
        toast.success("Admin account created — sign in below");
      } else {
        const result = await signIn({ username, password });
        localStorage.setItem(ADMIN_TOKEN_KEY, result.token);
        toast.success(`Signed in as ${result.label}`);
        window.location.assign("/admin/overview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <div className="anime-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="ash-mist pointer-events-none absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="mb-7 text-center">
          <div className="sigil mx-auto size-20">
            <KaizenMark size={44} />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
            {setupMode ? "Claim the admin seat" : "Admin sign-in"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {setupMode
              ? "No admin account exists yet. The default operator is being created for you."
              : "Username and password. Separate from member accounts."}
          </p>
          {!setupMode && (
            <p className="well mt-4 px-3 py-2 text-center font-mono text-[11px] text-mist">
              default operator · {DEFAULT_USERNAME} / {DEFAULT_PASSWORD}
            </p>
          )}
        </div>

        <form onSubmit={submit} className="app-frame rounded-2xl p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-username">Username</Label>
              <Input
                id="admin-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="operator"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={setupMode ? "new-password" : "current-password"}
                placeholder={setupMode ? "at least 8 characters" : "••••••••"}
              />
            </div>

            {setupMode && (
              <div className="space-y-2">
                <Label htmlFor="admin-label">Display name (optional)</Label>
                <Input
                  id="admin-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="operator"
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Working…
                </>
              ) : setupMode ? (
                <>
                  <UserPlus className="size-4" />
                  Create admin account
                </>
              ) : (
                <>
                  <LogIn className="size-4" />
                  Sign in
                </>
              )}
            </Button>
          </div>
        </form>

        <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-mist">
          {setupMode ? (
            <>
              <ShieldCheck className="size-3" />
              Passwords are stored as salted digests, never in plain text.
            </>
          ) : (
            <>
              <KeyRound className="size-3" />
              Sessions last twelve hours.
            </>
          )}
        </p>

        <div className="mt-4 text-center">
          <a
            href="/"
            className="text-xs font-semibold text-neon transition-colors hover:text-ember"
          >
            ← Back to the site
          </a>
        </div>
      </motion.div>
    </div>
  );
}
