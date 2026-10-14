import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { registerSchema } from "@/lib/validate";
import { hashPassword } from "@/lib/password";
import { ApiError, errorToResponse, parseBody, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { createSession, attachSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = rateLimit(`register:${ip}`, 20, 60 * 60 * 1000);
    if (!rl.ok) throw new ApiError(429, "rate_limited", "Слишком много регистраций, попробуйте позже");

    const body = await parseBody(req, registerSchema);
    const username = body.username.toLowerCase();
    const email = body.email.toLowerCase().trim();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);
    if (existing.length > 0) {
      throw new ApiError(409, "user_exists", "Пользователь с таким логином или email уже существует");
    }

    const passwordHash = await hashPassword(body.password);
    const [user] = await db
      .insert(users)
      .values({
        username,
        email,
        displayName: body.displayName?.trim() || username,
        passwordHash,
      })
      .returning();

    const token = await createSession(user.id, {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    const res = NextResponse.json(
      { data: { user: publicUser(user), token } },
      { status: 201 },
    );
    attachSessionCookie(res, token);
    return res;
  } catch (err) {
    return errorToResponse(err);
  }
}

export function publicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt,
  };
}
