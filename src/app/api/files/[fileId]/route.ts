import { db } from "@/db";
import { files } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ok, errorToResponse, ApiError } from "@/lib/http";
import { requireUser, requireMembership, canManageResource } from "@/lib/guard";
import { presignedGetUrl, readObject, deleteObject } from "@/lib/storage";

type Params = { params: Promise<{ fileId: string }> };

const INLINE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

/** Метаданные файла */
export async function GET(req: Request, { params }: Params) {
  try {
    const { fileId } = await params;
    const { user } = await requireUser(req);
    const [f] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!f) throw new ApiError(404, "file_not_found", "Файл не найден");
    await requireMembership(user, f.workspaceId);
    return ok({ file: strip(f) });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { fileId } = await params;
    const { user } = await requireUser(req);
    const [f] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!f) throw new ApiError(404, "file_not_found", "Файл не найден");
    const member = await requireMembership(user, f.workspaceId);
    if (!canManageResource(member, f.uploaderId, user)) {
      throw new ApiError(403, "forbidden", "Удалять файл может автор или владелец пространства");
    }
    await db.delete(files).where(eq(files.id, fileId));
    await deleteObject(f.storageKey).catch(() => {});
    return ok({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}

function strip(f: typeof files.$inferSelect) {
  return {
    id: f.id,
    workspaceId: f.workspaceId,
    name: f.name,
    mime: f.mime,
    size: f.size,
    sha256: f.sha256,
    createdAt: f.createdAt,
    uploaderId: f.uploaderId,
    downloadUrl: `/api/files/${f.id}/download`,
    previewUrl: INLINE_MIMES.has(f.mime) ? `/api/files/${f.id}/download?mode=inline` : null,
  };
}
