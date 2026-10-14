import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceMembers, type User, type WorkspaceMember } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { getAuth, type AuthContext } from "@/lib/session";

/** 401, если запрос не аутентифицирован */
export async function requireUser(req: Request): Promise<AuthContext> {
  const auth = await getAuth(req);
  if (!auth) throw new ApiError(401, "unauthorized", "Требуется вход в систему");
  return auth;
}

/**
 * Проверка прав доступа к пространству (выполняется при КАЖДОЙ операции API,
 * которая затрагивает данные пространства).
 */
export async function requireMembership(
  user: User,
  workspaceId: string,
): Promise<WorkspaceMember> {
  const rows = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);
  if (rows.length === 0) {
    // не раскрываем факт существования пространства посторонним
    throw new ApiError(404, "workspace_not_found", "Пространство не найдено или нет доступа");
  }
  return rows[0];
}

export async function requireOwner(user: User, workspaceId: string) {
  const member = await requireMembership(user, workspaceId);
  if (member.role !== "owner") {
    throw new ApiError(403, "forbidden", "Операция доступна только владельцу пространства");
  }
  return member;
}

/** Пользователь может изменять/удалять объект, если он автор или владелец пространства */
export function canManageResource(member: WorkspaceMember, authorId: string, user: User) {
  return member.role === "owner" || authorId === user.id;
}
