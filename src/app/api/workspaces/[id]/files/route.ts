import { createHash } from "crypto";
import { db } from "@/db";
import { files, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ok, errorToResponse, ApiError } from "@/lib/http";
import { requireUser, requireMembership } from "@/lib/guard";
import {
  MAX_FILE_SIZE,
  fileTypeAllowed,
  sanitizeFileName,
} from "@/lib/validate";
import { newStorageKey, putObject } from "@/lib/storage";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireMembership(user, id);
    const rows = await db
      .select({
        id: files.id,
        name: files.name,
        mime: files.mime,
        size: files.size,
        sha256: files.sha256,
        createdAt: files.createdAt,
        uploaderId: files.uploaderId,
        uploaderName: users.displayName,
        uploaderUsername: users.username,
      })
      .from(files)
      .innerJoin(users, eq(users.id, files.uploaderId))
      .where(eq(files.workspaceId, id))
      .orderBy(desc(files.createdAt));
    return ok({ files: rows, maxSize: MAX_FILE_SIZE });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireMembership(user, id);

    const rl = rateLimit(`upload:${user.id}:${clientIp(req)}`, 60, 10 * 60 * 1000);
    if (!rl.ok) throw new ApiError(429, "rate_limited", "Слишком много загрузок подряд");

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_FILE_SIZE + 64 * 1024) {
      throw new ApiError(413, "file_too_large", "Файл превышает лимит 20 МБ");
    }
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError(400, "bad_multipart", "Ожидается multipart/form-data с полем file");
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "file_required", "Поле file обязательно");
    }
    const safeName = sanitizeFileName(file.name);
    const mime = file.type || "application/octet-stream";
    if (!fileTypeAllowed(safeName, mime)) {
      throw new ApiError(
        415,
        "unsupported_type",
        "Тип файла не разрешён. Допустимы: PNG/JPEG/GIF/WebP/PDF/TXT/MD/CSV/JSON/ZIP/DOCX/XLSX",
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) throw new ApiError(400, "empty_file", "Файл пустой");
    if (buf.length > MAX_FILE_SIZE) {
      throw new ApiError(413, "file_too_large", "Файл превышает лимит 20 МБ");
    }
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const storageKey = newStorageKey(id, safeName);
    await putObject(storageKey, buf, mime);

    const [row] = await db
      .insert(files)
      .values({
        workspaceId: id,
        uploaderId: user.id,
        name: safeName,
        mime,
        size: buf.length,
        storageKey,
        sha256,
      })
      .returning();
    return ok(
      {
        file: {
          id: row.id,
          name: row.name,
          mime: row.mime,
          size: row.size,
          sha256: row.sha256,
          createdAt: row.createdAt,
          uploaderId: row.uploaderId,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
