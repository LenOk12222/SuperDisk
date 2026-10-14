import { NextResponse } from "next/server";
import { destroySession, clearSessionCookie, getAuth } from "@/lib/session";
import { errorToResponse } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (auth) await destroySession(auth.sessionId);
    const res = NextResponse.json({ data: { ok: true } });
    clearSessionCookie(res);
    return res;
  } catch (err) {
    return errorToResponse(err);
  }
}
