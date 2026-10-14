"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Trash2, Users } from "lucide-react";
import { api, ApiClientError, fmtDate } from "@/lib/api-client";
import { Badge, Confirm, Empty, Modal, Spinner, useToast, SkeletonList } from "@/components/ui";

type Ws = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  myRole: "owner" | "member";
  membersCount: number;
};

export default function WorkspacesBrowser() {
  const toast = useToast();
  const [items, setItems] = useState<Ws[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [delId, setDelId] = useState<Ws | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ workspaces: Ws[] }>("/api/workspaces");
      setItems(d.workspaces);
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Не удалось загрузить пространства");
      setItems([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function createWs() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/workspaces", { method: "POST", body: { name: name.trim(), description: desc.trim() } });
      toast("ok", "Пространство создано");
      setCreateOpen(false);
      setName("");
      setDesc("");
      load();
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Ошибка создания");
    } finally {
      setBusy(false);
    }
  }

  async function deleteWs() {
    if (!delId) return;
    setBusy(true);
    try {
      await api(`/api/workspaces/${delId.id}`, { method: "DELETE" });
      toast("ok", `Пространство «${delId.name}» удалено`);
      setDelId(null);
      load();
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Ошибка удаления");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-pulse-400">// пространства</p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Мои пространства</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Новое пространство
        </button>
      </div>

      {items === null ? (
        <SkeletonList rows={3} />
      ) : items.length === 0 ? (
        <Empty
          icon={<FolderKanban className="size-10" />}
          title="Пока ни одного пространства"
          hint="Создайте пространство и добавьте коллег по логину или email — они увидят его в своём списке."
          action={
            <button className="btn btn-primary btn-sm mt-1" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Создать пространство
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((w, i) => (
            <Link
              key={w.id}
              href={`/app/w/${w.id}`}
              className="card group relative flex flex-col gap-3 p-5"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-[16px] font-semibold leading-snug group-hover:text-pulse-300">
                  {w.name}
                </h2>
                <Badge tone={w.myRole === "owner" ? "owner" : "neutral"}>
                  {w.myRole === "owner" ? "владелец" : "участник"}
                </Badge>
              </div>
              {w.description && <p className="line-clamp-2 text-[13px] text-fog-400">{w.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-2 text-[12px] text-fog-500">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  {w.membersCount}
                </span>
                <span>{fmtDate(w.createdAt)}</span>
              </div>
              {w.myRole === "owner" && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setDelId(w);
                  }}
                  className="absolute bottom-4 right-4 rounded-lg p-2 text-fog-600 opacity-0 transition hover:bg-rose-400/10 hover:text-rose-400 group-hover:opacity-100"
                  title="Удалить пространство"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </Link>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новое пространство">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-fog-300">Название</span>
            <input
              className="field"
              placeholder="Сегмент ЦОД-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-fog-300">Описание (необязательно)</span>
            <textarea
              className="field min-h-20 resize-y"
              placeholder="Проектирование и документация сети второго ЦОД…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={500}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setCreateOpen(false)}>
              Отмена
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy || !name.trim()} onClick={createWs}>
              {busy && <Spinner className="size-3.5" />}
              Создать
            </button>
          </div>
        </div>
      </Modal>

      <Confirm
        open={delId !== null}
        onClose={() => setDelId(null)}
        onConfirm={deleteWs}
        loading={busy}
        title="Удалить пространство?"
        text={`«${delId?.name}» будет удалено вместе со всеми файлами, заметками и схемами. Действие необратимо.`}
      />
    </div>
  );
}
