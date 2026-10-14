export type ShapeKind =
  | "rect"
  | "square"
  | "circle"
  | "ellipse"
  | "triangle"
  | "line"
  | "arrow";

export type DeviceKind =
  | "pc"
  | "laptop"
  | "server"
  | "printer"
  | "phone"
  | "router"
  | "switch"
  | "firewall"
  | "ap"
  | "cloud";

export type LinkKind = "ethernet" | "fiber" | "wireless";

export type Vec = { x: number; y: number };

export type Target =
  | { type: "shape"; kind: ShapeKind }
  | { type: "device"; kind: DeviceKind };

export type StrokeObj = {
  id: string;
  t: "stroke";
  pts: Vec[];
  color: string;
  width: number;
};

export type ShapeObj = {
  id: string;
  t: "shape";
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  raw?: StrokeObj["pts"][]; // исходный набросок (для «вернуть набросок»)
};

export type DeviceObj = {
  id: string;
  t: "device";
  kind: DeviceKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  raw?: StrokeObj["pts"][];
};

export type LinkObj = {
  id: string;
  t: "link";
  aId: string;
  bId: string;
  kind: LinkKind;
};

export type TextObj = {
  id: string;
  t: "text";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  size: number;
};

export type DiagramObject = StrokeObj | ShapeObj | DeviceObj | LinkObj | TextObj;

export type DiagramDoc = { version: 1; objects: DiagramObject[] };

export const DEVICE_META: Record<DeviceKind, { label: string }> = {
  pc: { label: "ПК" },
  laptop: { label: "Ноутбук" },
  server: { label: "Сервер" },
  printer: { label: "Принтер" },
  phone: { label: "IP-телефон" },
  router: { label: "Маршрутизатор" },
  switch: { label: "Коммутатор" },
  firewall: { label: "Межсетевой экран" },
  ap: { label: "Точка доступа" },
  cloud: { label: "Облако сети" },
};

export const SHAPE_META: Record<ShapeKind, { label: string }> = {
  rect: { label: "Прямоугольник" },
  square: { label: "Квадрат" },
  circle: { label: "Круг" },
  ellipse: { label: "Эллипс" },
  triangle: { label: "Треугольник" },
  line: { label: "Линия" },
  arrow: { label: "Стрелка" },
};

export const LINK_META: Record<LinkKind, { label: string; color: string; dash?: string }> = {
  ethernet: { label: "Ethernet", color: "#4cc2ff" },
  fiber: { label: "Оптоволокно", color: "#ffb454", dash: "10 6" },
  wireless: { label: "Беспроводное", color: "#3ee6c4", dash: "2 7" },
};

export function targetLabel(t: Target): string {
  return t.type === "shape" ? SHAPE_META[t.kind].label : DEVICE_META[t.kind].label;
}
