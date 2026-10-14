/**
 * Тесты распознавателя набросков ($N-recognizer).
 * Эталонные росчерки из легенды рисуются с масштабированием, поворотом и дрожанием
 * руки; ожидаемая фигура/значок должна быть в топ-2 кандидатов.
 *
 * Запуск: npx tsx --test tests/recognizer.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { recognize } from "../src/lib/diagram/recognizer";
import { TEMPLATES, type StrokeTemplate, type TemplateId } from "../src/lib/diagram/templates";
import type { Vec } from "../src/lib/diagram/types";

// детерминированный ГПСЧ
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 0xffffffff);
}

/** Имитация рукописного рисования шаблона */
function draw(tpl: StrokeTemplate, seed: number): Vec[][] {
  const rnd = lcg(seed);
  const scale = 90 + rnd() * 90;
  const rot = ((rnd() - 0.5) * 20 * Math.PI) / 180;
  const tx = 200 + rnd() * 300;
  const ty = 200 + rnd() * 300;
  const jitter = scale * 0.03;
  return tpl.strokes.map((stroke) =>
    stroke.map(([x, y]) => {
      const jx = (rnd() - 0.5) * jitter;
      const jy = (rnd() - 0.5) * jitter;
      const px = (x - 0.5) * scale + jx;
      const py = (y - 0.5) * scale + jy;
      return {
        x: tx + px * Math.cos(rot) - py * Math.sin(rot),
        y: ty + px * Math.sin(rot) + py * Math.cos(rot),
      };
    }),
  );
}

// пары фигур с одинаковым жестом — различаются пропорциями рисунка, а не эталоном
const SIBLINGS: Record<string, TemplateId[]> = {
  rect: ["rect", "square"],
  square: ["rect", "square"],
  circle: ["circle", "ellipse"],
  ellipse: ["circle", "ellipse"],
};

test("каждый эталон распознаётся как сам себя (топ-2)", () => {
  const failures: string[] = [];
  for (const tpl of TEMPLATES) {
    const expect = SIBLINGS[tpl.id] ?? [tpl.id];
    let ok = false;
    let bestDesc = "";
    for (const seed of [11, 42, 77]) {
      const strokes = draw(tpl, seed);
      const cands = recognize(strokes);
      bestDesc = cands
        .slice(0, 3)
        .map((c) => `${c.id}:${c.score.toFixed(3)}`)
        .join(" ");
      if (cands.slice(0, 2).some((c) => expect.includes(c.id))) {
        ok = true;
        break;
      }
    }
    if (!ok) failures.push(`${tpl.id} → [${bestDesc}]`);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("пропорции различают пары квадрат/прямоугольник и круг/эллипс", () => {
  const box = (w: number, h: number): Vec[][] => [
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
      { x: 0, y: 0 },
    ],
  ];
  const wide = recognize(box(220, 100));
  assert.ok(wide[0].id === "rect", `широкий прямоугольник: ${wide[0].id}`);
  const tall = recognize(box(100, 210));
  assert.ok(tall[0].id === "rect", `высокий прямоугольник: ${tall[0].id}`);

  const ellipseOf = (rx: number, ry: number): Vec[][] => {
    const pts: Vec[] = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push({ x: 200 + Math.cos(a) * rx, y: 200 + Math.sin(a) * ry });
    }
    return [pts];
  };
  const flat = recognize(ellipseOf(130, 60));
  assert.ok(flat[0].id === "ellipse", `широкий эллипс: ${flat[0].id}`);
  const round = recognize(ellipseOf(90, 88));
  assert.ok(round[0].id === "circle", `почти круг: ${round[0].id}`);
});

test("однозначные фигуры — топ-1 с уверенностью ≥ 0.6", () => {
  const strict: TemplateId[] = ["triangle", "line", "arrow"];
  for (const id of strict) {
    const tpl = TEMPLATES.find((t) => t.id === id)!;
    const cands = recognize(draw(tpl, 5));
    assert.equal(cands[0].id, id, `${id}: получили ${cands[0].id} (${cands[0].score.toFixed(3)})`);
    assert.ok(cands[0].score >= 0.6, `${id}: низкая уверенность ${cands[0].score}`);
  }
});

test("сетевые значки: router/switch/firewall/cloud — топ-1", () => {
  for (const id of ["router", "switch", "firewall", "cloud"] as TemplateId[]) {
    const tpl = TEMPLATES.find((t) => t.id === id)!;
    const cands = recognize(draw(tpl, 123));
    assert.equal(cands[0].id, id, `${id}: топ [${cands.slice(0, 3).map((c) => c.id).join(", ")}]`);
  }
});

test("мусор не принимается: хаотичный штрих даёт скор < 0.75", () => {
  const rnd = lcg(999);
  const pts: Vec[] = [];
  let x = 100, y = 100;
  for (let i = 0; i < 60; i++) {
    x += (rnd() - 0.5) * 90;
    y += (rnd() - 0.5) * 90;
    pts.push({ x, y });
  }
  const cands = recognize([pts]);
  assert.ok(cands.length === 0 || cands[0].score < 0.75, `случайный штрих не должен приниматься: ${cands[0]?.id}:${cands[0]?.score}`);
});
