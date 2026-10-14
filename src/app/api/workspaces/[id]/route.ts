import { db } from "@/db";
import { files, workspaces, users, workspaceMembers } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { ok, errorToResponse, parseBody, ApiError } from "@/lib/http";
import { requireUser, requireMembership, requireOwner } from "@/lib/guard";
import { updateWorkspaceSchema } from "@/lib/validate";
import { deleteObject } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    const membership = await requireMembership(user, id);
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (!ws) throw new ApiError(404, "workspace_not_found", "Пространство не найдено");

    const memberRows = await db
      .select({
        id: workspaceMembers.id,
        role: workspaceMembers.role,
        addedAt: workspaceMembers.addedAt,
        userId: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, id))
      .orderBy(asc(workspaceMembers.addedAt));

    return ok({
      workspace: {
        id: ws.id,
        name: ws.name,
        description: ws.description,
        createdAt: ws.createdAt,
        createdBy: ws.createdBy,
        myRole: membership.role,
      },
      members: memberRows.map((m) => ({
        userId: m.userId,
        username: m.username,
        email: m.email,
        displayName: m.displayName,
        role: m.role,
        addedAt: m.addedAt,
        isMe: m.userId === user.id,
      })),
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireOwner(user, id);
    const body = await parseBody(req, updateWorkspaceSchema);
    const [ws] = await db
      .update(workspaces)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      })
      .where(eq(workspaces.id, id))
      .returning();
    return ok({ workspace: ws });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireOwner(user, id);

    const fileRows = await db
      .select({ storageKey: files.storageKey })
      .from(files)
      .where(eq(files.workspaceId, id));
    await db.delete(workspaces).where(eq(workspaces.id, id)); // каскадно удаляет строки
    await Promise.allSettled(fileRows.map((f) => deleteObject(f.storageKey)));
    return ok({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
