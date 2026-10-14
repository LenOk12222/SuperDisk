import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { loginSchema } from "@/lib/validate";
import { verifyPassword } from "@/lib/password";
import { ApiError, errorToResponse, parseBody, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { createSession, attachSessionCookie } from "@/lib/session";
import { publicUser } from "../register/route";

// фиктивный хеш для выравнивания времени ответа (защита от перебора учёток)
const DUMMY_HASH =
  "scrypt$16384$8$1$" +
  Buffer.from("dummy-salt-00000").toString("base64") +
  "$" +
  Buffer.alloc(64, 7).toString("base64");

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const body = await parseBody(req, loginSchema);
    const login = body.login.toLowerCase().trim();

    // ограничение попыток входа: 5 попыток / 5 минут на пару (IP, login)
    const rl = rateLimit(`login:${ip}:${login}`, 5, 5 * 60 * 1000);
    if (!rl.ok) {
      throw new ApiError(
        429,
        "rate_limited",
        `Слишком много попыток входа. Повторите через ${rl.retryAfterSec} с.`,
      );
    }

    const rows = await db
      .select()
      .from(users)
      .where(or(eq(users.email, login), eq(users.username, login)))
      .limit(1);

    const user = rows[0];
    const ok = await verifyPassword(
      body.password,
      user ? user.passwordHash : DUMMY_HASH,
    );
    if (!user || !ok) {
      throw new ApiError(401, "invalid_credentials", "Неверный логин или пароль");
    }

    const token = await createSession(user.id, {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    const res = NextResponse.json({ data: { user: publicUser(user), token } });
    attachSessionCookie(res, token);
    return res;
  } catch (err) {
    return errorToResponse(err);
  }
}
