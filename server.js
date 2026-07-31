/**
 * Live Translate — token server
 * ------------------------------------------------------------------
 * Holds the long-lived Soniox API key and mints short-lived temporary
 * keys for the browser. Audio never touches this server: the page still
 * opens its WebSocket straight to Soniox, so we add zero latency and
 * zero bandwidth cost, while the real key never leaves the machine.
 *
 * Endpoints
 *   POST /api/soniox-token   → { api_key, expires_at }
 *   GET  /api/health         → { ok, configured }
 *   GET  /*                  → static files (index.html, …)
 */

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { roomsApp } from "./rooms.js";

const API_KEY = process.env.SONIOX_API_KEY;
const PORT = Number(process.env.PORT ?? 8787);

// Only these origins may mint a token. Anything else gets 403 — otherwise a
// public deployment lets strangers burn through your Soniox credit.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// How long the browser has to OPEN a stream (not how long it may talk).
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS ?? 60);
// Hard ceiling on a single stream, so a forgotten tab cannot bill forever.
const MAX_SESSION_SECONDS = Number(process.env.MAX_SESSION_SECONDS ?? 3600);

const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 20);

const SONIOX_TOKEN_URL = "https://api.soniox.com/v1/auth/temporary-api-key";

const app = new Hono();

/* ------------------------------------------------------------------ *
 * Rate limit — a fixed window per IP. In-memory on purpose: this is a
 * single-process helper, not a cluster. Move to Redis if you scale out.
 * ------------------------------------------------------------------ */
const hits = new Map(); // ip -> { count, resetAt }

function overLimit(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  rec.count++;
  return rec.count > RATE_LIMIT;
}

// Drop stale buckets so the Map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of hits) if (now > rec.resetAt) hits.delete(ip);
}, 60_000).unref();

function clientIp(c) {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
    c.env?.incoming?.socket?.remoteAddress ||
    "unknown"
  );
}

function originAllowed(origin, host) {
  // Browsers omit Origin on same-origin GETs, and curl omits it entirely.
  if (!origin) return true;

  // An explicit allow-list always wins.
  if (ALLOWED_ORIGINS.length > 0) return ALLOWED_ORIGINS.includes(origin);

  // No list configured. Accept the page we serve ourselves — the Origin of a
  // same-origin POST equals the Host header — so a fresh deploy works without
  // extra config, while a third-party site embedding us is still refused.
  try {
    if (host && new URL(origin).host === host) return true;
  } catch {
    return false; // malformed Origin
  }

  // Plus localhost on any port, for development.
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/* ------------------------------------------------------------------ */

app.get("/api/health", (c) =>
  c.json({ ok: true, configured: Boolean(API_KEY) }),
);

app.post("/api/soniox-token", async (c) => {
  // Cheapest rejections first, so a hostile caller learns nothing about setup.
  const origin = c.req.header("origin");
  if (!originAllowed(origin, c.req.header("host"))) {
    console.warn(`[token] rejected origin ${origin}`);
    return c.json({ error: "Origin not allowed." }, 403);
  }

  const ip = clientIp(c);
  if (overLimit(ip)) {
    return c.json({ error: "Too many requests. Slow down." }, 429);
  }

  if (!API_KEY) {
    return c.json(
      { error: "SONIOX_API_KEY is not set on the server. See .env.example." },
      500,
    );
  }

  let res;
  try {
    res = await fetch(SONIOX_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usage_type: "transcribe_websocket",
        expires_in_seconds: TOKEN_TTL_SECONDS,
        max_session_duration_seconds: MAX_SESSION_SECONDS,
      }),
    });
  } catch (err) {
    console.error("[token] cannot reach Soniox:", err.message);
    return c.json({ error: "Cannot reach Soniox." }, 502);
  }

  const text = await res.text();

  if (!res.ok) {
    // Log upstream detail server-side; never leak it (or the key) to the page.
    console.error(`[token] Soniox ${res.status}: ${text.slice(0, 300)}`);
    return c.json({ error: `Soniox rejected the request (${res.status}).` }, 502);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return c.json({ error: "Malformed response from Soniox." }, 502);
  }

  // Verified shape: { api_key: "temp:…", expires_at: "<ISO8601>" }
  if (!data.api_key) {
    console.error("[token] unexpected response fields:", Object.keys(data));
    return c.json({ error: "No key in Soniox response." }, 502);
  }

  c.header("Cache-Control", "no-store");
  return c.json({ api_key: data.api_key, expires_at: data.expires_at ?? null });
});

/* Live rooms: create / list / join / publish / watch. */
app.route("/api/rooms", roomsApp);

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
  if (!API_KEY) {
    console.warn(
      "  ⚠  SONIOX_API_KEY not set — the page will fall back to the",
      "\n     manual key field. Copy .env.example to .env to fix.\n",
    );
  }
});
