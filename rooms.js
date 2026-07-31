/**
 * Live Translate — rooms
 * ------------------------------------------------------------------
 * A host broadcasts its captions to a room; anyone with the code and
 * the password can watch read-only.
 *
 * Transport: the host POSTs throttled updates, viewers receive them over
 * Server-Sent Events. SSE rather than WebSocket because viewers only ever
 * listen — it needs no protocol upgrade, survives proxies that mangle
 * upgrades, and EventSource reconnects on its own. The host's update rate
 * is throttled client-side, so plain POSTs are cheap enough.
 *
 * Storage is in memory: rooms disappear when the process restarts. That is
 * the right trade for ephemeral live sessions — swap in Redis if you ever
 * run more than one instance, since a Map is not shared between processes.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// No I, L, O, 0, 1 — codes get read aloud and typed by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;
const MAX_LINES = 200; // history kept for late joiners
const ROOM_IDLE_MS = 2 * 60 * 60 * 1000; // 2h without a publish → dropped
const VIEWER_TOKEN_MS = 12 * 60 * 60 * 1000;
const MAX_ROOMS = 200;

/** code -> room */
const rooms = new Map();

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

function newCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const bytes = randomBytes(CODE_LEN);
    let code = "";
    for (let i = 0; i < CODE_LEN; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
    if (!rooms.has(code)) return code;
  }
  throw new Error("could not allocate a room code");
}

function hashPassword(password, salt = randomBytes(16)) {
  return { salt, hash: scryptSync(password, salt, 32) };
}

function passwordMatches(room, password) {
  if (!room.salt) return true; // open room
  const candidate = scryptSync(String(password ?? ""), room.salt, 32);
  // Constant-time: a length check first, since timingSafeEqual throws on mismatch.
  return (
    candidate.length === room.hash.length && timingSafeEqual(candidate, room.hash)
  );
}

function tokenMatches(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function clean(value, max) {
  return String(value ?? "")
    .replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, max);
}

function publicView(room) {
  return {
    code: room.code,
    name: room.name,
    langA: room.langA,
    langB: room.langB,
    hasPassword: Boolean(room.salt),
    viewers: room.listeners.size,
    lines: room.lines.length,
    live: room.lastPublishAt > Date.now() - 15_000,
    createdAt: room.createdAt,
  };
}

// Sweep idle rooms so a long-running server does not leak memory.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - Math.max(room.lastPublishAt, room.createdAt) > ROOM_IDLE_MS) {
      broadcast(room, "closed", { reason: "idle" });
      rooms.delete(code);
    }
    for (const [token, expires] of room.viewerTokens)
      if (now > expires) room.viewerTokens.delete(token);
  }
}, 60_000).unref();

function broadcast(room, event, data) {
  for (const send of room.listeners) send(event, data);
}

/* ------------------------------------------------------------------ *
 * routes
 * ------------------------------------------------------------------ */

export const roomsApp = new Hono();

/** List rooms. Never exposes tokens or password material. */
roomsApp.get("/", (c) =>
  c.json({
    rooms: [...rooms.values()]
      .sort((x, y) => y.lastPublishAt - x.lastPublishAt)
      .map(publicView),
  }),
);

/** Create a room. Returns the code plus the one-time host token. */
roomsApp.post("/", async (c) => {
  if (rooms.size >= MAX_ROOMS)
    return c.json({ error: "Too many rooms open right now." }, 429);

  const body = await c.req.json().catch(() => ({}));
  const name = clean(body.name, 60) || "Untitled room";
  const password = clean(body.password, 100);
  const langA = clean(body.langA, 8) || "en";
  const langB = clean(body.langB, 8) || "vi";

  if (password && password.length < 4)
    return c.json({ error: "Password must be at least 4 characters." }, 400);

  const code = newCode();
  const { salt, hash } = password ? hashPassword(password) : {};

  const room = {
    code,
    name,
    langA,
    langB,
    salt,
    hash,
    hostToken: randomBytes(24).toString("hex"),
    createdAt: Date.now(),
    lastPublishAt: 0,
    lines: [],
    live: { orig: "", trans: "", src: "a" },
    listeners: new Set(),
    viewerTokens: new Map(), // token -> expiry
  };
  rooms.set(code, room);

  console.log(`[room] created ${code} — "${name}"`);
  return c.json({ code, hostToken: room.hostToken, name, langA, langB });
});

