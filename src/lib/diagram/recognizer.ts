/**
 * Распознаватель набросков — упрощённый $N Unistroke Recognizer
 * (Wobbrock et al., UIST'07, обобщение $1 на многоштриховые жесты):
 *
 * 1. штрихи входа перебираются во всех порядках и направлениях (≤3 штрихов);
 * 2. комбинированный жест ресемплируется до 96 точек, масштабируется и
 *    выравнивается по первой точке (indicative angle);
 * 3. золотое сечение ищет угол ±28° с минимальным средним расстоянием
 *    до каждого эталона из templates.ts;
 * 4. эвристики замкнутости/прямизны/пропорций различают пары
 *    квадрат–прямоугольник, круг–эллипс, линия–стрелка.
 */
import { TEMPLATES, type Pt, type StrokeTemplate, type TemplateId, isShapeTemplate } from "./templates";
import type { Vec } from "./types";

const SIZE = 250;
const N = 96;
const ANGLE_RANGE = (30 * Math.PI) / 180;
const HALF_DIAG = 0.5 * Math.SQRT2 * SIZE;

type P = { x: number; y: number };

export interface Candidate {
  id: TemplateId;
  score: number;
}

/* ————— геометрия ————— */

function pathLength(pts: P[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

function resample(pts: P[], n: number): P[] {
  const I = pathLength(pts) / (n - 1);
  if (!isFinite(I) || I === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  let D = 0;
  const out: P[] = [{ ...pts[0] }];
  const src = pts.map((p) => ({ ...p }));
  for (let i = 1; i < src.length; i++) {
    const d = Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y);
    if (D + d >= I && d > 0) {
      const t = (I - D) / d;
      const q = { x: src[i - 1].x + t * (src[i].x - src[i - 1].x), y: src[i - 1].y + t * (src[i].y - src[i - 1].y) };
      out.push(q);
      src.splice(i, 0, q);
      D = 0;
    } else {
      D += d;
    }
  }
  while (out.length < n) out.push({ ...out[out.length - 1] });
  return out.slice(0, n);
}

function centroid(pts: P[]): P {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function rotateBy(pts: P[], theta: number, c: P): P[] {
  const cos = Math.cos(theta), sin = Math.sin(theta);
  return pts.map((p) => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function normalize(pts: P[]): P[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  const scale = SIZE / Math.max(w, h);
  const scaled = pts.map((p) => ({ x: (p.x - minX) * scale, y: (p.y - minY) * scale }));
  const c = centroid(scaled);
  return scaled.map((p) => ({ x: p.x + (SIZE / 2 - c.x), y: p.y + (SIZE / 2 - c.y) }));
}

function pathDistance(a: P[], b: P[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}

function goldenSection(input: P[], tpl: P[]): number {
  const c = centroid(input);
  const phi = 0.5 * (-1 + Math.sqrt(5));
  let a = -ANGLE_RANGE, b = ANGLE_RANGE;
  const f = (t: number) => pathDistance(rotateBy(input, t, c), tpl);
  let x1 = phi * a + (1 - phi) * b;
  let x2 = (1 - phi) * a + phi * b;
  let f1 = f(x1), f2 = f(x2);
  while (Math.abs(b - a) > (2 * Math.PI) / 180) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = phi * a + (1 - phi) * b; f1 = f(x1); }
    else { a = x1; x1 = x2; f1 = f2; x2 = (1 - phi) * a + phi * b; f2 = f(x2); }
  }
  return Math.min(f1, f2);
}

/* ————— перестановки штрихов (×порядок ×направление), до 48 вариантов ————— */

function permutationsWithDirections(strokes: Vec[][]): P[][] {
  const pts = strokes.map((s) => s.map((p) => ({ x: p.x, y: p.y })));
  const k = pts.length;
  const orders: number[][] = [];
  const perm = (arr: number[], l: number) => {
    if (l === k) { orders.push(arr.slice()); return; }
    for (let i = l; i < k; i++) {
      [arr[l], arr[i]] = [arr[i], arr[l]];
      perm(arr, l + 1);
      [arr[l], arr[i]] = [arr[i], arr[l]];
    }
  };
  perm([...Array(k).keys()], 0);
  const out: P[][] = [];
  for (const order of orders) {
    for (let mask = 0; mask < 1 << k; mask++) {
      const combined: P[] = [];
      for (let i = 0; i < k; i++) {
        const s = pts[order[i]];
        const dir = mask & (1 << i) ? [...s].reverse() : s;
        combined.push(...dir);
      }
      out.push(combined);
    }
  }
  return out;
}

/* ————— кэш нормализованных эталонов ————— */
const tplCache = new Map<TemplateId, P[]>();
function templatePoints(tpl: StrokeTemplate): P[] {
  let cached = tplCache.get(tpl.id);
  if (!cached) {
    const flat: P[] = tpl.strokes.flat().map(([x, y]: Pt) => ({ x, y }));
    let pts = resample(normalize(flat), N);
    // та же канонизация, что и у входного жеста: поворот к инициативному углу
    const c = centroid(pts);
    const indicative = Math.atan2(pts[0].y - c.y, pts[0].x - c.x);
    pts = rotateBy(pts, -indicative, c);
    cached = pts;
    tplCache.set(tpl.id, cached);
  }
  return cached;
}

/* ————— фичи входа ————— */
interface Features {
  strokeCount: number;
  closed: boolean;
  straightness: number; // 0..1
  aspect: number;       // w/h всех точек
  perimRatio: number;
  corners: number;      // резкие изломы главного штриха
}

function countCorners(stroke: Vec[]): number {
  const pts = resample(stroke.map((p) => ({ x: p.x, y: p.y })), 64);
  const win = 5;
  let corners = 0;
  let lastAt = -win * 2;
  for (let i = win; i < pts.length - win; i++) {
    const a = pts[i - win], b = pts[i], c = pts[i + win];
    const v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
    if (Math.hypot(v1x, v1y) < 1e-3 || Math.hypot(v2x, v2y) < 1e-3) continue;
    const ang = Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
    if (ang > 0.95 && ang < Math.PI - 0.5 && i - lastAt > win) {
      corners++;
      lastAt = i;
    }
  }
  return corners;
}

function features(strokes: Vec[][]): Features {
  const all = strokes.flat();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of all) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(1e-6, maxX - minX);
  const h = Math.max(1e-6, maxY - minY);
  const first = strokes[0];
  const fs = first.map((p) => ({ x: p.x, y: p.y }));
  const pl = pathLength(fs);
  const chord = Math.hypot(fs[fs.length - 1].x - fs[0].x, fs[fs.length - 1].y - fs[0].y);
  const closed = strokes.length === 1 && pl > 0 && chord / Math.max(w, h) < 0.22;
  const straightness = pl > 0 ? chord / pl : 0;
  const perim = 2 * (w + h);
  const longest = [...strokes].sort((a, b) => b.length - a.length)[0];
  return {
    strokeCount: strokes.length,
    closed,
    straightness,
    aspect: w / h,
    perimRatio: perim > 0 ? pl / perim : 0,
    corners: countCorners(longest),
  };
}

export function recognize(rawStrokes: Vec[][], maxStrokes = 3): Candidate[] {
  const strokes = rawStrokes.filter((s) => s.length >= 2).slice(0, maxStrokes);
  if (strokes.length === 0) return [];
  const f = features(strokes);
  const perms = permutationsWithDirections(strokes);
  const normalized = perms.map((p) => resample(normalize(p), N));

  const results: Candidate[] = [];
  const aIn = Math.max(f.aspect, 1 / f.aspect); // асимметрия входа ≥ 1 (без учёта ориентации)

  for (const tpl of TEMPLATES) {
    const tplPts = templatePoints(tpl);
    // у вытянутых фигур неоднозначна ось — пробуем повороты ±90°
    const extraRots =
      aIn > 1.25 && (tpl.id === "rect" || tpl.id === "ellipse")
        ? [Math.PI / 2, -Math.PI / 2]
        : [];
    let best = Infinity;
    for (const cand of normalized) {
      // инициативный поворот к первой точке
      const c = centroid(cand);
      const indicative = Math.atan2(cand[0].y - c.y, cand[0].x - c.x);
      const rotated = rotateBy(cand, -indicative, c);
      const d = goldenSection(rotated, tplPts);
      if (d < best) best = d;
      for (const extra of extraRots) {
        const d2 = goldenSection(rotateBy(cand, extra - indicative, c), tplPts);
        if (d2 < best) best = d2;
      }
    }
    let score = 1 - best / HALF_DIAG;

    // штраф за несовпадение числа штрихов
    score *= Math.max(0.4, 1 - 0.13 * Math.abs(f.strokeCount - tpl.strokes.length));

    const closedTpl = ["rect", "square", "circle", "ellipse", "triangle", "phone"].includes(tpl.id);
    const openTpl = ["line", "arrow", "ap"].includes(tpl.id);

    // пропорции: квадрат/круг хотят симметричный рисунок, прямоугольник/эллипс — наоборот
    const la = Math.abs(Math.log(aIn));
    if (tpl.id === "square") score *= Math.exp(-la * 2.2);
    if (tpl.id === "circle") score *= Math.exp(-la * 2.0);
    if (tpl.id === "rect") score *= Math.min(1, 0.5 + la * 2.0);
    if (tpl.id === "ellipse") score *= Math.min(1, 0.55 + la * 1.6);
    if (tpl.id === "triangle") score *= Math.exp(-la * 0.9);

    // изломы: у прямоугольника и треугольника есть вершины, у эллипса — нет
    if (f.corners >= 3) {
      if (tpl.id === "rect") score *= 1.15;
      if (tpl.id === "ellipse") score *= 0.82;
      if (tpl.id === "circle" || tpl.id === "ap") score *= 0.8;
    } else if (f.closed && f.corners <= 2) {
      if (tpl.id === "ellipse") score *= 1.1;
      if (tpl.id === "rect") score *= 0.85;
    }

    if (tpl.id === "line") {
      if (f.strokeCount > 1) score *= 0.5;
      else score *= f.straightness > 0.93 ? 1.2 : f.straightness < 0.7 ? 0.62 : 1;
    }
    if (tpl.id === "arrow" && f.strokeCount === 1 && f.straightness < 0.65) score *= 1.05;

    if (f.strokeCount === 1) {
      if (f.closed && closedTpl) score *= 1.1;
      if (f.closed && openTpl) score *= 0.7;
      if (!f.closed && closedTpl && isShapeTemplate(tpl.id)) score *= 0.82;
      if (!f.closed && !isShapeTemplate(tpl.id) && tpl.strokes.length > 1) score *= 0.9;
    }
    // чистая замкнутая рука → это скорее фигура, чем сетевой значок
    if (f.strokeCount === 1 && f.closed && !isShapeTemplate(tpl.id)) score *= 0.88;

    results.push({ id: tpl.id, score: Math.max(0, Math.min(1, score)) });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 6);
}

/** Подпись качества распознавания для UI */
export function confidenceLabel(score: number): string {
  if (score >= 0.86) return "высокая уверенность";
  if (score >= 0.74) return "средняя уверенность";
  return "низкая уверенность";
}

export const ACCEPT_THRESHOLD = 0.7;
