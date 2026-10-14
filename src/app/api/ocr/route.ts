import { ok, errorToResponse, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/guard";
import { rateLimit } from "@/lib/ratelimit";
import { recognizeImage } from "@/lib/ocr";
import { OCR_IMAGE_TYPES, OCR_MAX_SIZE } from "@/lib/validate";

export const maxDuration = 60;

/**
 * POST /api/ocr
 * multipart/form-data: image=<png|jpeg|webp|gif>, lang=eng|rus (по умолчанию rus)
 * Результат — распознанный текст (сохранить его в заметку решает клиент).
 */
export async function POST(req: Request) {
  try {
    const { user } = await requireUser(req);
    const rl = rateLimit(`ocr:${user.id}`, 20, 60 * 1000);
    if (!rl.ok) throw new ApiError(429, "rate_limited", "Лимит распознаваний: 20 в минуту");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError(400, "bad_multipart", "Ожидается multipart/form-data");
    }
    const image = form.get("image");
    if (!(image instanceof File)) throw new ApiError(400, "image_required", "Поле image обязательно");
    if (!OCR_IMAGE_TYPES.includes(image.type)) {
      throw new ApiError(415, "unsupported_type", "Поддерживаются PNG / JPEG / WebP / GIF");
    }
    const langRaw = String(form.get("lang") ?? "rus");
    const lang = langRaw === "eng" ? ("eng" as const) : ("rus" as const);

    const buf = Buffer.from(await image.arrayBuffer());
    if (buf.length === 0) throw new ApiError(400, "empty_file", "Изображение пустое");
    if (buf.length > OCR_MAX_SIZE) throw new ApiError(413, "file_too_large", "Изображение больше 10 МБ");

    const started = Date.now();
    const { text, confidence } = await recognizeImage(buf, lang);
    return ok({
      text,
      confidence: Math.round(confidence * 10) / 10,
      lang,
      tookMs: Date.now() - started,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
