import path from "path";
import { createWorker, type Worker, OEM } from "tesseract.js";

/**
 * Серверный OCR: tesseract.js (WASM) + локально поставляемые traineddata,
 * интернет не требуется. Воркеры переиспользуются (прогрев ~1-2 c при первом вызове).
 */
const globalOcr = globalThis as typeof globalThis & {
  __ocrWorkers?: Map<string, Promise<Worker>>;
};

function langDir(lang: "eng" | "rus") {
  return path.join(
    process.cwd(),
    "node_modules",
    "@tesseract.js-data",
    lang,
    "4.0.0_best_int",
  );
}

export function getOcrWorker(lang: "eng" | "rus"): Promise<Worker> {
  if (!globalOcr.__ocrWorkers) globalOcr.__ocrWorkers = new Map();
  let p = globalOcr.__ocrWorkers.get(lang);
  if (!p) {
    p = createWorker([lang], OEM.LSTM_ONLY, {
      langPath: langDir(lang),
      gzip: true,
      cacheMethod: "none",
      logger: () => {},
    });
    globalOcr.__ocrWorkers.set(lang, p);
    // если воркер не сумел стартовать — не кэшируем отказ
    p.catch(() => globalOcr.__ocrWorkers?.delete(lang));
  }
  return p;
}

export async function recognizeImage(
  buf: Buffer,
  lang: "eng" | "rus",
): Promise<{ text: string; confidence: number }> {
  const worker = await getOcrWorker(lang);
  const result = await worker.recognize(buf);
  return { text: result.data.text.trim(), confidence: result.data.confidence };
}
