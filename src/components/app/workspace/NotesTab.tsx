"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2 } from "lucide-react";
import { api, ApiClientError, fmtDate } from "@/lib/api-client";
import { Avatar, Confirm, Empty, Modal, SkeletonList, Spinner, useToast } from "@/components/ui";

type NoteItem = {
  id: string;
  title: string;
  excerpt: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
};

export default function NotesTab({ workspaceId }: { workspaceId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [notes, setNotes] = useState<NoteItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<NoteItem | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ notes: NoteItem[] }>(`/api/workspaces/${workspaceId}/notes`);
      setNotes(d.notes);
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Не удалось загрузить заметки");
      setNotes([]);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const d = await api<{ note: { id: string } }>(`/api/workspaces/${workspaceId}/notes`, {
        method: "POST",
        body: { title: title.trim(), content: "" },
      });
      toast("ok", "Заметка создана");
      router.push(`/app/w/${workspaceId}/notes/${d.note.id}`);
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Ошибка создания");
      setBusy(false);
    }
  }

  async function remove() {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/api/notes/${del.id}`, { method: "DELETE" });
      toast("ok", "Заметка удалена");
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
          Новая заметка
        </button>
      </div>

      {notes === null ? (
        <SkeletonList rows={3} />
      ) : notes.length === 0 ? (
        <Empty
          icon={<FileText className="size-10" />}
          title="Заметок пока нет"
          hint="Создайте первую заметку — её сможет редактировать любой участник пространства. В редакторе есть OCR: распознайте текст с картинки."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <Link
              key={n.id}
              href={`/app/w/${workspaceId}/notes/${n.id}`}
              className="card group relative flex min-h-32 flex-col p-5"
            >
              <h3 className="mb-2 truncate pr-8 font-semibold text-fog-50 group-hover:text-pulse-300">
                {n.title}
              </h3>
              <p className="mb-4 line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-fog-400">
                {n.excerpt || "…"}
              </p>
              <div className="mt-auto flex items-center justify-between text-[12px] text-fog-500">
                <span className="flex items-center gap-1.5">
                  <Avatar name={n.authorName} className="size-4.5 text-[8px]" />
                  {n.authorName}
                </span>
                <span>{fmtDate(n.updatedAt)}</span>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setDel(n);
                }}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-fog-600 opacity-0 transition hover:bg-rose-400/10 hover:text-rose-400 group-hover:opacity-100"
                title="Удалить"
              >
                <Trash2 className="size-4" />
              </button>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Новая заметка">
        <div className="flex flex-col gap-4">
          <input
            className="field"
            placeholder="Например: План адресации VLAN"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn btn-primary btn-sm" disabled={busy || !title.trim()} onClick={create}>
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
        title="Удалить заметку?"
        text={`«${del?.title}» будет удалена без возможности восстановления.`}
      />
    </div>
  );
}
