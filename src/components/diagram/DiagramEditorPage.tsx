"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CloudAlert, Loader2, Save } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/components/ui";
import DiagramCanvas from "./DiagramCanvas";
import type { DiagramObject } from "@/lib/diagram/types";

export default function DiagramEditorPage({
  workspaceId,
  diagramId,
}: {
  workspaceId: string;
  diagramId: string;
}) {
  const toast = useToast();
  const [doc, setDoc] = useState<{ name: string; authorName: string; objects: DiagramObject[] } | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ name: string; objects: DiagramObject[] } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api<{ diagram: { name: string; authorName: string; doc: { objects: DiagramObject[] } } }>(
          `/api/diagrams/${diagramId}`,
        );
        const parsed = { name: d.diagram.name, authorName: d.diagram.authorName, objects: d.diagram.doc?.objects ?? [] };
        setDoc(parsed);
        setName(parsed.name);
        latestRef.current = { name: parsed.name, objects: parsed.objects };
      } catch (e) {
        toast("err", e instanceof ApiClientError ? e.message : "Схема недоступна");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramId]);

  const save = useCallback(async () => {
    const latest = latestRef.current;
    if (!latest) return;
    setStatus("saving");
    try {
      await api(`/api/diagrams/${diagramId}`, {
        method: "PATCH",
        body: {
          name: latest.name.trim() || "Схема без названия",
          doc: { version: 1, objects: latest.objects },
        },
      });
      setStatus("saved");
    } catch (e) {
      setStatus("error");
      if (e instanceof ApiClientError && e.status !== 0) toast("err", e.message);
    }
  }, [diagramId, toast]);

  const scheduleSave = useCallback(() => {
    setStatus("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(), 1500);
  }, [save]);

  const onChange = useCallback(
    (objects: DiagramObject[]) => {
      latestRef.current = { name: latestRef.current?.name ?? "", objects };
      scheduleSave();
    },
    [scheduleSave],
  );

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center text-fog-500">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-900">
      <DiagramCanvas initial={doc.objects} onChange={onChange} />
      {/* плавающий заголовок */}
      <div className="glass absolute left-4 top-4 z-40 flex max-w-[70vw] items-center gap-2 rounded-2xl px-3 py-2 max-sm:max-w-[60vw]">
        <Link
          href={`/app/w/${workspaceId}?tab=diagrams`}
          className="rounded-lg p-1.5 text-fog-400 transition hover:bg-ink-700 hover:text-fog-100"
          title="К списку схем"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <input
          value={name}
          maxLength={120}
          onChange={(e) => {
            setName(e.target.value);
            latestRef.current = { name: e.target.value, objects: latestRef.current?.objects ?? [] };
            scheduleSave();
          }}
          className="w-44 truncate bg-transparent text-sm font-semibold outline-none placeholder:text-fog-600 sm:w-56"
          placeholder="Название схемы"
        />
        <span className="flex items-center gap-1 font-mono text-[10.5px] text-fog-500">
          {status === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" />
            </>
          )}
          {status === "saved" && <Check className="size-3 text-mint-400" />}
          {status === "dirty" && <span className="text-amber-400">•</span>}
          {status === "error" && <CloudAlert className="size-3 text-rose-400" />}
        </span>
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            save();
          }}
        >
          <Save className="size-3.5" />
          Сохранить
        </button>
      </div>
    </div>
  );
}
