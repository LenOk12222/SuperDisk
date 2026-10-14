import { db } from "@/db";
import { notes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ok, errorToResponse, parseBody, ApiError } from "@/lib/http";
import { requireUser, requireMembership, canManageResource } from "@/lib/guard";
import { updateNoteSchema } from "@/lib/validate";

type Params = { params: Promise<{ noteId: string }> };

async function loadNote(noteId: string) {
  const [row] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  if (!row) throw new ApiError(404, "note_not_found", "Заметка не найдена");
  return row;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { noteId } = await params;
    const { user } = await requireUser(req);
    const note = await loadNote(noteId);
    await requireMembership(user, note.workspaceId);
    const [author] = await db
      .select({ displayName: users.displayName, username: users.username })
      .from(users)
      .where(eq(users.id, note.authorId))
      .limit(1);
    return ok({ note: { ...note, authorName: author?.displayName ?? "" } });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { noteId } = await params;
    const { user } = await requireUser(req);
    const note = await loadNote(noteId);
    await requireMembership(user, note.workspaceId); // любой участник может редактировать
    const body = await parseBody(req, updateNoteSchema);
    const [updated] = await db
      .update(notes)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        updatedAt: new Date(),
      })
      .where(eq(notes.id, noteId))
      .returning();
    return ok({ note: updated });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { noteId } = await params;
    const { user } = await requireUser(req);
    const note = await loadNote(noteId);
    const member = await requireMembership(user, note.workspaceId);
    if (!canManageResource(member, note.authorId, user)) {
      throw new ApiError(403, "forbidden", "Удалять заметку может автор или владелец пространства");
    }
    await db.delete(notes).where(eq(notes.id, noteId));
    return ok({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
