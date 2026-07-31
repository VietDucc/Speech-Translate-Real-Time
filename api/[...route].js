/**
 * Vercel entry point.
 *
 * A catch-all so /api/soniox-token, /api/health and /api/rooms/* all reach the
 * same Hono app with their original path intact. The static page is served by
 * Vercel straight from public/ — nothing else in the repo is published.
 */

import { handle } from "hono/vercel";

import { app } from "../app.js";

export default handle(app);
