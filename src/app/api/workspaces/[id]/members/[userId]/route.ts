import { db } from "@/db";
import { workspaceMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ok, errorToResponse, ApiError } from "@/lib/http";
import { requireUser, requireOwner } from "@/lib/guard";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id, userId } = await params;
    const { user } = await requireUser(req);
    await requireOwner(user, id);

    if (userId === user.id) {
      throw new ApiError(400, "cannot_remove_self", "Владелец не может удалить сам себя");
    }
    const [target] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, id),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    if (!target) throw new ApiError(404, "member_not_found", "Участник не найден");
    if (target.role === "owner") {
      throw new ApiError(403, "cannot_remove_owner", "Нельзя удалить владельца пространства");
    }
    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, id),
          eq(workspaceMembers.userId, userId),
        ),
      );
    return ok({ ok: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
