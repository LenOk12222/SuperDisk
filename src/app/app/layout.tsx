import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/session";
import { ToastProvider } from "@/components/ui";
import TopBar from "@/components/app/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth();
  if (!auth) redirect("/login");
  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col bg-ink-950 text-fog-50">
        <TopBar user={{ displayName: auth.user.displayName, username: auth.user.username, email: auth.user.email }} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
