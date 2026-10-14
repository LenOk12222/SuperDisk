"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cable,
  ChevronDown,
  Hand,
  History,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import type { Candidate } from "@/lib/diagram/recognizer";
import { DEVICE_META, LINK_META, SHAPE_META, type DeviceKind, type LinkKind, type ShapeKind } from "@/lib/diagram/types";
import { templateById, templateToPath, isShapeTemplate } from "@/lib/diagram/templates";
import { DeviceGlyph, DEVICE_ORDER } from "./DeviceIcon";

export type Tool = "select" | "pan" | "draw" | "connect";

const SHAPE_ORDER: ShapeKind[] = ["rect", "square", "circle", "ellipse", "triangle", "line", "arrow"];

/** Мини-рисунок эталонного обозначения (как надо рисовать) */
export function SketchSample({ id, size = 40 }: { id: ShapeKind | DeviceKind; size?: number }) {
  const d = templateToPath(templateById(id), size, 4);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={isShapeTemplate(id) ? undefined : "3 2.5"}
      />
    </svg>
  );
}

export function ShapeIcon({ kind, className }: { kind: ShapeKind; className?: string }) {
  const c = { stroke: "currentColor", strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let body: React.ReactNode;
  switch (kind) {
    case "rect":
      body = <rect x="4" y="7" width="16" height="10" rx="1.5" {...c} />;
      break;
    case "square":
      body = <rect x="5" y="5" width="14" height="14" rx="1.5" {...c} />;
      break;
    case "circle":
      body = <circle cx="12" cy="12" r="8" {...c} />;
      break;
    case "ellipse":
      body = <ellipse cx="12" cy="12" rx="9" ry="6" {...c} />;
      break;
    case "triangle":
      body = <path d="M12 5 L20 18 H4 Z" {...c} />;
      break;
    case "line":
      body = <path d="M4 18 L20 6" {...c} />;
      break;
    case "arrow":
      body = <path d="M4 18 L17 7 M13 6.5 L17.5 6.5 L17.5 11" {...c} />;
      break;
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {body}
    </svg>
  );
}

/* ——————————————— Верхняя панель инструментов ——————————————— */

export function Toolbar({
  tool,
  setTool,
  linkKind,
  setLinkKind,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canDelete,
  onDelete,
  canRestoreRaw,
  onRestoreRaw,
  onInsertShape,
  onInsertDevice,
  onAddText,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  linkKind: LinkKind;
  setLinkKind: (k: LinkKind) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canDelete: boolean;
  onDelete: () => void;
  canRestoreRaw: boolean;
  onRestoreRaw: () => void;
  onInsertShape: (k: ShapeKind) => void;
  onInsertDevice: (k: DeviceKind) => void;
  onAddText: () => void;
}) {
  const [insertOpen, setInsertOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setInsertOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toolBtn = (id: Tool, icon: React.ReactNode, label: string, extra?: string) => (
    <button
      onClick={() => setTool(id)}
      title={label}
      className={`rounded-lg p-2 transition ${extra ?? ""} ${
        tool === id ? "bg-pulse-400/20 text-pulse-300 ring-1 ring-pulse-400/50" : "text-fog-400 hover:bg-ink-700 hover:text-fog-100"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="glass flex items-center gap-1 rounded-2xl px-2 py-1.5 shadow-xl shadow-black/40">
      {toolBtn("select", <MousePointer2 className="size-4.5" />, "Выбор и перемещение (V)")}
      {toolBtn("pan", <Hand className="size-4.5" />, "Панорама (H или перетаскивание фона)")}
      {toolBtn("draw", <PenLine className="size-4.5" />, "Рисование — набросок распознаётся (D)")}
      {toolBtn("connect", <Cable className="size-4.5" />, "Соединение: кликните два устройства (C)")}
      <button
        onClick={() => setAddTextClick()}
        title="Текстовая подпись: кликните по холсту (T)"
        className="rounded-lg p-2 text-fog-400 transition hover:bg-ink-700 hover:text-fog-100"
      >
        <Type className="size-4.5" />
      </button>

      <div className="mx-1 h-6 w-px bg-ink-600" />

      {/* тип связи */}
      <div className="mr-1 flex items-center gap-1 pl-1">
        {(Object.keys(LINK_META) as LinkKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setLinkKind(k)}
            title={LINK_META[k].label}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] transition ${
              linkKind === k ? "bg-ink-700 text-fog-50 ring-1 ring-ink-600" : "text-fog-500 hover:text-fog-300"
            }`}
          >
            <svg width="26" height="8" viewBox="0 0 26 8">
              <line
                x1="1"
                y1="4"
                x2="25"
                y2="4"
                stroke={LINK_META[k].color}
                strokeWidth="2"
                strokeDasharray={LINK_META[k].dash ? "4 3" : undefined}
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden xl:inline">{LINK_META[k].label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setInsertOpen((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-ink-700/80 px-2.5 py-2 text-[12px] font-medium text-fog-200 transition hover:bg-ink-600"
        >
          <Plus className="size-3.5" />
          Вставить
          <ChevronDown className={`size-3.5 transition ${insertOpen ? "rotate-180" : ""}`} />
        </button>
        {insertOpen && (
          <div className="glass absolute left-0 top-11 z-30 w-[290px] rounded-2xl p-3 shadow-2xl">
            <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-widest text-fog-500">Устройства</p>
            <div className="mb-3 grid grid-cols-5 gap-1">
              {DEVICE_ORDER.map((k) => (
                <button
                  key={k}
                  title={DEVICE_META[k].label}
                  onClick={() => {
                    onInsertDevice(k);
                    setInsertOpen(false);
                  }}
                  className="flex flex-col items-center gap-1 rounded-lg p-1.5 transition hover:bg-ink-700"
                >
                  <DeviceGlyph kind={k} className="size-7" />
                </button>
              ))}
            </div>
            <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-widest text-fog-500">Фигуры</p>
            <div className="grid grid-cols-7 gap-1">
              {SHAPE_ORDER.map((k) => (
                <button
                  key={k}
                  title={SHAPE_META[k].label}
                  onClick={() => {
                    onInsertShape(k);
                    setInsertOpen(false);
                  }}
                  className="rounded-lg p-1.5 text-fog-300 transition hover:bg-ink-700 hover:text-pulse-300"
                >
                  <ShapeIcon kind={k} className="mx-auto size-5" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mx-1 h-6 w-px bg-ink-600" />

      <button onClick={onUndo} disabled={!canUndo} title="Отменить (Ctrl+Z)" className="rounded-lg p-2 text-fog-400 transition hover:bg-ink-700 hover:text-fog-100 disabled:opacity-30">
        <Undo2 className="size-4.5" />
      </button>
      <button onClick={onRedo} disabled={!canRedo} title="Повторить (Ctrl+Shift+Z)" className="rounded-lg p-2 text-fog-400 transition hover:bg-ink-700 hover:text-fog-100 disabled:opacity-30">
        <Redo2 className="size-4.5" />
      </button>
      {canRestoreRaw && (
        <button
          onClick={onRestoreRaw}
          title="Вернуть исходный набросок вместо значка"
          className="rounded-lg p-2 text-amber-400 transition hover:bg-amber-400/10"
        >
          <History className="size-4.5" />
        </button>
      )}
      <button
        onClick={onDelete}
        disabled={!canDelete}
        title="Удалить выбранное (Delete)"
        className="rounded-lg p-2 text-rose-400 transition hover:bg-rose-400/10 disabled:opacity-30"
      >
        <Trash2 className="size-4.5" />
      </button>
    </div>
  );

  function setAddTextClick() {
    onAddText();
  }
}

/* ——————————————— Поповер предложения распознавания ——————————————— */

export function SuggestionPopover({
  x,
  y,
  candidates,
  onAccept,
  onPick,
  onDiscard,
}: {
  x: number;
  y: number;
  candidates: Candidate[];
  onAccept: () => void;
  onPick: (id: Candidate["id"]) => void;
  onDiscard: () => void;
}) {
  const [altOpen, setAltOpen] = useState(false);
  const top = candidates[0];
  if (!top) return null;
  const topMeta = isShapeTemplate(top.id) ? SHAPE_META[top.id as ShapeKind] : DEVICE_META[top.id as DeviceKind];

  return (
    <div
      className="glass absolute z-40 w-64 rounded-2xl p-3.5 shadow-2xl shadow-black/50"
      style={{ left: x, top: y, transform: "translate(-50%, 0)" }}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-pulse-400/40 bg-pulse-400/10 p-1.5 text-pulse-300">
          {isShapeTemplate(top.id) ? (
            <ShapeIcon kind={top.id as ShapeKind} className="size-6" />
          ) : (
            <DeviceGlyph kind={top.id as DeviceKind} className="size-8" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight">
            Похоже на «{topMeta.label}»
          </p>
          <p className="mt-0.5 font-mono text-[10.5px] text-fog-500">
            уверенность {(top.score * 100).toFixed(0)}%
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button onClick={onAccept} className="btn btn-primary btn-xs col-span-2">
          Заменить набросок
        </button>
        <button onClick={() => setAltOpen((v) => !v)} className="btn btn-ghost btn-xs">
          Другой…
        </button>
        <button onClick={onDiscard} className="btn btn-ghost btn-xs">
          Оставить штрихи
        </button>
      </div>
      {altOpen && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-ink-700 p-1">
          {candidates.map((c) => {
            const meta = isShapeTemplate(c.id) ? SHAPE_META[c.id as ShapeKind] : DEVICE_META[c.id as DeviceKind];
            return (
              <button
                key={c.id}
                onClick={() => onPick(c.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink-700"
              >
                <span className="flex size-6 shrink-0 items-center justify-center text-pulse-300">
                  {isShapeTemplate(c.id) ? (
                    <ShapeIcon kind={c.id as ShapeKind} className="size-4" />
                  ) : (
                    <DeviceGlyph kind={c.id as DeviceKind} className="size-6" />
                  )}
                </span>
                <span className="flex-1 truncate text-[12px] text-fog-200">{meta.label}</span>
                <span className="h-1 w-10 overflow-hidden rounded-full bg-ink-600">
                  <span className="block h-full rounded-full bg-pulse-400" style={{ width: `${c.score * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ——————————————— Легенда обозначений ——————————————— */

export function Legend({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <>
      <button
        onClick={onToggle}
        className="glass absolute right-4 top-4 z-30 flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium text-fog-300 transition hover:text-fog-50"
        style={{ right: open ? 292 : 16 }}
      >
        {open ? "Скрыть легенду" : "Показать легенду"}
      </button>
      {open && (
        <aside className="glass absolute bottom-4 right-4 top-16 z-20 w-[276px] overflow-y-auto rounded-2xl p-4 shadow-2xl">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-fog-500">
            Как рисовать обозначения
          </p>
          <p className="mb-4 text-[11.5px] leading-snug text-fog-400">
            Набросайте образец как в легенде — система предложит заменить его значком.
          </p>
          <div className="flex flex-col gap-1">
            {[...DEVICE_ORDER].map((k) => (
              <div key={k} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-ink-800/70">
                <span className="flex w-12 shrink-0 justify-center text-fog-300">
                  <SketchSample id={k} size={38} />
                </span>
                <span className="text-fog-600">→</span>
                <DeviceGlyph kind={k} className="size-9 shrink-0" />
                <span className="text-[12px] leading-tight text-fog-300">{DEVICE_META[k].label}</span>
              </div>
            ))}
          </div>
          <p className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-widest text-fog-500">Фигуры</p>
          <div className="grid grid-cols-2 gap-1">
            {SHAPE_ORDER.map((k) => (
              <div key={k} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-ink-800/70">
                <span className="text-fog-300">
                  <SketchSample id={k} size={30} />
                </span>
                <span className="text-[11.5px] text-fog-300">{SHAPE_META[k].label}</span>
              </div>
            ))}
          </div>
          <p className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-widest text-fog-500">Связи</p>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(LINK_META) as LinkKind[]).map((k) => (
              <div key={k} className="flex items-center gap-3 px-1.5">
                <svg width="40" height="10" viewBox="0 0 40 10">
                  <line
                    x1="2"
                    y1="5"
                    x2="38"
                    y2="5"
                    stroke={LINK_META[k].color}
                    strokeWidth="2.4"
                    strokeDasharray={LINK_META[k].dash ? "7 4" : undefined}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[11.5px] text-fog-300">{LINK_META[k].label}</span>
              </div>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
