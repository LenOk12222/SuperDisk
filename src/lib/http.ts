import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function errorToResponse(err: unknown) {
  if (err instanceof ApiError) return fail(err.status, err.code, err.message);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail(
      400,
      "validation_error",
      first ? `${first.path.join(".")}: ${first.message}` : "Некорректные данные",
    );
  }
  console.error("[api]", err);
  return fail(500, "internal_error", "Внутренняя ошибка сервера");
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "bad_json", "Тело запроса должно быть JSON");
  }
  return schema.parse(raw);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "127.0.0.1";
}
