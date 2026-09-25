import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { addWingsRoutes } from "./wingsApi";

/**
 * Every route this deployment answers.
 *
 * The auth provider's own callbacks, plus the wings API — the bearer-token
 * surface a node's daemon talks to, kept in its own router.
 */
const http = httpRouter();

auth.addHttpRoutes(http);
addWingsRoutes(http);

export default http;
