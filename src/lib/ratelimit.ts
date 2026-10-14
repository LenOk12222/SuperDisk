/**
 * Простой скользящий лимитер в памяти процесса.
 * Для мультиинстансного продакшена заменить на Redis (см. README).
 */

const buckets = new Map<string, number[]>();
const MAX_KEYS = 20_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const pruneBefore = now - windowMs;
  let arr = buckets.get(key);
  if (!arr) {
    if (buckets.size >= MAX_KEYS) {
      // выборочная очистка чтобы не разрасталась память
      for (const [k, v] of buckets) {
        if (v.length === 0 || v[v.length - 1] < pruneBefore) buckets.delete(k);
      }
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    arr = [];
    buckets.set(key, arr);
  }
  while (arr.length > 0 && arr[0] < pruneBefore) arr.shift();
  if (arr.length >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  arr.push(now);
  return { ok: true, retryAfterSec: 0 };
}
