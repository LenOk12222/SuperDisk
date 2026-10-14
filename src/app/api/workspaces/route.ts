import { db } from "@/db";
import { workspaces, workspaceMembers } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { ok, errorToResponse, parseBody } from "@/lib/http";
import { requireUser } from "@/lib/guard";
import { createWorkspaceSchema } from "@/lib/validate";

export async function GET(req: Request) {
  try {
    const { user } = await requireUser(req);
    const rows = await db
      .select({
        workspace: workspaces,
        role: workspaceMembers.role,
        members: sql<number>`(
          select count(*)::int from ${workspaceMembers} wm2
          where wm2.workspace_id = ${workspaces.id}
        )`.as("members"),
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, user.id))
      .orderBy(desc(workspaces.createdAt));
    return ok({
      workspaces: rows.map((r) => ({
        id: r.workspace.id,
        name: r.workspace.name,
        description: r.workspace.description,
        createdAt: r.workspace.createdAt,
        myRole: r.role,
        membersCount: r.members,
      })),
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireUser(req);
    const body = await parseBody(req, createWorkspaceSchema);
    const ws = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(workspaces)
        .values({ name: body.name, description: body.description, createdBy: user.id })
        .returning();
      await tx.insert(workspaceMembers).values({
        workspaceId: created.id,
        userId: user.id,
        role: "owner",
      });
      return created;
    });
    return ok(
      {
        workspace: {
          id: ws.id,
          name: ws.name,
          description: ws.description,
          createdAt: ws.createdAt,
          myRole: "owner",
          membersCount: 1,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
