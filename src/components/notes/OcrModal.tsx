"use client";

import { useRef, useState } from "react";
import { ImageUp, ScanText, Wand2 } from "lucide-react";
import { api, ApiClientError, fmtBytes } from "@/lib/api-client";
import { Modal, Spinner, useToast } from "@/components/ui";

type Result = { text: string; confidence: number; tookMs: number; lang: string } | null;

export default function OcrModal({
  open,
  onClose,
  onInsert,
  onReplace,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<"rus" | "eng">("rus");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  function reset() {
    setFile(null);
    setResult(null);
    setBusy(false);
  }

  async function run() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("lang", lang);
      const r = await api<{ text: string; confidence: number; tookMs: number; lang: string }>(
        "/api/ocr",
        { method: "POST", body: fd },
      );
      setResult(r);
      if (!r.text.trim()) toast("info", "Текст не найден на изображении");
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Не удалось распознать");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title={
        <span className="flex items-center gap-2">
          <ScanText className="size-4 text-pulse-400" />
          Распознать текст (OCR)
        </span>
      }
      wide
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-xl border border-ink-600 text-[12.5px]">
            {(["rus", "eng"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3.5 py-1.5 transition ${lang === l ? "bg-pulse-400/15 text-pulse-300" : "text-fog-400 hover:text-fog-200"}`}
              >
                {l === "rus" ? "Русский" : "English"}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-fog-500">PNG / JPEG / WebP, до 10 МБ. Первый запуск прогревает модель.</p>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="dots-grid flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-ink-600 px-4 py-7 transition hover:border-pulse-400/50"
        >
          <ImageUp className="size-5 text-pulse-400" />
          {file ? (
            <span className="text-sm text-fog-200">
              {file.name} <span className="text-fog-500">({fmtBytes(file.size)})</span>
            </span>
          ) : (
            <span className="text-sm text-fog-400">Выберите изображение с текстом…</span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary btn-sm" disabled={!file || busy} onClick={run}>
            {busy ? <Spinner className="size-3.5" /> : <Wand2 className="size-3.5" />}
            {busy ? "Распознаём…" : "Распознать"}
          </button>
        </div>

        {busy && (
          <div className="h-1 overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-pulse-500 to-vio-500"
              style={{ animation: "sheen 1.1s linear infinite", backgroundSize: "200% 100%" }}
            />
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-[11.5px] text-fog-500">
              <span>
                уверенность: <b className="text-mint-400">{result.confidence}%</b> · {result.tookMs} мс
              </span>
              <span>текст можно отредактировать перед вставкой</span>
            </div>
            <textarea
              className="field min-h-40 resize-y font-mono text-[13px] leading-relaxed"
              value={result.text}
              onChange={(e) => setResult({ ...result, text: e.target.value })}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onReplace(result.text);
                  onClose();
                  reset();
                }}
              >
                Заменить заметку
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onInsert(result.text);
                  onClose();
                  reset();
                }}
              >
                Вставить в конец
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
