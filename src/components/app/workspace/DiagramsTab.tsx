"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Network, PencilLine, Plus, Trash2 } from "lucide-react";
import { api, ApiClientError, fmtDate } from "@/lib/api-client";
import { Avatar, Confirm, Empty, Modal, SkeletonList, Spinner, useToast } from "@/components/ui";

type DiagramItem = {
  id: string;
  name: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
};

export default function DiagramsTab({ workspaceId }: { workspaceId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<DiagramItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<DiagramItem | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ diagrams: DiagramItem[] }>(`/api/workspaces/${workspaceId}/diagrams`);
      setItems(d.diagrams);
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Не удалось загрузить схемы");
      setItems([]);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const d = await api<{ diagram: { id: string } }>(`/api/workspaces/${workspaceId}/diagrams`, {
        method: "POST",
        body: { name: name.trim(), doc: { version: 1, objects: [] } },
      });
      router.push(`/app/w/${workspaceId}/diagrams/${d.diagram.id}`);
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Ошибка создания");
      setBusy(false);
    }
  }

  async function remove() {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/api/diagrams/${del.id}`, { method: "DELETE" });
      toast("ok", "Схема удалена");
      setDel(null);
      load();
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Ошибка удаления");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex justify-end">
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Новая схема
        </button>
      </div>

      {items === null ? (
        <SkeletonList rows={3} />
      ) : items.length === 0 ? (
        <Empty
          icon={<Network className="size-10" />}
          title="Схем пока нет"
          hint="Создайте схему и рисуйте мышью или пальцем — наброски распознаются в фигуры и сетевые значки. Подсказки «как рисовать» есть в легенде редактора."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((dItem) => (
            <Link
              key={dItem.id}
              href={`/app/w/${workspaceId}/diagrams/${dItem.id}`}
              className="card group relative flex items-center gap-4 p-5"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-800 text-pulse-400">
                <Network className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-fog-50 group-hover:text-pulse-300">{dItem.name}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-fog-500">
                  <Avatar name={dItem.authorName} className="size-4 text-[7px]" />
                  {dItem.authorName} · {fmtDate(dItem.updatedAt)}
                </p>
              </div>
              <PencilLine className="size-4 shrink-0 text-fog-600 transition group-hover:text-pulse-400" />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setDel(dItem);
                }}
                className="absolute bottom-3 right-3 rounded-lg p-1.5 text-fog-600 opacity-0 transition hover:bg-rose-400/10 hover:text-rose-400 group-hover:opacity-100"
                title="Удалить"
              >
                <Trash2 className="size-4" />
              </button>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Новая схема сети">
        <div className="flex flex-col gap-4">
          <input
            className="field"
            placeholder="Например: Топология ЦОД-2, ядро"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn btn-primary btn-sm" disabled={busy || !name.trim()} onClick={create}>
              {busy && <Spinner className="size-3.5" />}
              Создать и открыть
            </button>
          </div>
        </div>
      </Modal>

      <Confirm
        open={del !== null}
        onClose={() => setDel(null)}
        onConfirm={remove}
        loading={busy}
        title="Удалить схему?"
        text={`«${del?.name}» будет удалена без возможности восстановления.`}
      />
    </div>
  );
}
