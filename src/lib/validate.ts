import { z } from "zod";

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ

export const usernameSchema = z
  .string()
  .min(3, "Логин от 3 символов")
  .max(32, "Логин до 32 символов")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Только латиница, цифры, _ . -");

export const passwordSchema = z
  .string()
  .min(8, "Пароль от 8 символов")
  .max(128, "Пароль до 128 символов");

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email("Некорректный email").max(254),
  displayName: z.string().min(1).max(64).optional(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  login: z.string().min(1, "Укажите логин или email").max(254),
  password: z.string().min(1, "Введите пароль").max(128),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(""),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
});

export const addMemberSchema = z.object({
  login: z.string().min(1, "Укажите логин или email пользователя").max(254),
  role: z.enum(["owner", "member"]).optional().default("member"),
});

export const upsertNoteSchema = z.object({
  title: z.string().min(1, "Заголовок обязателен").max(200),
  content: z.string().max(200_000).optional().default(""),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(200_000).optional(),
});

export const diagramDocSchema = z.object({
  version: z.literal(1),
  objects: z.array(z.record(z.string(), z.unknown())).max(2000),
});

export const upsertDiagramSchema = z.object({
  name: z.string().min(1).max(120),
  doc: diagramDocSchema,
});

export const updateDiagramSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  doc: diagramDocSchema.optional(),
});

export const ocrSchema = z.object({
  lang: z.enum(["eng", "rus"]).optional().default("rus"),
});

/** Разрешённые типы файлов: расширение → MIME-маска */
export const ALLOWED_FILE_TYPES: Array<{ exts: string[]; mimes: string[]; label: string }> = [
  { label: "PNG", exts: ["png"], mimes: ["image/png"] },
  { label: "JPEG", exts: ["jpg", "jpeg"], mimes: ["image/jpeg"] },
  { label: "GIF", exts: ["gif"], mimes: ["image/gif"] },
  { label: "WebP", exts: ["webp"], mimes: ["image/webp"] },
  { label: "PDF", exts: ["pdf"], mimes: ["application/pdf"] },
  { label: "TXT", exts: ["txt", "log", "conf", "cfg"], mimes: ["text/plain"] },
  { label: "Markdown", exts: ["md"], mimes: ["text/markdown", "text/plain"] },
  { label: "CSV", exts: ["csv"], mimes: ["text/csv", "application/vnd.ms-excel"] },
  { label: "JSON", exts: ["json"], mimes: ["application/json", "text/plain"] },
  {
    label: "ZIP",
    exts: ["zip"],
    mimes: ["application/zip", "application/x-zip-compressed"],
  },
  {
    label: "DOCX",
    exts: ["docx"],
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  {
    label: "XLSX",
    exts: ["xlsx"],
    mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
];

export function fileTypeAllowed(fileName: string, mime: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_FILE_TYPES.some((t) => {
    if (!t.exts.includes(ext)) return false;
    return t.mimes.some(
      (m) => m === mime || mime === "application/octet-stream" || m.startsWith(m + ";"),
    );
  });
}

export function sanitizeFileName(name: string): string {
  const base = name.replace(/[\\/]/g, "_").slice(0, 180);
  // убираем управляющие символы, сохраняем юникод (в т.ч. кириллицу)
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\x00-\x1f"<>|?*]/g, "_").trim() || "file";
}

export const OCR_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const OCR_MAX_SIZE = 10 * 1024 * 1024;
