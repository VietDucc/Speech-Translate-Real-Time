/**
 * Live Translate — local/self-hosted server
 * ------------------------------------------------------------------
 * Wraps the API app (app.js) in a long-lived node process and serves the
 * static page next to it. Use this for `npm start`, a VPS, Render, Railway,
 * Fly — anywhere one process stays up. On Vercel the entry point is
 * api/[...route].js instead and the static files are served by the CDN.
 */

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

import { app } from "./app.js";

const PORT = Number(process.env.PORT ?? 8787);

/* Static files.
 *
 * The root is ./public and NOT the project root. Pointing it at "./" would
 * publish every file next to this script — including .env, so the real API
 * key would be one GET away, which is exactly what this server exists to
 * prevent. Keeping web assets in their own folder means nothing is reachable
 * unless it was deliberately put there.
 *
 * Serving the page from the same origin as the token endpoint also lets the
 * browser remember the microphone permission, unlike opening it over file://.
 */
app.use("/*", serveStatic({ root: "./public" }));

serve({ fetch: app.fetch, port: PORT }, ({ port }) => {
  console.log(`\n  Live Translate  →  http://localhost:${port}\n`);
  if (!process.env.SONIOX_API_KEY) {
    console.warn(
      "  ⚠  SONIOX_API_KEY not set — the page will fall back to the",
      "\n     manual key field. Copy .env.example to .env to fix.\n",
    );
  }
});
