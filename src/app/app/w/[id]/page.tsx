import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceMembers } from "@/db/schema";
import { getServerAuth } from "@/lib/session";
import WorkspaceScreen from "@/components/app/workspace/WorkspaceScreen";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await getServerAuth();
  if (!auth) redirect("/login");
  const member = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, auth.user.id)))
    .limit(1);
  if (member.length === 0) redirect("/app");
  return <WorkspaceScreen workspaceId={id} />;
}
