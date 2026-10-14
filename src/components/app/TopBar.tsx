"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, LogOut, UserRound } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar, Logo } from "@/components/ui";

export default function TopBar({
  user,
}: {
  user: { displayName: string; username: string; email: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* игнорируем — сессия всё равно умрёт */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/app" className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-display text-[13.5px] font-semibold tracking-[0.18em]">SETKA</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/docs" className="btn btn-ghost btn-sm max-sm:hidden">
            <BookOpenText className="size-4" />
            API
          </Link>
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 transition hover:border-ink-700 hover:bg-ink-800/60"
            >
              <Avatar name={user.displayName || user.username} className="size-8" />
              <span className="hidden text-sm font-medium text-fog-200 sm:block">
                {user.displayName}
              </span>
            </button>
            {open && (
              <div className="glass absolute right-0 top-12 w-60 rounded-xl p-1.5 shadow-2xl">
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                  <UserRound className="size-4 text-fog-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.displayName}</p>
                    <p className="truncate font-mono text-[11px] text-fog-500">
                      @{user.username} · {user.email}
                    </p>
                  </div>
                </div>
                <div className="my-1 h-px bg-ink-700/70" />
                <button
                  onClick={logout}
                  disabled={busy}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-rose-300 transition hover:bg-rose-400/10"
                >
                  <LogOut className="size-4" />
                  Выйти из аккаунта
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
