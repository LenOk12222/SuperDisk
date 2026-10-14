import type { DeviceKind } from "@/lib/diagram/types";

/**
 * Стилизованные сетевые значки (в духе Cisco topology icons):
 * единая обводка, би-колор (primary + accent), прозрачная подложка.
 */
export function DeviceGlyph({
  kind,
  color = "#4cc2ff",
  className,
}: {
  kind: DeviceKind;
  color?: string;
  className?: string;
}) {
  const body = <GlyphArt kind={kind} color={color} />;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden style={{ overflow: "visible" }}>
      {body}
    </svg>
  );
}

/** Голая геометрия значка (без обёртки <svg>) — для встраивания в сцены редактора */
export function GlyphArt({ kind, color = "#4cc2ff" }: { kind: DeviceKind; color?: string }) {
  const sw = 5;
  const p = { stroke: color, strokeWidth: sw, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const fillSoft = `${color}22`;

  let body: React.ReactNode = null;
  switch (kind) {
    case "pc":
      body = (
        <>
          <rect x="12" y="14" width="76" height="48" rx="7" {...p} fill={fillSoft} />
          <path d="M50 62 V76 M36 82 H64" {...p} />
        </>
      );
      break;
    case "laptop":
      body = (
        <>
          <rect x="26" y="18" width="48" height="36" rx="5" {...p} fill={fillSoft} />
          <path d="M14 74 H86 L76 84 H24 Z" {...p} fill={fillSoft} />
        </>
      );
      break;
    case "server":
      body = (
        <>
          <rect x="28" y="10" width="44" height="80" rx="7" {...p} fill={fillSoft} />
          <path d="M34 33 H66 M34 55 H66 M34 77 H62" {...p} />
          <circle cx="62" cy="21" r="4" fill={color} stroke="none" />
        </>
      );
      break;
    case "printer":
      body = (
        <>
          <rect x="33" y="10" width="34" height="20" rx="4" {...p} />
          <rect x="13" y="30" width="74" height="36" rx="7" {...p} fill={fillSoft} />
          <rect x="33" y="66" width="34" height="18" rx="4" {...p} fill={fillSoft} />
          <circle cx="74" cy="43" r="4" fill={color} stroke="none" />
        </>
      );
      break;
    case "phone":
      body = (
        <>
          <path
            d="M22 28 Q22 16 34 16 H66 Q78 16 78 28 V36 H61 V46 Q61 56 50 56 Q39 56 39 46 V36 H22 Z"
            {...p}
            fill={fillSoft}
          />
          {[[38, 70], [50, 70], [62, 70], [38, 81], [50, 81], [62, 81]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3.4" fill={color} stroke="none" opacity="0.85" />
          ))}
        </>
      );
      break;
    case "router":
      body = (
        <>
          <circle cx="50" cy="50" r="37" {...p} fill={fillSoft} />
          <path d="M28 40 H68 M59 31 L68 40 L59 49" {...p} />
          <path d="M72 60 H32 M41 69 L32 60 L41 51" {...p} />
        </>
      );
      break;
    case "switch":
      body = (
        <>
          <rect x="10" y="26" width="80" height="48" rx="7" {...p} fill={fillSoft} />
          <path d="M24 43 H66 M57 34 L66 43 L57 52" {...p} />
          <path d="M76 59 H34 M43 68 L34 59 L43 50" {...p} />
        </>
      );
      break;
    case "firewall":
      body = (
        <>
          <rect x="12" y="22" width="76" height="56" rx="5" {...p} fill={fillSoft} />
          <path d="M12 41 H88 M12 59 H88" {...p} />
          <path d="M38 22 V41 M62 22 V41 M50 41 V59 M28 59 V78 M64 59 V78" {...p} />
        </>
      );
      break;
    case "ap":
      body = (
        <>
          <path d="M50 76 V56" {...p} />
          <ellipse cx="50" cy="79" rx="17" ry="6" {...p} fill={fillSoft} />
          <circle cx="50" cy="50" r="5" fill={color} stroke="none" />
          <path d="M38 45 A15 15 0 0 1 62 45" {...p} />
          <path d="M30 38 A26 26 0 0 1 70 38" {...p} />
        </>
      );
      break;
    case "cloud":
      body = (
        <path
          d="M30 72 a13 13 0 0 1 -3-25.5 18 18 0 0 1 33 -8 14 14 0 0 1 13 14.5 12 12 0 0 1 -9 19 Z"
          {...p}
          fill={fillSoft}
        />
      );
      break;
  }
  return <g color={color}>{body}</g>;
}

export const DEVICE_ORDER: DeviceKind[] = [
  "pc",
  "laptop",
  "server",
  "printer",
  "phone",
  "router",
  "switch",
  "firewall",
  "ap",
  "cloud",
];
