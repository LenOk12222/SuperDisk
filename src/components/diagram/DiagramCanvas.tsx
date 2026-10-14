"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { recognize, type Candidate } from "@/lib/diagram/recognizer";
import { GlyphArt } from "./DeviceIcon";
import { Legend, SuggestionPopover, Toolbar, type Tool } from "./DiagramPanels";
import {
  LINK_META,
  type DiagramObject,
  type DeviceKind,
  type DeviceObj,
  type LinkKind,
  type ShapeKind,
  type ShapeObj,
  type StrokeObj,
  type TextObj,
  type Vec,
} from "@/lib/diagram/types";

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const INK_COLOR = "#8fb8ff";
const SHAPE_COLOR = "#9cc3ff";

type DragState =
  | { mode: "pan"; sx: number; sy: number; ox: number; oy: number }
  | { mode: "move"; start: Vec; orig: DiagramObject }
  | { mode: "resize"; handle: "nw" | "ne" | "sw" | "se"; start: Vec; orig: DiagramObject }
  | { mode: "draw" };

type Box = { x: number; y: number; w: number; h: number };

function bboxOf(points: Vec[][]): Box {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of points)
    for (const p of s) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) };
}

function objBox(o: DiagramObject): Box {
  if (o.t === "stroke") return bboxOf([o.pts]);
  if (o.t === "link") return { x: 0, y: 0, w: 0, h: 0 };
  return { x: o.x, y: o.y, w: o.w, h: o.h };
}

function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToPolyline(p: Vec, pts: Vec[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i - 1], pts[i]));
  return pts.length === 1 ? Math.hypot(p.x - pts[0].x, p.y - pts[0].y) : best;
}

function anchorOf(box: Box, toward: Vec): Vec {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const dx = toward.x - cx, dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const kx = dx ? (box.w / 2 + 8) / Math.abs(dx) : Infinity;
  const ky = dy ? (box.h / 2 + 8) / Math.abs(dy) : Infinity;
  const k = Math.min(kx, ky);
  return { x: cx + dx * k, y: cy + dy * k };
}

