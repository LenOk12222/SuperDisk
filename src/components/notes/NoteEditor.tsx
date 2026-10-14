"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CloudAlert, Loader2, ScanText, Trash2 } from "lucide-react";
import { api, ApiClientError, fmtDate } from "@/lib/api-client";
import { Avatar, Confirm, useToast } from "@/components/ui";
import OcrModal from "./OcrModal";

type Note = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
};

export default function NoteEditor({ workspaceId, noteId }: { workspaceId: string; noteId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const latest = useRef({ title: "", content: "" });

  useEffect(() => {
    (async () => {
      try {
        const d = await api<{ note: Note }>(`/api/notes/${noteId}`);
        setNote(d.note);
        setTitle(d.note.title);
        setContent(d.note.content);
        latest.current = { title: d.note.title, content: d.note.content };
        setSavedAt(new Date(d.note.updatedAt));
      } catch (e) {
        toast("err", e instanceof ApiClientError ? e.message : "Заметка недоступна");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const save = useCallback(async () => {
    const { title: t, content: c } = latest.current;
    setStatus("saving");
    try {
      await api(`/api/notes/${noteId}`, {
        method: "PATCH",
        body: { title: t.trim() || "Без названия", content: c },
      });
      setStatus("saved");
      setSavedAt(new Date());
    } catch (e) {
      setStatus("error");
      if (e instanceof ApiClientError && e.status !== 0) {
        toast("err", e.message);
      }
    }
  }, [noteId, toast]);

  function markDirty() {
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 1200);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [save]);

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/notes/${noteId}`, { method: "DELETE" });
      toast("ok", "Заметка удалена");
      router.push(`/app/w/${workspaceId}?tab=notes`);
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Ошибка удаления");
      setBusy(false);
    }
  }

  if (!note) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-fog-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="rise py-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/app/w/${workspaceId}?tab=notes`}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-fog-500 transition hover:text-pulse-400"
        >
          <ArrowLeft className="size-3.5" />
          Заметки
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-fog-500">
            {status === "dirty" && <span className="text-amber-400">не сохранено…</span>}
            {status === "saving" && (
              <>
                <Loader2 className="size-3 animate-spin" /> сохраняю…
              </>
            )}
            {status === "saved" && savedAt && (
              <>
                <Check className="size-3 text-mint-400" /> {savedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </>
            )}
            {status === "error" && (
              <>
                <CloudAlert className="size-3 text-rose-400" /> ошибка сохранения
              </>
            )}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setOcrOpen(true)}>
            <ScanText className="size-4" />
            Распознать текст
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setDelOpen(true)}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            latest.current.title = e.target.value;
            markDirty();
          }}
          className="w-full border-none bg-transparent font-display text-3xl font-semibold tracking-tight outline-none placeholder:text-fog-600"
          placeholder="Название заметки"
          maxLength={200}
        />
        <div className="mb-6 mt-3 flex items-center gap-2 border-b border-ink-800 pb-5 text-[12px] text-fog-500">
          <Avatar name={note.authorName} className="size-5 text-[8px]" />
          <span>{note.authorName}</span>
          <span>·</span>
          <span>создана {fmtDate(note.createdAt)}</span>
          <span>·</span>
          <span className="font-mono text-[11px]">Ctrl+S — сохранить</span>
        </div>
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            latest.current.content = e.target.value;
            markDirty();
          }}
          className="min-h-[55dvh] w-full resize-y border-none bg-transparent text-[15px] leading-[1.8] text-fog-200 outline-none placeholder:text-fog-600"
          placeholder="Начните писать… Любой участник пространства видит и редактирует эту заметку."
        />
      </div>

      <OcrModal
        open={ocrOpen}
        onClose={() => setOcrOpen(false)}
        onInsert={(text) => {
          const next = content ? `${content.replace(/\s+$/, "")}\n\n${text}\n` : `${text}\n`;
          setContent(next);
          latest.current.content = next;
          markDirty();
          contentRef.current?.focus();
        }}
        onReplace={(text) => {
          setContent(text ? text + "\n" : "");
          latest.current.content = text ? text + "\n" : "";
          markDirty();
        }}
      />

      <Confirm
        open={delOpen}
        onClose={() => setDelOpen(false)}
        onConfirm={remove}
        loading={busy}
        title="Удалить заметку?"
        text={`«${note.title}» будет удалена без возможности восстановления.`}
      />
    </div>
  );
}
