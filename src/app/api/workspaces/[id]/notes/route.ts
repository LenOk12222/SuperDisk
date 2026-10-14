import { db } from "@/db";
import { notes, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ok, errorToResponse, parseBody } from "@/lib/http";
import { requireUser, requireMembership } from "@/lib/guard";
import { upsertNoteSchema } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireMembership(user, id);
    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        authorId: notes.authorId,
        authorName: users.displayName,
        content: notes.content,
      })
      .from(notes)
      .innerJoin(users, eq(users.id, notes.authorId))
      .where(eq(notes.workspaceId, id))
      .orderBy(desc(notes.updatedAt));
    return ok({
      notes: rows.map((r) => ({
        ...r,
        excerpt: r.content.slice(0, 160),
        content: undefined,
      })),
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { user } = await requireUser(req);
    await requireMembership(user, id);
    const body = await parseBody(req, upsertNoteSchema);
    const [row] = await db
      .insert(notes)
      .values({
        workspaceId: id,
        authorId: user.id,
        title: body.title,
        content: body.content,
      })
      .returning();
    return ok({ note: row }, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
