import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notes, workspaceMembers } from "@/db/schema";
import { getServerAuth } from "@/lib/session";
import NoteEditor from "@/components/notes/NoteEditor";

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id, noteId } = await params;
  const auth = await getServerAuth();
  if (!auth) redirect("/login");
  const [note] = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  if (!note || note.workspaceId !== id) redirect(`/app/w/${id}?tab=notes`);
  const member = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, auth.user.id)))
    .limit(1);
  if (member.length === 0) redirect("/app");
  return <NoteEditor workspaceId={id} noteId={noteId} />;
}
