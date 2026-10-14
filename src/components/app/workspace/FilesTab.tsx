"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CloudUpload,
  Download,
  FileArchive,
  FileImage,
  FileText,
  File as FileIcon,
  Presentation,
  Trash2,
} from "lucide-react";
import { api, ApiClientError, fmtBytes, fmtDate } from "@/lib/api-client";
import { Avatar, Confirm, Empty, SkeletonList, useToast } from "@/components/ui";

type FileItem = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  uploaderName: string;
  uploaderUsername: string;
};

const MAX = 20 * 1024 * 1024;
const ALLOWED_EXT = ["png", "jpg", "jpeg", "gif", "webp", "pdf", "txt", "md", "csv", "json", "zip", "docx", "xlsx", "log", "conf", "cfg"];

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime === "application/zip") return FileArchive;
  if (mime.includes("word") || mime.includes("sheet") || mime === "application/pdf") return Presentation;
  if (mime.startsWith("text/") || mime === "application/json") return FileText;
  return FileIcon;
}

function uploadXHR(url: string, file: File, onP: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onP(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      try {
        const j = JSON.parse(xhr.responseText);
        reject(new ApiClientError(xhr.status, j.error?.code ?? "error", j.error?.message ?? "Ошибка загрузки"));
      } catch {
        reject(new ApiClientError(xhr.status, "error", `Ошибка ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new ApiClientError(0, "network_error", "Нет соединения"));
    xhr.send(fd);
  });
}

type Uploading = { name: string; progress: number };

export default function FilesTab({ workspaceId }: { workspaceId: string }) {
  const toast = useToast();
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [del, setDel] = useState<FileItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ files: FileItem[] }>(`/api/workspaces/${workspaceId}/files`);
      setFiles(d.files);
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Не удалось загрузить файлы");
      setFiles([]);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(list: FileList | File[]) {
    const arr = Array.from(list);
    for (const file of arr) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (file.size > MAX) {
        toast("err", `«${file.name}» больше 20 МБ — пропущен`);
        continue;
      }
      if (!ALLOWED_EXT.includes(ext)) {
        toast("err", `«${file.name}»: тип не разрешён`);
        continue;
      }
      setUploading((u) => [...u, { name: file.name, progress: 0 }]);
      try {
        await uploadXHR(`/api/workspaces/${workspaceId}/files`, file, (p) =>
          setUploading((u) => u.map((x) => (x.name === file.name ? { ...x, progress: p } : x))),
        );
        toast("ok", `«${file.name}» загружен`);
      } catch (e) {
        toast("err", e instanceof ApiClientError ? `${file.name}: ${e.message}` : "Ошибка загрузки");
      } finally {
        setUploading((u) => u.filter((x) => x.name !== file.name));
      }
    }
    load();
  }

  async function remove() {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/api/files/${del.id}`, { method: "DELETE" });
      toast("ok", "Файл удалён");
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
      {/* дроп-зона */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`dots-grid group mb-5 flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed px-6 py-10 text-center transition ${
          drag ? "border-pulse-400 bg-pulse-400/10" : "border-ink-600 hover:border-pulse-400/50 hover:bg-ink-900/50"
        }`}
      >
        <div className={`rounded-2xl border p-3.5 transition ${drag ? "border-pulse-400/60 text-pulse-300" : "border-ink-600 text-pulse-400 group-hover:scale-105"}`}>
          <CloudUpload className="size-6" />
        </div>
        <p className="text-sm font-medium text-fog-200">
          Перетащите файлы сюда или <span className="text-pulse-400 underline underline-offset-4">выберите</span>
        </p>
        <p className="font-mono text-[11px] text-fog-500">
          до 20 МБ · png jpg gif webp pdf txt md csv json zip docx xlsx
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ALLOWED_EXT.map((e) => "." + e).join(",")}
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploading.map((u) => (
        <div key={u.name} className="mb-3 rounded-xl border border-ink-700 bg-ink-900/70 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-[12.5px]">
            <span className="truncate text-fog-200">{u.name}</span>
            <span className="font-mono text-pulse-300">{Math.round(u.progress * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pulse-500 to-vio-500 transition-all"
              style={{ width: `${u.progress * 100}%` }}
            />
          </div>
        </div>
      ))}

      {files === null ? (
        <SkeletonList rows={3} />
      ) : files.length === 0 ? (
        <Empty
          icon={<FileIcon className="size-10" />}
          title="Файлов пока нет"
          hint="Загруженные файлы хранятся в закрытом S3 и доступны только участникам пространства."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {files.map((f) => {
            const Icon = iconFor(f.mime);
            const isImage = f.mime.startsWith("image/");
            return (
              <div
                key={f.id}
                className="card group flex items-center gap-4 px-4 py-3"
              >
                <div className="shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-800">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/${f.id}/download?mode=inline`}
                      alt={f.name}
                      className="size-11 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-11 items-center justify-center text-pulse-400">
                      <Icon className="size-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fog-100">{f.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[12px] text-fog-500">
                    <span>{fmtBytes(f.size)}</span>
                    <span className="flex items-center gap-1">
                      <Avatar name={f.uploaderName} className="size-4 text-[7px]" />
                      {f.uploaderName}
                    </span>
                    <span>{fmtDate(f.createdAt)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={`/api/files/${f.id}/download`}
                    className="btn btn-ghost btn-xs"
                    title="Скачать"
                    download
                  >
                    <Download className="size-3.5" />
                    <span className="max-sm:hidden">Скачать</span>
                  </a>
                  <button
                    className="rounded-lg p-2 text-fog-600 transition hover:bg-rose-400/10 hover:text-rose-400"
                    title="Удалить"
                    onClick={() => setDel(f)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Confirm
        open={del !== null}
        onClose={() => setDel(null)}
        onConfirm={remove}
        loading={busy}
        title="Удалить файл?"
        text={`«${del?.name}» будет удалён из хранилища без возможности восстановления.`}
      />
    </div>
  );
}
