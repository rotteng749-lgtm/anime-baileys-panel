/**
 * Values the panel ships with, shared by the docs and the admin screens.
 *
 * The node token here is the one the seeder installs, so the wings API is
 * exercisable straight after a fresh deploy. A real node gets its own, shown
 * once at creation and stored hashed.
 */
export const DEFAULT_NODE_TOKEN = "wings_demo_node_token_change_me";

/** The base URL the wings API is served from, for a copyable curl. */
export function wingsApiBase() {
  return (
    typeof window !== "undefined"
      ? window.location.origin.replace(/^http/, "https")
      : ""
  );
}
