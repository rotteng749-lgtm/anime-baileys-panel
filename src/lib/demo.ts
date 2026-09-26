/**
 * Values the panel ships with, shared by the docs and the admin screens.
 *
 * The node token here is the one the seeder installs, so the wings API is
 * exercisable straight after a fresh deploy. A real node gets its own, shown
 * once at creation and stored hashed.
 */
export const DEFAULT_NODE_TOKEN = "wings_demo_node_token_change_me";

/**
 * The deployment URL a wings agent should call.
 *
 * The agent speaks to Convex's HTTP API rather than to the site, so this is
 * the deployment's own hostname — the one `VITE_CONVEX_URL` already points the
 * browser at. It is baked into the copy-paste command the console shows, which
 * is why it lives here instead of inside the agent.
 */
export function wingsPanelUrl() {
  const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
  return url && url.length > 0 ? url : "https://<your-deployment>.convex.cloud";
}

/** The base URL the wings API is served from, for a copyable curl. */
export function wingsApiBase() {
  return (
    typeof window !== "undefined"
      ? window.location.origin.replace(/^http/, "https")
      : ""
  );
}