export default function DiagramCanvas({
  initial,
  onChange,
}: {
  initial: DiagramObject[];
  onChange: (objects: DiagramObject[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [objects, setObjects] = useState<DiagramObject[]>(initial);
  const objectsRef = useRef(objects);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [tool, setTool] = useState<Tool>("draw");
  const [view, setView] = useState({ x: 60, y: 50, z: 1 });
  const [selection, setSelection] = useState<string | null>(null);
  const [ink, setInk] = useState<{ pts: Vec[] }[]>([]);
  const [active, setActive] = useState<Vec[] | null>(null);
  const [suggestion, setSuggestion] = useState<{ cands: Candidate[]; box: Box } | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [linkKind, setLinkKind] = useState<LinkKind>("ethernet");
  const [legendOpen, setLegendOpen] = useState(true);
  const [textDraft, setTextDraft] = useState<string | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const historyRef = useRef<{ undo: DiagramObject[][]; redo: DiagramObject[][] }>({ undo: [], redo: [] });
  const [histVersion, setHistVersion] = useState(0);
  const inkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setAndSync = useCallback((next: DiagramObject[]) => {
    objectsRef.current = next;
    setObjects(next);
  }, []);

  const pushHistory = useCallback(() => {
    historyRef.current.undo.push(objectsRef.current);
    if (historyRef.current.undo.length > 100) historyRef.current.undo.shift();
    historyRef.current.redo = [];
    setHistVersion((v) => v + 1);
  }, []);

  const commit = useCallback(
    (next: DiagramObject[]) => {
      pushHistory();
      setAndSync(next);
      onChangeRef.current(next);
    },
    [pushHistory, setAndSync],
  );

  const clearInkTimers = () => {
    if (inkTimerRef.current) clearTimeout(inkTimerRef.current);
    if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    inkTimerRef.current = null;
    suggestionTimerRef.current = null;
  };

  const commitInk = useCallback(() => {
    clearInkTimers();
    setSuggestion(null);
    setInk((prev) => {
      if (prev.length === 0) return prev;
      const strokes: StrokeObj[] = prev.map((s) => ({
        id: uid(),
        t: "stroke",
        pts: s.pts,
        color: INK_COLOR,
        width: 2.5,
      }));
      commit([...objectsRef.current, ...strokes]);
      return [];
    });
  }, [commit]);

  /* ————— координаты ————— */
  const toWorld = useCallback((clientX: number, clientY: number): Vec => {
    const rect = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.z, y: (clientY - rect.top - v.y) / v.z };
  }, []);
  const viewRef = useRef(view);
  viewRef.current = view;
  const toScreen = useCallback(
    (p: Vec): Vec => ({ x: p.x * view.z + view.x, y: p.y * view.z + view.y }),
    [view],
  );

  /* ————— попадание по объектам ————— */
  const hitTest = useCallback(
    (p: Vec): string | null => {
      const tolerance = 9 / viewRef.current.z;
      for (let i = objectsRef.current.length - 1; i >= 0; i--) {
        const o = objectsRef.current[i];
        if (o.t === "device" || o.t === "shape" || o.t === "text") {
          const pad = 4;
          if (p.x >= o.x - pad && p.x <= o.x + o.w + pad && p.y >= o.y - pad && p.y <= o.y + o.h + pad) return o.id;
        } else if (o.t === "stroke") {
          if (distToPolyline(p, o.pts) < tolerance) return o.id;
        } else if (o.t === "link") {
          const a = objectsRef.current.find((x) => x.id === o.aId);
          const b = objectsRef.current.find((x) => x.id === o.bId);
          if (a && b && (a.t === "device" || a.t === "shape") && (b.t === "device" || b.t === "shape")) {
            const pa = anchorOf(objBox(a), centerOf(b));
            const pb = anchorOf(objBox(b), centerOf(a));
            if (distToSegment(p, pa, pb) < tolerance) return o.id;
          }
        }
      }
      return null;
    },
    [],
  );

  const linkableAt = useCallback(
    (p: Vec): (DeviceObj | ShapeObj) | null => {
      for (let i = objectsRef.current.length - 1; i >= 0; i--) {
        const o = objectsRef.current[i];
        if ((o.t === "device" || o.t === "shape") &&
          p.x >= o.x - 4 && p.x <= o.x + o.w + 4 && p.y >= o.y - 4 && p.y <= o.y + o.h + 4) {
          return o;
        }
      }
      return null;
    },
    [],
  );

  /* ————— распознавание ————— */
  function onStrokeEnd(pts: Vec[]) {
    if (pts.length < 2) return;
    const group = [...ink, { pts }];
    setInk(group);
    const cands = recognize(group.map((g) => g.pts));
    clearInkTimers();
    if (cands.length > 0 && cands[0].score >= 0.68) {
      setSuggestion({ cands, box: bboxOf(group.map((g) => g.pts)) });
      suggestionTimerRef.current = setTimeout(() => commitInk(), 14000);
    } else {
      setSuggestion(null);
      inkTimerRef.current = setTimeout(() => commitInk(), 1500);
    }
  }

  function acceptCandidate(id: Candidate["id"]) {
    clearInkTimers();
    const group = ink;
    if (group.length === 0) return;
    const raw = group.map((g) => g.pts);
    const box = bboxOf(raw);
    const PAD = 10;
    let obj: DiagramObject;
    const isDevice = !["rect", "square", "circle", "ellipse", "triangle", "line", "arrow"].includes(id);
    if (isDevice) {
      const side = Math.max(Math.max(box.w, box.h) + PAD * 2, 68);
      obj = {
        id: uid(),
        t: "device",
        kind: id as DeviceKind,
        x: box.x + box.w / 2 - side / 2,
        y: box.y + box.h / 2 - side / 2,
        w: side,
        h: side,
        raw,
      } satisfies DeviceObj;
    } else {
      const sq = id === "square" || id === "circle";
      const w = sq ? Math.max(box.w, box.h) + PAD : box.w + PAD;
      const h = sq ? w : box.h + PAD;
      obj = {
        id: uid(),
        t: "shape",
        kind: id as ShapeKind,
        x: box.x + box.w / 2 - w / 2,
        y: box.y + box.h / 2 - h / 2,
        w: Math.max(w, 20),
        h: Math.max(h, 20),
        color: SHAPE_COLOR,
        raw,
      } satisfies ShapeObj;
    }
    setInk([]);
    setSuggestion(null);
    commit([...objectsRef.current, obj]);
    setSelection(obj.id);
    setTool("select");
  }

  /* ————— указатель ————— */
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    svgRef.current?.setPointerCapture(e.pointerId);
    const p = toWorld(e.clientX, e.clientY);

    if (e.button === 1 || tool === "pan") {
      dragRef.current = { mode: "pan", sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y };
      return;
    }
    if (e.button !== 0 && e.pointerType !== "touch") return;

    if (tool === "draw") {
      commitLinkCancel();
      // продолжение многоштрихового жеста рядом с предложением
      if (suggestion) {
        const sp = toScreen({ x: suggestion.box.x + suggestion.box.w / 2, y: suggestion.box.y + suggestion.box.h / 2 });
        const distS = Math.hypot(e.clientX - svgRef.current!.getBoundingClientRect().left - sp.x, e.clientY - svgRef.current!.getBoundingClientRect().top - sp.y);
        if (distS > 240) commitInk();
        else setSuggestion(null) ?? clearInkTimers();
      }
      if (ink.length >= 3) commitInk();
      dragRef.current = { mode: "draw" };
      setActive([p]);
      return;
    }

    if (tool === "connect") {
      const target = linkableAt(p);
      if (!target) {
        setLinkFrom(null);
        return;
      }
      if (!linkFrom) {
        setLinkFrom(target.id);
        return;
      }
      if (linkFrom !== target.id) {
        const dup = objectsRef.current.some(
          (o) => o.t === "link" && ((o.aId === linkFrom && o.bId === target.id) || (o.aId === target.id && o.bId === linkFrom)),
        );
        if (!dup) {
          commit([...objectsRef.current, { id: uid(), t: "link", aId: linkFrom, bId: target.id, kind: linkKind }]);
        }
      }
      setLinkFrom(null);
      return;
    }

    // select
    const hit = hitTest(p);
    commitInk();
    if (hit) {
      setSelection(hit);
      const orig = objectsRef.current.find((o) => o.id === hit)!;
      dragRef.current = { mode: "move", start: p, orig: { ...orig } };
      pushHistory();
    } else {
      setSelection(null);
      dragRef.current = { mode: "pan", sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y };
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "pan") {
      setView((v) => ({ ...v, x: drag.ox + (e.clientX - drag.sx), y: drag.oy + (e.clientY - drag.sy) }));
      return;
    }
    const p = toWorld(e.clientX, e.clientY);
    if (drag.mode === "draw") {
      setActive((prev) => {
        if (!prev) return prev;
        const last = prev[prev.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) < 1.6 / viewRef.current.z) return prev;
        return [...prev, p];
      });
      return;
    }
    if (drag.mode === "move") {
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      const orig = drag.orig;
      setAndSync(
        objectsRef.current.map((o) => {
          if (o.id !== orig.id) return o;
          if (o.t === "stroke") {
            const oStroke = orig as StrokeObj;
            return { ...o, pts: oStroke.pts.map((q) => ({ x: q.x + dx, y: q.y + dy })) };
          }
          if (o.t === "link") return o;
          const oBox = orig as DeviceObj | ShapeObj | TextObj;
          return { ...o, x: oBox.x + dx, y: oBox.y + dy } as DiagramObject;
        }),
      );
      return;
    }
    if (drag.mode === "resize") {
      const orig = drag.orig as DeviceObj | ShapeObj | TextObj;
      const ax = drag.handle === "nw" || drag.handle === "sw" ? orig.x + orig.w : orig.x;
      const ay = drag.handle === "nw" || drag.handle === "ne" ? orig.y + orig.h : orig.y;
      let nx = Math.min(ax, p.x), ny = Math.min(ay, p.y);
      let nw = Math.abs(p.x - ax), nh = Math.abs(p.y - ay);
      if (orig.t === "device" || (orig.t === "shape" && (orig.kind === "square" || orig.kind === "circle")) || orig.t === "text") {
        const side = Math.max(nw, nh);
        nw = orig.t === "text" ? nw : side;
        nh = orig.t === "text" ? nh : side;
      }
      nw = Math.max(nw, 24);
      nh = Math.max(nh, 24);
      nx = Math.min(ax - 0, p.x < ax ? p.x : ax);
      ny = Math.min(ay - 0, p.y < ay ? p.y : ay);
      setAndSync(
        objectsRef.current.map((o) =>
          o.id === orig.id && o.t !== "stroke" && o.t !== "link"
            ? ({ ...o, x: nx, y: ny, w: nw, h: nh } as DiagramObject)
            : o,
        ),
      );
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.mode === "draw") {
      setActive((prev) => {
        if (prev) onStrokeEnd(prev);
        return null;
      });
      return;
    }
    if (drag.mode === "move" || drag.mode === "resize") {
      onChangeRef.current(objectsRef.current);
      setHistVersion((v) => v + 1);
    }
    svgRef.current?.releasePointerCapture(e.pointerId);
  }

  function commitLinkCancel() {
    setLinkFrom(null);
  }

  /* ————— колесо = зум ————— */
  function onWheel(e: React.WheelEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setView((v) => {
      const z = Math.min(2.6, Math.max(0.35, v.z * Math.exp(-e.deltaY * 0.0012)));
      return { x: cx - ((cx - v.x) / v.z) * z, y: cy - ((cy - v.y) / v.z) * z, z };
    });
  }

  function zoomBy(f: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    setView((v) => {
      const z = Math.min(2.6, Math.max(0.35, v.z * f));
      return { x: cx - ((cx - v.x) / v.z) * z, y: cy - ((cy - v.y) / v.z) * z, z };
    });
  }

  /* ————— операции с выделением ————— */
  const selected = useMemo(
    () => objects.find((o) => o.id === selection),
    [objects, selection],
  );

  function deleteSelection() {
    if (!selection) return;
    const removed = objectsRef.current.filter(
      (o) => o.id !== selection && !(o.t === "link" && (o.aId === selection || o.bId === selection)),
    );
    commit(removed);
    setSelection(null);
  }

  function restoreRaw() {
    const o = selected;
    if (!o || (o.t !== "device" && o.t !== "shape") || !o.raw) return;
    const strokes: StrokeObj[] = o.raw.map((pts) => ({ id: uid(), t: "stroke", pts, color: INK_COLOR, width: 2.5 }));
    commit([
      ...objectsRef.current.filter(
        (x) => x.id !== o.id && !(x.t === "link" && (x.aId === o.id || x.bId === o.id)),
      ),
      ...strokes,
    ]);
    setSelection(null);
  }

  function insertAtCenter(o: DiagramObject) {
    const rect = svgRef.current!.getBoundingClientRect();
    const c = toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const placed = "x" in o ? { ...o, x: c.x - o.w / 2, y: c.y - o.h / 2 } : o;
    commit([...objectsRef.current, placed as DiagramObject]);
    setSelection(placed.id);
    setTool("select");
  }

  function insertShape(kind: ShapeKind) {
    const base = { id: uid(), t: "shape", kind, color: SHAPE_COLOR } as const;
    const obj = kind === "line" || kind === "arrow"
      ? { ...base, x: 0, y: 0, w: 160, h: kind === "arrow" ? 110 : 2 }
      : { ...base, x: 0, y: 0, w: kind === "square" || kind === "circle" ? 110 : 150, h: kind === "square" || kind === "circle" ? 110 : 90 };
    insertAtCenter(obj as DiagramObject);
  }

  function insertDevice(kind: DeviceKind) {
    insertAtCenter({ id: uid(), t: "device", kind, x: 0, y: 0, w: 96, h: 96 } as DeviceObj);
  }

  function addText() {
    insertAtCenter({ id: uid(), t: "text", x: 0, y: 0, w: 160, h: 28, text: "Подпись", size: 16 } as TextObj);
  }

  /* ————— клавиатура ————— */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === "Escape") {
        if (suggestion) commitInk();
        else if (linkFrom) setLinkFrom(null);
        else setSelection(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo(e.shiftKey);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        undo(true);
      } else if (e.key === "v") setTool("select");
      else if (e.key === "h") setTool("pan");
      else if (e.key === "d") setTool("draw");
      else if (e.key === "c") setTool("connect");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, suggestion, linkFrom, commitInk]);

  function undo(redo = false) {
    const h = historyRef.current;
    const from = redo ? h.redo : h.undo;
    const to = redo ? h.undo : h.redo;
    const prev = from.pop();
    if (!prev) return;
    to.push(objectsRef.current);
    setAndSync(prev);
    onChangeRef.current(prev);
    setHistVersion((v) => v + 1);
    setSelection(null);
  }

  /* ————— утилиты рендера ————— */
  function centerOf(o: DiagramObject): Vec {
    const b = objBox(o);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  function strokeColorOf(obj: ShapeObj): string {
    return obj.color || SHAPE_COLOR;
  }

  function renderObject(o: DiagramObject) {
    if (o.t === "stroke") {
      return (
        <path
          key={o.id}
          d={o.pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={o.color}
          strokeWidth={o.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity={0.95}
        />
      );
    }
    if (o.t === "device") {
      return (
        <g key={o.id} transform={`translate(${o.x} ${o.y}) scale(${o.w / 100} ${o.h / 100})`}>
          <GlyphArt kind={o.kind} />
        </g>
      );
    }
    if (o.t === "shape") {
      const c = strokeColorOf(o);
      const common = {
        stroke: c,
        strokeWidth: 2.4,
        vectorEffect: "non-scaling-stroke" as const,
        fill: `${c}14`,
      };
      switch (o.kind) {
        case "rect":
        case "square":
          return <rect key={o.id} x={o.x} y={o.y} width={o.w} height={o.h} rx={4} {...common} />;
        case "ellipse":
        case "circle":
          return <ellipse key={o.id} cx={o.x + o.w / 2} cy={o.y + o.h / 2} rx={o.w / 2} ry={o.h / 2} {...common} />;
        case "triangle":
          return (
            <path
              key={o.id}
              d={`M${o.x + o.w / 2},${o.y} L${o.x + o.w},${o.y + o.h} L${o.x},${o.y + o.h} Z`}
              {...common}
            />
          );
        case "line":
        case "arrow": {
          const x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
          const ang = Math.atan2(y2 - y1, x2 - x1);
          const hl = 14;
          return (
            <g key={o.id} stroke={c} strokeWidth={2.4} strokeLinecap="round">
              <line x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" />
              {o.kind === "arrow" && (
                <path
                  d={`M${x2},${y2} L${x2 - hl * Math.cos(ang - 0.45)},${y2 - hl * Math.sin(ang - 0.45)} M${x2},${y2} L${x2 - hl * Math.cos(ang + 0.45)},${y2 - hl * Math.sin(ang + 0.45)}`}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        }
      }
    }
    if (o.t === "text") {
      return (
        <text
          key={o.id}
          x={o.x}
          y={o.y + o.size * 0.9}
          fontSize={o.size}
          fill="#dbe6f5"
          style={{ userSelect: "none" }}
        >
          {o.text}
        </text>
      );
    }
    if (o.t === "link") {
      const a = objects.find((x) => x.id === o.aId);
      const b = objects.find((x) => x.id === o.bId);
      if (!a || !b) return null;
      const pa = anchorOf(objBox(a), centerOf(b));
      const pb = anchorOf(objBox(b), centerOf(a));
      const meta = LINK_META[o.kind];
      const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
      return (
        <g key={o.id}>
          <line
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke={meta.color}
            strokeWidth={o.kind === "fiber" ? 2.6 : 2.2}
            strokeDasharray={meta.dash}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.95}
          />
          {o.kind === "wireless" && (
            <g transform={`translate(${mid.x} ${mid.y})`} stroke={meta.color} fill="none" strokeWidth={1.6}>
              <circle r={2} fill={meta.color} stroke="none" />
              <path d="M-6,-5 A7.8,7.8 0 0 1 6,-5" />
              <path d="M-10,-9 A13,13 0 0 1 10,-9" />
            </g>
          )}
        </g>
      );
    }
    return null;
  }

  const selBox = selected && selected.t !== "link" ? objBox(selected) : null;
  const z = view.z;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        className={`absolute inset-0 h-full w-full ${tool === "draw" ? "cursor-pen" : tool === "pan" ? "cursor-grab" : "cursor-default"}`}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="dgrid" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill="rgba(139,164,200,0.22)" />
          </pattern>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>
          <rect x="-6000" y="-6000" width="12000" height="12000" fill="url(#dgrid)" />
          {objects.filter((o) => o.t === "link").map(renderObject)}
          {objects.filter((o) => o.t !== "link").map(renderObject)}
          {ink.map((s, i) => (
            <path
              key={`ink-${i}`}
              d={s.pts.map((p, j) => `${j ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none"
              stroke={INK_COLOR}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="1 0"
              opacity={0.85}
            />
          ))}
          {active && (
            <path
              d={active.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none"
              stroke={INK_COLOR}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {/* выделение */}
          {selBox && (
            <g>
              <rect
                x={selBox.x - 5}
                y={selBox.y - 5}
                width={selBox.w + 10}
                height={selBox.h + 10}
                className="sel-outline"
                vectorEffect="non-scaling-stroke"
              />
              {(["nw", "ne", "sw", "se"] as const).map((h) => {
                const hx = h === "nw" || h === "sw" ? selBox.x - 5 : selBox.x + selBox.w + 5;
                const hy = h === "nw" || h === "ne" ? selBox.y - 5 : selBox.y + selBox.h + 5;
                return (
                  <circle
                    key={h}
                    cx={hx}
                    cy={hy}
                    r={5 / Math.max(z, 0.5)}
                    fill="#0a0e14"
                    stroke="#4cc2ff"
                    strokeWidth={1.6}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (selected && selected.t !== "link" && selected.t !== "stroke") {
                        dragRef.current = { mode: "resize", handle: h, start: toWorld(e.clientX, e.clientY), orig: { ...selected } };
                        pushHistory();
                        svgRef.current?.setPointerCapture(e.pointerId);
                      }
                    }}
                  />
                );
              })}
            </g>
          )}
          {selected?.t === "link" && renderLinkHighlight(selected as Extract<DiagramObject, { t: "link" }>)}
          {linkFrom && renderPendingSource(linkFrom)}
        </g>
      </svg>

      {/* тулбар */}
      <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 max-lg:left-4 max-lg:translate-x-0">
        <Toolbar
          tool={tool}
          setTool={(t) => {
            commitInk();
            setLinkFrom(null);
            setTool(t);
          }}
          linkKind={linkKind}
          setLinkKind={setLinkKind}
          canUndo={historyRef.current.undo.length > 0 || histVersion < 0}
          canRedo={historyRef.current.redo.length > 0}
          onUndo={() => undo(false)}
          onRedo={() => undo(true)}
          canDelete={!!selection}
          onDelete={deleteSelection}
          canRestoreRaw={!!(selected && (selected.t === "device" || selected.t === "shape") && selected.raw)}
          onRestoreRaw={restoreRaw}
          onInsertShape={insertShape}
          onInsertDevice={insertDevice}
          onAddText={addText}
        />
      </div>

      {/* зум */}
      <div className="glass absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-xl px-1.5 py-1">
        <button className="rounded-lg p-1.5 text-fog-300 transition hover:bg-ink-700" onClick={() => zoomBy(0.8)}>
          <Minus className="size-4" />
        </button>
        <span className="w-12 text-center font-mono text-[11px] text-fog-300">{Math.round(z * 100)}%</span>
        <button className="rounded-lg p-1.5 text-fog-300 transition hover:bg-ink-700" onClick={() => zoomBy(1.25)}>
          <Plus className="size-4" />
        </button>
      </div>

      {/* подсказки режимов */}
      {tool === "connect" && (
        <div className="glass absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-xl px-4 py-2 text-[12.5px] text-fog-300">
          {linkFrom ? "Теперь кликните второе устройство" : "Кликните первое устройство"} · тип:{" "}
          <b style={{ color: LINK_META[linkKind].color }}>{LINK_META[linkKind].label}</b>
        </div>
      )}
      {tool === "draw" && !suggestion && (
        <div className="glass absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-xl px-4 py-2 text-[12.5px] text-fog-400">
          Набросайте фигуру или значок как в легенде — предложу аккуратную замену
        </div>
      )}

      {/* редактирование текста */}
      {selected?.t === "text" && (
        <div
          className="glass absolute z-30 rounded-xl p-2"
          style={{
            left: toScreen({ x: selected.x, y: 0 }).x,
            top: toScreen({ x: 0, y: selected.y }).y + selected.h * z + 10,
          }}
        >
          <input
            autoFocus
            className="field py-1.5 text-sm"
            value={textDraft ?? selected.text}
            onChange={(e) => {
              setTextDraft(e.target.value);
              const w = Math.max(80, e.target.value.length * selected.size * 0.62);
              setAndSync(
                objectsRef.current.map((o) =>
                  o.id === selected.id && o.t === "text" ? { ...o, text: e.target.value, w } : o,
                ),
              );
            }}
            onBlur={() => {
              setTextDraft(null);
              onChangeRef.current(objectsRef.current);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </div>
      )}

      {/* предложение распознавания */}
      {suggestion && (
        <SuggestionPopover
          x={toScreen({ x: suggestion.box.x + suggestion.box.w / 2, y: 0 }).x}
          y={toScreen({ x: 0, y: suggestion.box.y + suggestion.box.h }).y + 14}
          candidates={suggestion.cands}
          onAccept={() => acceptCandidate(suggestion.cands[0].id)}
          onPick={(id) => acceptCandidate(id)}
          onDiscard={commitInk}
        />
      )}

      <Legend open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} />
    </div>
  );

  function renderLinkHighlight(o: Extract<DiagramObject, { t: "link" }>) {
    const a = objectsRef.current.find((x) => x.id === o.aId);
    const b = objectsRef.current.find((x) => x.id === o.bId);
    if (!a || !b) return null;
    const pa = anchorOf(objBox(a), centerOf(b));
    const pb = anchorOf(objBox(b), centerOf(a));
    return (
      <line
        x1={pa.x}
        y1={pa.y}
        x2={pb.x}
        y2={pb.y}
        stroke="#fff"
        strokeWidth={6}
        opacity={0.25}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  function renderPendingSource(id: string) {
    const o = objectsRef.current.find((x) => x.id === id);
    if (!o || o.t === "link" || o.t === "stroke") return null;
    const b = objBox(o);
    return (
      <rect
        x={b.x - 8}
        y={b.y - 8}
        width={b.w + 16}
        height={b.h + 16}
        rx={10}
        fill="none"
        stroke={LINK_META[linkKind].color}
        strokeWidth={2}
        strokeDasharray="7 5"
        vectorEffect="non-scaling-stroke"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="0.8s" repeatCount="indefinite" />
      </rect>
    );
  }
}
