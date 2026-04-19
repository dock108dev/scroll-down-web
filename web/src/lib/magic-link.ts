import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { AUTH, STORAGE_KEYS } from "@/lib/config";

// ─── JWT ────────────────────────────────────────────────────────────────────

export interface SessionPayload {
  userId: string;
  email: string;
  tier: "free" | "pro";
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function getSecret(): string {
  const s = process.env.MAGIC_LINK_SECRET;
  if (!s) throw new Error("MAGIC_LINK_SECRET env var is not set");
  return s;
}

export function signSession(
  payload: Omit<SessionPayload, "exp">,
  expiresInSeconds: number,
): string {
  const secret = getSecret();
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, exp })));
  const sig = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedBuf = createHmac("sha256", secret).update(`${header}.${body}`).digest();
    const sigBuf = Buffer.from(sig, "base64url");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (err) {
    console.error("[magic-link] verifySession unexpected error (malformed token?):", err);
    return null;
  }
}

// ─── Token store (in-memory, short-lived) ────────────────────────────────────

interface PendingToken {
  email: string;
  anonId: string | null;
  expiresAt: number;
}

const TOKENS = new Map<string, PendingToken>();

export function generateMagicToken(): string {
  return randomBytes(32).toString("hex");
}

export function storeMagicToken(
  token: string,
  email: string,
  anonId: string | null,
): void {
  const now = Date.now();
  for (const [k, v] of TOKENS) {
    if (v.expiresAt < now) TOKENS.delete(k);
  }
  TOKENS.set(token, { email, anonId, expiresAt: now + AUTH.MAGIC_TOKEN_TTL_MS });
}

export function consumeMagicToken(
  token: string,
): { email: string; anonId: string | null } | null {
  const entry = TOKENS.get(token);
  if (!entry) return null;
  TOKENS.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return { email: entry.email, anonId: entry.anonId };
}

// ─── Account store (JSON file) ───────────────────────────────────────────────

export interface Account {
  id: string;
  email: string;
  tier: "free" | "pro";
  createdAt: string;
  /** anonId captured at first sign-in; used for future cross-device sync */
  anonId: string | null;
  /** Stripe customer ID; set after first checkout session */
  stripeCustomerId?: string;
  /** ISO date string of next billing renewal; synced from Stripe subscription webhooks */
  nextBillingDate?: string;
}

function dataDir(): string {
  const dir = process.env.DATA_DIR ?? "/tmp";
  if (dir === "/tmp" && process.env.NODE_ENV === "production") {
    console.warn("[magic-link] DATA_DIR is /tmp — account data will not survive a reboot. Set DATA_DIR to a persistent volume.");
  }
  return dir;
}

function accountsPath(): string {
  return join(dataDir(), "sd-accounts.json");
}

function loadAccounts(): Map<string, Account> {
  try {
    const path = accountsPath();
    if (!existsSync(path)) return new Map();
    const arr = JSON.parse(readFileSync(path, "utf8")) as Account[];
    return new Map(arr.map((a) => [a.email.toLowerCase(), a]));
  } catch (err) {
    console.error("[magic-link] loadAccounts failed — returning empty store. Accounts file may be corrupted:", err);
    return new Map();
  }
}

function saveAccounts(accounts: Map<string, Account>): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(accountsPath(), JSON.stringify([...accounts.values()], null, 2), "utf8");
}

export function findOrCreateAccount(email: string, anonId: string | null): Account {
  const accounts = loadAccounts();
  const key = email.toLowerCase();
  let account = accounts.get(key);
  if (!account) {
    account = {
      id: randomBytes(16).toString("hex"),
      email: key,
      tier: "free",
      createdAt: new Date().toISOString(),
      anonId,
    };
    accounts.set(key, account);
    saveAccounts(accounts);
  } else if (!account.anonId && anonId) {
    // Merge anonymous reveal state on first sign-in with an existing email
    account = { ...account, anonId };
    accounts.set(key, account);
    saveAccounts(accounts);
  }
  return account;
}

export function findAccountByEmail(email: string): Account | null {
  return loadAccounts().get(email.toLowerCase()) ?? null;
}

export function updateAccountTier(
  email: string,
  tier: "free" | "pro",
  stripeCustomerId?: string,
  nextBillingDate?: string,
): Account | null {
  const accounts = loadAccounts();
  const key = email.toLowerCase();
  const account = accounts.get(key);
  if (!account) return null;
  const updated: Account = {
    ...account,
    tier,
    ...(stripeCustomerId !== undefined && { stripeCustomerId }),
    ...(nextBillingDate !== undefined && { nextBillingDate }),
  };
  accounts.set(key, updated);
  saveAccounts(accounts);
  return updated;
}

export function findAccountByStripeCustomerId(customerId: string): Account | null {
  for (const account of loadAccounts().values()) {
    if (account.stripeCustomerId === customerId) return account;
  }
  return null;
}

// ─── Session cookie builders ─────────────────────────────────────────────────

export function buildRefreshedSessionCookie(
  email: string,
  userId: string,
): { cookieValue: string; tier: "free" | "pro" } | null {
  const account = findAccountByEmail(email);
  if (!account) return null;
  const token = signSession(
    { userId, email, tier: account.tier },
    AUTH.SESSION_TTL_S,
  );
  return { cookieValue: token, tier: account.tier };
}

export function buildTierCookieHeader(tier: "free" | "pro"): string {
  const maxAge = 365 * 24 * 60 * 60;
  return `${STORAGE_KEYS.TIER}=${tier}; Max-Age=${maxAge}; Path=/; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function buildSessionCookieHeader(token: string): string {
  const maxAge = AUTH.SESSION_TTL_S;
  return `${STORAGE_KEYS.SESSION}=${token}; HttpOnly; Max-Age=${maxAge}; Path=/; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

// ─── Email ───────────────────────────────────────────────────────────────────

export async function sendMagicLinkEmail(to: string, link: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Dev fallback: log to console so the link is accessible without email
    console.info(`[magic-link] sign-in link for ${to}:\n  ${link}`);
    return;
  }

  const from =
    process.env.MAGIC_LINK_FROM_EMAIL ?? "noreply@mail.scrolldownsports.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Your Scroll Down Sports sign-in link",
      html: [
        "<p>Sign in to Scroll Down Sports — this link expires in 15 minutes:</p>",
        `<p><a href="${link}" style="font-size:16px;font-weight:bold;">Sign in</a></p>`,
        '<p style="color:#888;font-size:12px">If you didn\'t request this, ignore this email.</p>',
      ].join(""),
      text: `Sign in to Scroll Down Sports:\n${link}\n\nExpires in 15 minutes. If you didn't request this, ignore this email.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
