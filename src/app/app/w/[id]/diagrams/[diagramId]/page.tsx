import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { diagrams, workspaceMembers } from "@/db/schema";
import { getServerAuth } from "@/lib/session";
import DiagramEditorPage from "@/components/diagram/DiagramEditorPage";

export default async function DiagramPage({
  params,
}: {
  params: Promise<{ id: string; diagramId: string }>;
}) {
  const { id, diagramId } = await params;
  const auth = await getServerAuth();
  if (!auth) redirect("/login");
  const [d] = await db.select().from(diagrams).where(eq(diagrams.id, diagramId)).limit(1);
  if (!d || d.workspaceId !== id) redirect(`/app/w/${id}?tab=diagrams`);
  const member = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, auth.user.id)))
    .limit(1);
  if (member.length === 0) redirect("/app");
  return (
    <div className="relative left-1/2 w-dvw max-w-[100vw] -translate-x-1/2" style={{ height: "calc(100dvh - 3.5rem)" }}>
      <DiagramEditorPage workspaceId={id} diagramId={diagramId} />
    </div>
  );
}
