import { db } from "@/db";
import { files } from "@/db/schema";
import { eq } from "drizzle-orm";
import { errorToResponse, ApiError } from "@/lib/http";
import { requireUser, requireMembership } from "@/lib/guard";
import { presignedGetUrl, readObject, storageDriver } from "@/lib/storage";

type Params = { params: Promise<{ fileId: string }> };

const INLINE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

/**
 * Скачивание закрытого файла. Права проверяются ДО выдачи содержимого:
 * - s3: редирект на короткоживущий presigned-URL приватного бакета;
 * - local: поток с сервера, напрямую объект недоступен извне.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { fileId } = await params;
    const { user } = await requireUser(req);
    const [f] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!f) throw new ApiError(404, "file_not_found", "Файл не найден");
    await requireMembership(user, f.workspaceId); // ← проверка прав при каждом запросе

    const url = new URL(req.url);
    const inline = url.searchParams.get("mode") === "inline" && INLINE_MIMES.has(f.mime);
    const disposition = inline ? "inline" : "attachment";

    if (storageDriver() === "s3") {
      const signed = await presignedGetUrl(f.storageKey, f.name, f.mime);
      if (signed) return Response.redirect(signed, 302);
    }

    const body = await readObject(f.storageKey);
    const headers = new Headers({
      "Content-Type": inline ? f.mime : "application/octet-stream",
      "Content-Length": String(body.length),
      "Content-Disposition":
        `${disposition}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    });
    return new Response(new Uint8Array(body), { headers });
  } catch (err) {
    return errorToResponse(err);
  }
}
