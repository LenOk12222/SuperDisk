"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Files, Network, Pencil, Users } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Badge, Modal, SkeletonList, Spinner, useToast } from "@/components/ui";
import FilesTab from "./FilesTab";
import NotesTab from "./NotesTab";
import DiagramsTab from "./DiagramsTab";
import MembersTab from "./MembersTab";

export type WsDetail = {
  workspace: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    myRole: "owner" | "member";
  };
  members: {
    userId: string;
    username: string;
    email: string;
    displayName: string;
    role: "owner" | "member";
    isMe: boolean;
    addedAt: string;
  }[];
};

const TABS = [
  { id: "files", label: "Файлы", icon: Files },
  { id: "notes", label: "Заметки", icon: FileText },
  { id: "diagrams", label: "Схемы", icon: Network },
  { id: "members", label: "Участники", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function WorkspaceScreen({ workspaceId }: { workspaceId: string }) {
  const toast = useToast();
  const router = useRouter();
  const search = useSearchParams();
  const tab = (TABS.some((t) => t.id === search.get("tab")) ? search.get("tab") : "files") as TabId;

  const [detail, setDetail] = useState<WsDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<WsDetail>(`/api/workspaces/${workspaceId}`);
      setDetail(d);
      setNewName(d.workspace.name);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Нет доступа");
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  function setTab(t: TabId) {
    router.replace(`/app/w/${workspaceId}?tab=${t}`, { scroll: false });
  }

  async function rename() {
    setBusy(true);
    try {
      await api(`/api/workspaces/${workspaceId}`, { method: "PATCH", body: { name: newName.trim() } });
      toast("ok", "Пространство переименовано");
      setRenameOpen(false);
      load();
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (err) {
    return (
      <div className="py-20 text-center text-fog-400">
        <p className="mb-4">{err}</p>
        <Link href="/app" className="btn btn-ghost btn-sm">
          <ArrowLeft className="size-4" />К пространствам
        </Link>
      </div>
    );
  }
  if (!detail) return <div className="py-8"><SkeletonList rows={4} /></div>;

  const ws = detail.workspace;

  return (
    <div className="rise py-7">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/app"
            className="mb-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-fog-500 transition hover:text-pulse-400"
          >
            <ArrowLeft className="size-3.5" />
            Все пространства
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display truncate text-2xl font-semibold">{ws.name}</h1>
            <Badge tone={ws.myRole === "owner" ? "owner" : "neutral"}>
              {ws.myRole === "owner" ? "владелец" : "участник"}
            </Badge>
            {ws.myRole === "owner" && (
              <button
                onClick={() => setRenameOpen(true)}
                className="rounded-lg p-1.5 text-fog-600 transition hover:bg-ink-800 hover:text-fog-300"
                title="Переименовать"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>
          {ws.description && <p className="mt-1 text-sm text-fog-400">{ws.description}</p>}
        </div>
      </div>

      {/* вкладки */}
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-ink-800 bg-ink-900/60 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? "tab-active" : "text-fog-400 hover:text-fog-100"
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "files" && <FilesTab workspaceId={workspaceId} />}
      {tab === "notes" && <NotesTab workspaceId={workspaceId} />}
      {tab === "diagrams" && <DiagramsTab workspaceId={workspaceId} />}
      {tab === "members" && (
        <MembersTab
          workspaceId={workspaceId}
          myRole={ws.myRole}
          members={detail.members}
          onChanged={load}
        />
      )}

      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Переименовать пространство">
        <div className="flex flex-col gap-4">
          <input
            className="field"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={80}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setRenameOpen(false)}>Отмена</button>
            <button className="btn btn-primary btn-sm" disabled={busy || !newName.trim()} onClick={rename}>
              {busy && <Spinner className="size-3.5" />}
              Сохранить
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