/** Exchange the password for a viewer token. */
roomsApp.post("/:code/join", async (c) => {
  const room = rooms.get(c.req.param("code").toUpperCase());
  if (!room) return c.json({ error: "Room not found." }, 404);

  const { password } = await c.req.json().catch(() => ({}));
  if (!passwordMatches(room, password))
    return c.json({ error: "Wrong password." }, 403);

  const token = randomBytes(24).toString("hex");
  room.viewerTokens.set(token, Date.now() + VIEWER_TOKEN_MS);

  return c.json({
    viewerToken: token,
    name: room.name,
    langA: room.langA,
    langB: room.langB,
  });
});

/** Host pushes caption updates here. */
roomsApp.post("/:code/publish", async (c) => {
  const room = rooms.get(c.req.param("code").toUpperCase());
  if (!room) return c.json({ error: "Room not found." }, 404);

  const body = await c.req.json().catch(() => ({}));
  if (!tokenMatches(body.hostToken, room.hostToken))
    return c.json({ error: "Not the host of this room." }, 403);

  room.lastPublishAt = Date.now();

  if (body.live) {
    room.live = {
      orig: clean(body.live.orig, 2000),
      trans: clean(body.live.trans, 2000),
      src: body.live.src === "b" ? "b" : "a",
    };
    broadcast(room, "live", room.live);
  }

  if (body.line && (body.line.orig || body.line.trans)) {
    const line = {
      orig: clean(body.line.orig, 2000),
      trans: clean(body.line.trans, 2000),
      src: body.line.src === "b" ? "b" : "a",
      at: Date.now(),
    };
    room.lines.push(line);
    if (room.lines.length > MAX_LINES) room.lines.shift();
    room.live = { orig: "", trans: "", src: line.src };
    broadcast(room, "line", line);
  }

  return c.json({ ok: true, viewers: room.listeners.size });
});

/** Host closes the room. */
roomsApp.delete("/:code", async (c) => {
  const room = rooms.get(c.req.param("code").toUpperCase());
  if (!room) return c.json({ error: "Room not found." }, 404);

  const body = await c.req.json().catch(() => ({}));
  if (!tokenMatches(body.hostToken, room.hostToken))
    return c.json({ error: "Not the host of this room." }, 403);

  broadcast(room, "closed", { reason: "host" });
  rooms.delete(room.code);
  console.log(`[room] closed ${room.code}`);
  return c.json({ ok: true });
});

/**
 * Viewer stream. EventSource cannot set headers, so the token rides in the
 * query string — it is short-lived and scoped to one room.
 */
roomsApp.get("/:code/stream", (c) => {
  const room = rooms.get(c.req.param("code").toUpperCase());
  if (!room) return c.json({ error: "Room not found." }, 404);

  const token = c.req.query("token");
  const expires = room.viewerTokens.get(token);
  if (!expires || Date.now() > expires)
    return c.json({ error: "Invalid or expired viewer token." }, 403);

  c.header("Cache-Control", "no-store");
  c.header("X-Accel-Buffering", "no"); // stop nginx buffering the stream

  return streamSSE(c, async (stream) => {
    const send = (event, data) => {
      stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => {});
    };

    room.listeners.add(send);
    send("snapshot", {
      name: room.name,
      langA: room.langA,
      langB: room.langB,
      lines: room.lines,
      live: room.live,
    });

    const ping = setInterval(() => {
      stream.writeSSE({ event: "ping", data: "" }).catch(() => {});
    }, 25_000);

    await new Promise((resolve) => {
      stream.onAbort(() => {
        clearInterval(ping);
        room.listeners.delete(send);
        resolve();
      });
    });
  });
});
