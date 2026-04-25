import { test as setup } from "@playwright/test";
import {
  signupViaUI,
  AUTH_STATE_PATH,
  PRO_STATE_PATH,
  ADMIN_STATE_PATH,
} from "./helpers";
import fs from "fs";
import path from "path";
import { createHmac } from "crypto";

const ORIGIN = "http://localhost:3001";

// ─── JWT signing (matches web/src/lib/magic-link.ts#signSession) ──────────

function signSessionJwt(
  payload: { userId: string; email: string; tier: "free" | "pro" },
  secret: string,
  expiresInSeconds: number,
): string {
  const b64url = (buf: Buffer): string =>
    buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, exp })));
  const sig = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

// ─── Storage state shape helpers ──────────────────────────────────────────

interface StorageState {
  cookies: Array<Record<string, unknown>>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

function readState(filePath: string): StorageState {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as StorageState;
  } catch {
    return { cookies: [], origins: [] };
  }
}

function writeState(filePath: string, state: StorageState): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state));
}

function setCookie(state: StorageState, name: string, value: string, ttlSec: number): void {
  state.cookies = state.cookies.filter((c) => c.name !== name);
  state.cookies.push({
    name,
    value,
    domain: "localhost",
    path: "/",
    expires: Math.floor(Date.now() / 1000) + ttlSec,
    httpOnly: name === "sd-session",
    secure: false,
    sameSite: "Lax",
  });
}

function setLocalStorage(state: StorageState, name: string, value: string): void {
  let origin = state.origins.find((o) => o.origin === ORIGIN);
  if (!origin) {
    origin = { origin: ORIGIN, localStorage: [] };
    state.origins.push(origin);
  }
  origin.localStorage = origin.localStorage.filter((e) => e.name !== name);
  origin.localStorage.push({ name, value });
}

// ─── Identity builders ────────────────────────────────────────────────────

const SESSION_TTL = 30 * 24 * 60 * 60;

function defaultSettingsJson(): string {
  return JSON.stringify({
    state: {
      theme: "system",
      scoreRevealMode: "onMarkRead",
      preferredSportsbook: "",
      oddsFormat: "american",
      autoResumePosition: true,
      homeExpandedSections: [],
      hideLimitedData: true,
      timelineDefaultTiers: [1, 2, 3],
      followingLive: false,
      followingLiveAt: 0,
    },
    version: 2,
  });
}

function authJson(role: "user" | "admin", email: string): string {
  return JSON.stringify({
    state: {
      token: "e2e-fake-token",
      role,
      email,
      userId: null,
      isLoading: false,
    },
    version: 0,
  });
}

/** zustand-persist payload for `useTier` (`sd-tier` localStorage). */
function tierPersistJson(tier: "free" | "pro"): string {
  return JSON.stringify({
    state: { tier, anonId: "e2e-anon-id" },
    version: 0,
  });
}

/** Derive a pro-tier identity from the base user state. Mints a fresh
 *  session JWT with `tier: "pro"`, sets `sd-tier` cookie + localStorage
 *  (the latter is what the zustand `useTier` store reads). */
function buildProState(secret: string): void {
  const state = readState(AUTH_STATE_PATH);
  const token = signSessionJwt(
    { userId: "e2e-test-pro-id", email: "e2e-pro@test.scrolldown.dev", tier: "pro" },
    secret,
    SESSION_TTL,
  );
  setCookie(state, "sd-session", token, SESSION_TTL);
  setCookie(state, "sd-tier", "pro", SESSION_TTL);
  setLocalStorage(state, "sd-tier", tierPersistJson("pro"));
  setLocalStorage(state, "sd-auth", authJson("user", "e2e-pro@test.scrolldown.dev"));
  writeState(PRO_STATE_PATH, state);
}

/** Derive an admin identity from the base user state. `useAuth.role`
 *  reads "admin" from sd-auth localStorage; tier stays free. */
function buildAdminState(secret: string): void {
  const state = readState(AUTH_STATE_PATH);
  const token = signSessionJwt(
    { userId: "e2e-test-admin-id", email: "e2e-admin@test.scrolldown.dev", tier: "free" },
    secret,
    SESSION_TTL,
  );
  setCookie(state, "sd-session", token, SESSION_TTL);
  setLocalStorage(state, "sd-auth", authJson("admin", "e2e-admin@test.scrolldown.dev"));
  writeState(ADMIN_STATE_PATH, state);
}

/** Append the free-tier session cookie to the base user state. */
function appendBaseSessionCookie(secret: string): void {
  const state = readState(AUTH_STATE_PATH);
  const token = signSessionJwt(
    { userId: "e2e-test-user-id", email: "e2e@test.scrolldown.dev", tier: "free" },
    secret,
    SESSION_TTL,
  );
  setCookie(state, "sd-session", token, SESSION_TTL);
  writeState(AUTH_STATE_PATH, state);
}

/** Write a deterministic seeded state when signup/backend isn't available. */
function writeSeededAuthState(): void {
  writeState(AUTH_STATE_PATH, {
    cookies: [],
    origins: [
      {
        origin: ORIGIN,
        localStorage: [
          { name: "sd-settings", value: defaultSettingsJson() },
          { name: "sd-auth", value: authJson("user", "e2e@test.scrolldown.dev") },
        ],
      },
    ],
  });
}

/** Mint all three identity state files (user/pro/admin) from a base. */
function mintAllIdentities(): void {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    console.warn("[global-setup] MAGIC_LINK_SECRET not set — pro/admin fixtures will not authenticate");
    return;
  }
  appendBaseSessionCookie(secret);
  buildProState(secret);
  buildAdminState(secret);
}

// ─── Setup test ───────────────────────────────────────────────────────────

setup("create test account and save auth state", async ({ page, request }) => {
  setup.setTimeout(120_000);

  let backendUp = false;
  try {
    const healthRes = await request.get("/api/health", { timeout: 15_000 });
    if (healthRes.ok()) {
      const body = (await healthRes.json()) as { status?: string };
      backendUp = body.status === "ok";
    }
  } catch {
    // health endpoint unreachable
  }

  if (!backendUp) {
    console.warn("[global-setup] Backend unavailable — saving seeded auth state (localStorage only)");
    writeSeededAuthState();
    mintAllIdentities();
    return;
  }

  const email = `e2e-${Date.now()}@test.scrolldown.dev`;
  const password = "Test1234!secure";

  let signupOk = false;
  try {
    await signupViaUI(page, email, password);
    signupOk = true;
  } catch {
    console.warn(
      "[global-setup] Signup failed — saving seeded auth state (localStorage only)",
    );
  }

  if (!signupOk) {
    writeSeededAuthState();
    mintAllIdentities();
    return;
  }

  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});

  try {
    await page.evaluate(
      ({ settings, auth }: { settings: string; auth: string }) => {
        if (!localStorage.getItem("sd-settings")) {
          localStorage.setItem("sd-settings", settings);
        }
        if (!localStorage.getItem("sd-auth")) {
          localStorage.setItem("sd-auth", auth);
        }
      },
      { settings: defaultSettingsJson(), auth: authJson("user", "e2e@test.scrolldown.dev") },
    );
  } catch {
    console.warn("[global-setup] Could not seed localStorage via page.evaluate");
  }

  try {
    await page.context().storageState({ path: AUTH_STATE_PATH });
  } catch {
    console.warn("[global-setup] storageState failed — falling back to seeded auth state");
    writeSeededAuthState();
  }

  // Mint session JWTs for all three identities (user/pro/admin) using the
  // same MAGIC_LINK_SECRET the server uses to verify them.
  mintAllIdentities();
});
