import { db } from "@/db";
import { diagrams, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ok, errorToResponse, parseBody, ApiError } from "@/lib/http";
import { requireUser, requireMembership, canManageResource } from "@/lib/guard";
import { updateDiagramSchema } from "@/lib/validate";

type Params = { params: Promise<{ diagramId: string }> };

async function loadDiagram(diagramId: string) {
  const [row] = await db.select().from(diagrams).where(eq(diagrams.id, diagramId)).limit(1);
  if (!row) throw new ApiError(404, "diagram_not_found", "Схема не найдена");
  return row;
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { diagramId } = await params;
    const { user } = await requireUser(req);
    const d = await loadDiagram(diagramId);
    await requireMembership(user, d.workspaceId);
    const [author] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, d.authorId))
      .limit(1);
    return ok({ diagram: { ...d, authorName: author?.displayName ?? "" } });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { diagramId } = await params;
    const { user } = await requireUser(req);
    const d = await loadDiagram(diagramId);
    await requireMembership(user, d.workspaceId);
    const body = await parseBody(req, updateDiagramSchema);
    const [updated] = await db
      .update(diagrams)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.doc !== undefined ? { doc: body.doc } : {}),
        updatedAt: new Date(),
      })
      .where(eq(diagrams.id, diagramId))
      .returning({ id: diagrams.id, name: diagrams.name, updatedAt: diagrams.updatedAt });
    return ok({ diagram: updated });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { diagramId } = await params;
    const { user } = await requireUser(req);
    const d = await loadDiagram(diagramId);
    const member = await requireMembership(user, d.workspaceId);
    if (!canManageResource(member, d.authorId, user)) {
      throw new ApiError(403, "forbidden", "Удалять схему может автор или владелец пространства");
    }
    await db.delete(diagrams).where(eq(diagrams.id, diagramId));
    return ok({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
