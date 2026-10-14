import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

export const SESSION_COOKIE = "sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function issueToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string },
): Promise<string> {
  const token = issueToken();
  const id = sha256(token); // в БД хранится только хеш токена
  await db.insert(sessions).values({
    id,
    userId,
    ip: meta.ip ?? null,
    userAgent: (meta.userAgent ?? "").slice(0, 300),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function destroySession(tokenId: string) {
  await db.delete(sessions).where(eq(sessions.id, tokenId));
}

function tokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

export type AuthContext = { user: User; sessionId: string };

async function lookupToken(token: string): Promise<AuthContext | null> {
  if (!token || token.length < 16) return null;
  const id = sha256(token);
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (rows.length === 0) return null;
  // сверхосторожная проверка (сессия уже найдена по индексу)
  if (!timingSafeEqual(Buffer.from(rows[0].session.id), Buffer.from(id))) return null;
  return { user: rows[0].user, sessionId: id };
}

/** Проверяет cookie «sid» либо Authorization: Bearer <token> */
export async function getAuth(req: Request): Promise<AuthContext | null> {
  return lookupToken(tokenFromRequest(req) ?? "");
}

/** Для серверных компонентов (RSC): читает cookie текущего запроса */
export async function getServerAuth(): Promise<AuthContext | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? "";
  return lookupToken(token);
}

export function attachSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
