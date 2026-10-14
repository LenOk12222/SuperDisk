import { db } from "@/db";
import { diagrams, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ok, errorToResponse, parseBody } from "@/lib/http";
import { requireUser, requireMembership } from "@/lib/guard";
import { upsertDiagramSchema } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireMembership(user, id);
    const rows = await db
      .select({
        id: diagrams.id,
        name: diagrams.name,
        createdAt: diagrams.createdAt,
        updatedAt: diagrams.updatedAt,
        authorId: diagrams.authorId,
        authorName: users.displayName,
      })
      .from(diagrams)
      .innerJoin(users, eq(users.id, diagrams.authorId))
      .where(eq(diagrams.workspaceId, id))
      .orderBy(desc(diagrams.updatedAt));
    return ok({ diagrams: rows });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireMembership(user, id);
    const body = await parseBody(req, upsertDiagramSchema);
    const [row] = await db
      .insert(diagrams)
      .values({
        workspaceId: id,
        authorId: user.id,
        name: body.name,
        doc: body.doc,
      })
      .returning({ id: diagrams.id, name: diagrams.name, createdAt: diagrams.createdAt, updatedAt: diagrams.updatedAt });
    return ok({ diagram: row }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
