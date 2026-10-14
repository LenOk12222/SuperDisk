import { db } from "@/db";
import { users, workspaceMembers } from "@/db/schema";
import { and, asc, eq, or } from "drizzle-orm";
import { ok, errorToResponse, parseBody, ApiError } from "@/lib/http";
import { requireUser, requireMembership, requireOwner } from "@/lib/guard";
import { addMemberSchema } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireMembership(user, id);
    const rows = await db
      .select({
        userId: users.id,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        role: workspaceMembers.role,
        addedAt: workspaceMembers.addedAt,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, id))
      .orderBy(asc(workspaceMembers.addedAt));
    return ok({ members: rows });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireOwner(user, id);
    const body = await parseBody(req, addMemberSchema);
    const login = body.login.toLowerCase().trim();

    const [target] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, login), eq(users.username, login)))
      .limit(1);
    if (!target) {
      throw new ApiError(
        404,
        "user_not_found",
        "Пользователь не найден. П попросите его зарегистрироваться.",
      );
    }
    const alreadyRows = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, target.id)),
      )
      .limit(1);
    if (alreadyRows.length > 0) {
      throw new ApiError(409, "already_member", "Пользователь уже в пространстве");
    }
    await db.insert(workspaceMembers).values({
      workspaceId: id,
      userId: target.id,
      role: body.role,
    });
    return ok(
      {
        member: {
          userId: target.id,
          username: target.username,
          email: target.email,
          displayName: target.displayName,
          role: body.role,
          addedAt: new Date(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
