/**
 * Заранее определённые образцы рукописных обозначений (п.3 ТЗ):
 * для каждой фигуры и сетевого значка задан эталонный росчерк (штрихи 0..1),
 * который показывается пользователю в легенде и лежит в основе распознавателя.
 */
import type { DeviceKind, ShapeKind } from "./types";

export type Pt = [number, number];
export type TemplateId = ShapeKind | DeviceKind;

export interface StrokeTemplate {
  id: TemplateId;
  strokes: Pt[][];
}

const P = (pts: Pt[]): Pt[] => pts;

function circleStroke(cx = 0.5, cy = 0.5, r = 0.44, n = 28, start = -Math.PI / 2): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

function arcStroke(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (a1 - a0);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

/** Эталоны фигур */
const shapeTemplates: StrokeTemplate[] = [
  { id: "line", strokes: [P([[0, 0.5], [1, 0.5]])] },
  {
    id: "arrow",
    strokes: [
      P([[0, 0.5], [0.72, 0.5]]),
      P([[0.5, 0.2], [0.72, 0.5]]),
      P([[0.5, 0.8], [0.72, 0.5]]),
    ],
  },
  {
    id: "triangle",
    strokes: [P([[0.5, 0.03], [0.97, 0.97], [0.03, 0.97], [0.5, 0.03]])],
  },
  { id: "rect", strokes: [P([[0.03, 0.18], [0.97, 0.18], [0.97, 0.82], [0.03, 0.82], [0.03, 0.18]])] },
  { id: "square", strokes: [P([[0.03, 0.03], [0.97, 0.03], [0.97, 0.97], [0.03, 0.97], [0.03, 0.03]])] },
  { id: "circle", strokes: [circleStroke()] },
  { id: "ellipse", strokes: [arcStroke(0.5, 0.5, 0.46, 0.29, 0, Math.PI * 2, 28)] },
];

/** Эталоны сетевых обозначений (рисуются «как в легенде») */
const deviceTemplates: StrokeTemplate[] = [
  // ПК: монитор + подставка (2 штриха)
  {
    id: "pc",
    strokes: [
      P([[0.14, 0.06], [0.86, 0.06], [0.86, 0.64], [0.14, 0.64], [0.14, 0.06]]),
      P([[0.34, 0.94], [0.66, 0.94], [0.5, 0.94], [0.5, 0.64]]),
    ],
  },
  // Ноутбук: экран + основание (2 штриха)
  {
    id: "laptop",
    strokes: [
      P([[0.22, 0.08], [0.78, 0.08], [0.78, 0.6], [0.22, 0.6], [0.22, 0.08]]),
      P([[0.02, 0.88], [0.98, 0.88], [0.78, 0.6], [0.22, 0.6], [0.02, 0.88]]),
    ],
  },
  // Сервер: стойка со слотами (3 штриха)
  {
    id: "server",
    strokes: [
      P([[0.16, 0.04], [0.84, 0.04], [0.84, 0.96], [0.16, 0.96], [0.16, 0.04]]),
      P([[0.16, 0.36], [0.84, 0.36]]),
      P([[0.16, 0.64], [0.84, 0.64]]),
    ],
  },
  // Принтер: лоток, корпус, бумага (3 штриха)
  {
    id: "printer",
    strokes: [
      P([[0.28, 0.04], [0.72, 0.04]]),
      P([[0.04, 0.3], [0.96, 0.3], [0.96, 0.72], [0.04, 0.72], [0.04, 0.3]]),
      P([[0.28, 0.94], [0.72, 0.94]]),
    ],
  },
  // IP-телефон: трубка (многогранный контур, 1 штрих)
  {
    id: "phone",
    strokes: [
      P([
        [0.16, 0.14], [0.84, 0.14], [0.84, 0.42], [0.66, 0.42],
        [0.66, 0.74], [0.34, 0.74], [0.34, 0.42], [0.16, 0.42], [0.16, 0.14],
      ]),
    ],
  },
  // Маршрутизатор: круг + две стрелки (3 штриха)
  {
    id: "router",
    strokes: [
      circleStroke(0.5, 0.5, 0.46),
      P([[0.58, 0.24], [0.74, 0.38], [0.26, 0.38]]),
      P([[0.42, 0.76], [0.26, 0.62], [0.74, 0.62]]),
    ],
  },
  // Коммутатор: прямоугольник + две стрелки (3 штриха)
  {
    id: "switch",
    strokes: [
      P([[0.04, 0.2], [0.96, 0.2], [0.96, 0.8], [0.04, 0.8], [0.04, 0.2]]),
      P([[0.56, 0.24], [0.72, 0.38], [0.3, 0.38]]),
      P([[0.44, 0.76], [0.28, 0.62], [0.7, 0.62]]),
    ],
  },
  // Межсетевой экран: «кирпичная стена» (3 штриха)
  {
    id: "firewall",
    strokes: [
      P([[0.04, 0.14], [0.96, 0.14], [0.96, 0.86], [0.04, 0.86], [0.04, 0.14]]),
      P([[0.04, 0.5], [0.96, 0.5]]),
      P([[0.5, 0.14], [0.5, 0.5]]),
    ],
  },
  // Точка доступа: дуги-волны + точка (3 штриха)
  {
    id: "ap",
    strokes: [
      arcStroke(0.5, 0.92, 0.13, 0.12, -Math.PI * 0.85, -Math.PI * 0.15, 10),
      arcStroke(0.5, 0.92, 0.3, 0.28, -Math.PI * 0.85, -Math.PI * 0.15, 12),
      arcStroke(0.5, 0.92, 0.46, 0.44, -Math.PI * 0.85, -Math.PI * 0.15, 14),
    ],
  },
  // Облако: контур облака (1 штрих)
  {
    id: "cloud",
    strokes: [
      [
        ...arcStroke(0.33, 0.72, 0.2, 0.2, Math.PI * 0.5, Math.PI * 1.35, 8),
        ...arcStroke(0.42, 0.42, 0.24, 0.24, Math.PI * 0.9, Math.PI * 1.9, 8),
        ...arcStroke(0.68, 0.46, 0.22, 0.22, Math.PI * 1.05, Math.PI * 2.0, 8),
        ...arcStroke(0.78, 0.68, 0.17, 0.17, Math.PI * 1.6, Math.PI * 0.55, 8),
        ...P([[0.61, 0.87], [0.33, 0.92]]),
      ] as Pt[],
    ],
  },
];

export const TEMPLATES: StrokeTemplate[] = [...shapeTemplates, ...deviceTemplates];

export function templateById(id: TemplateId): StrokeTemplate {
  return TEMPLATES.find((t) => t.id === id)!;
}

export const isShapeTemplate = (id: TemplateId): id is ShapeKind =>
  shapeTemplates.some((t) => t.id === id);

export function targetOf(id: TemplateId): { type: "shape" | "device"; kind: TemplateId } {
  return { type: isShapeTemplate(id) ? "shape" : "device", kind: id };
}

/** Рендер эталона (для легенды) — нормализован в видимую рамку */
export function templateToPath(tpl: StrokeTemplate, size: number, pad = 6): string {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const s of tpl.strokes) for (const [x, y] of s) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const w = Math.max(0.001, maxX - minX);
  const h = Math.max(0.001, maxY - minY);
  const k = Math.min((size - pad * 2) / w, (size - pad * 2) / h);
  const ox = pad + ((size - pad * 2) - w * k) / 2;
  const oy = pad + ((size - pad * 2) - h * k) / 2;
  return tpl.strokes
    .map((s) =>
      s
        .map(([x, y], i) => `${i === 0 ? "M" : "L"}${(ox + (x - minX) * k).toFixed(1)},${(oy + (y - minY) * k).toFixed(1)}`)
        .join(" "),
    )
    .join(" ");
}
