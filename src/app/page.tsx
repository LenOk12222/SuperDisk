import Link from "next/link";
import {
  ArrowRight,
  FileLock2,
  ScanText,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Users,
  Waypoints,
} from "lucide-react";
import HeroCanvas from "@/components/landing/HeroCanvas";
import { DeviceGlyph, DEVICE_ORDER } from "@/components/diagram/DeviceIcon";
import { Logo } from "@/components/ui";
import { templateById, templateToPath } from "@/lib/diagram/templates";
import { DEVICE_META } from "@/lib/diagram/types";

const FEATURES = [
  {
    icon: FileLock2,
    title: "Приватные файлы",
    text: "Загрузка до 20 МБ в закрытое S3-хранилище. Скачивание — только после проверки прав, по presigned-ссылке.",
  },
  {
    icon: Users,
    title: "Роли owner / member",
    text: "Владелец управляет участниками пространства, участник работает с содержимым. Доступ проверяется при каждом вызове API.",
  },
  {
    icon: Waypoints,
    title: "Рисуешь — распознаём",
    text: "Набросок маршрутизатора или фигуры превращается в аккуратный значок: подтверждение, исправление, исходник сохраняется.",
  },
  {
    icon: ScanText,
    title: "OCR в заметку",
    text: "Распознавание текста с картинки (русский/английский, tesseract) с сохранением результата прямо в заметку.",
  },
  {
    icon: StickyNote,
    title: "Командные заметки",
    text: "Совместные текстовые заметки с автосохранением — спецификации сети, TODO, чек-листы настройки.",
  },
  {
    icon: ShieldCheck,
    title: "Безопасность по умолчанию",
    text: "scrypt-хеши паролей, сессии с HttpOnly-cookie, лимит попыток входа, валидация типов и секреты в env.",
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "text-mint-400 border-mint-400/30 bg-mint-400/10",
  POST: "text-pulse-400 border-pulse-400/30 bg-pulse-400/10",
  PATCH: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  DELETE: "text-rose-400 border-rose-400/30 bg-rose-400/10",
};

const API_SAMPLE = [
  ["POST", "/api/auth/login"],
  ["GET", "/api/workspaces"],
  ["POST", "/api/workspaces/:id/files"],
  ["GET", "/api/files/:id/download"],
  ["PATCH", "/api/notes/:id"],
  ["POST", "/api/workspaces/:id/diagrams"],
  ["POST", "/api/ocr"],
] as const;

export default function Landing() {
  const sketchRouter = templateToPath(templateById("router"), 120, 10);
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-ink-950 text-fog-50">
      {/* шапка */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-2xl border border-ink-700/60 bg-ink-950/70 px-4 py-2.5 backdrop-blur-xl max-sm:mx-3 sm:mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="font-display text-[15px] font-semibold tracking-[0.18em]">SETKA</span>
            <span className="rounded-full border border-ink-600 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-fog-400 max-sm:hidden">
              workspace
            </span>
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="#features" className="hidden rounded-lg px-3 py-1.5 text-fog-400 transition hover:text-fog-50 sm:block">
              Возможности
            </Link>
            <Link href="#recognize" className="hidden rounded-lg px-3 py-1.5 text-fog-400 transition hover:text-fog-50 sm:block">
              Распознавание
            </Link>
            <Link href="/docs" className="hidden rounded-lg px-3 py-1.5 text-fog-400 transition hover:text-fog-50 sm:block">
              API
            </Link>
            <Link href="/login" className="btn btn-ghost btn-sm">
              Войти
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              Начать
              <ArrowRight className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="relative">
        <HeroCanvas className="absolute inset-0 h-full w-full opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,#06080c_88%)]" />
        <div className="blueprint-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center px-5 pb-24 pt-36 text-center">
          <div className="rise mb-7 inline-flex items-center gap-2 rounded-full border border-pulse-400/25 bg-pulse-400/10 px-4 py-1.5 text-[12.5px] font-medium text-pulse-300">
            <Sparkles className="size-3.5" />
            Файлы · заметки · сетевые схемы с ML-распознаванием
          </div>
          <h1
            className="rise font-display text-[clamp(2rem,6vw,4.3rem)] font-semibold leading-[1.08] tracking-tight"
            style={{ animationDelay: "0.08s" }}
          >
            Командное пространство,
            <br />
            <span className="text-gradient">где набросок становится схемой</span>
          </h1>
          <p
            className="rise mx-auto mt-6 max-w-xl text-[15.5px] leading-relaxed text-fog-400"
            style={{ animationDelay: "0.16s" }}
          >
            Обменивайтесь файлами, редактируйте заметки и чертите топологии сети — система
            распознаёт рукописные обозначения и предлагает аккуратные значки в стиле Cisco.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.24s" }}>
            <Link href="/register" className="btn btn-primary px-6 py-3 text-[15px]">
              Создать пространство
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/docs" className="btn btn-ghost px-6 py-3 text-[15px]">
              Документация API
            </Link>
          </div>

          {/* плавающая демо-плашка */}
          <div
            className="rise tech-corners glass mt-16 flex items-center gap-6 rounded-2xl px-6 py-4"
            style={{ animationDelay: "0.34s" }}
          >
            <div className="flex flex-col items-center gap-1">
              <svg width="84" height="84" viewBox="0 0 120 120" className="text-fog-300">
                <defs>
                  <filter id="rough">
                    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" result="n" />
                    <feDisplacementMap in="SourceGraphic" in2="n" scale="4" />
                  </filter>
                </defs>
                <path
                  d={sketchRouter}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#rough)"
                  opacity="0.85"
                />
              </svg>
              <span className="font-mono text-[10px] uppercase tracking-widest text-fog-500">набросок</span>
            </div>
            <ArrowRight className="size-5 text-pulse-400" />
            <div className="flex flex-col items-center gap-1">
              <div className="rounded-xl border border-pulse-400/30 bg-pulse-400/5 p-2.5 shadow-[0_0_36px_-8px_rgba(76,194,255,.45)]">
                <DeviceGlyph kind="router" className="size-16" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-pulse-300">
                распознано · 0.93
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* возможности */}
      <section id="features" className="relative mx-auto max-w-6xl px-5 py-24">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-pulse-400">// возможности</p>
        <h2 className="font-display max-w-2xl text-3xl font-semibold leading-tight">
          Всё для работы сетевой команды в одном месте
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="card group relative overflow-hidden p-6"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-pulse-400/10 blur-2xl transition-opacity opacity-0 group-hover:opacity-100" />
              <div className="mb-4 inline-flex rounded-xl border border-ink-600 bg-ink-800 p-3 text-pulse-400">
                <f.icon className="size-5" />
              </div>
              <h3 className="mb-2 font-semibold">{f.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-fog-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* распознаваемые обозначения */}
      <section id="recognize" className="relative border-y border-ink-800 bg-ink-900/60 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-pulse-400">// редактор схем</p>
              <h2 className="font-display max-w-xl text-3xl font-semibold leading-tight">
                10 сетевых значков и 7 фигур из наброска
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-fog-400">
              Ethernet, оптоволокно и беспроводные связи привязываются к устройствам.
              Распознавание требует подтверждения, ошибку можно исправить, а исходный
              росчерк сохраняется.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {DEVICE_ORDER.map((k) => (
              <div
                key={k}
                className="card group flex flex-col items-center gap-3 p-5 text-center transition hover:-translate-y-1 hover:border-pulse-400/40"
              >
                <DeviceGlyph kind={k} className="size-14 transition group-hover:scale-110" />
                <span className="text-[12.5px] font-medium text-fog-300">{DEVICE_META[k].label}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2 font-mono text-[11px] uppercase tracking-widest text-fog-500">
            {["прямоугольник", "квадрат", "круг", "эллипс", "треугольник", "линия", "стрелка"].map((s) => (
              <span key={s} className="rounded-full border border-ink-600 px-3 py-1">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* API */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="glass grid gap-10 rounded-3xl p-8 lg:grid-cols-[1.1fr_1fr] lg:p-12">
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-pulse-400">// rest api</p>
            <h2 className="font-display text-3xl font-semibold leading-tight">OpenAPI 3.0 из коробки</h2>
            <p className="mt-4 text-sm leading-relaxed text-fog-400">
              Полная спецификация по адресу{" "}
              <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[12px] text-pulse-300">
                /api/openapi.json
              </code>{" "}
              и живой просмотрщик на странице документации. Авторизация — cookie-сессия или Bearer-токен.
            </p>
            <Link href="/docs" className="btn btn-primary mt-7">
              Открыть документацию
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="flex flex-col gap-2 font-mono text-[12.5px]">
            {API_SAMPLE.map(([m, p]) => (
              <div key={p} className="flex items-center gap-3 rounded-lg border border-ink-700/70 bg-ink-950/60 px-3.5 py-2.5">
                <span className={`rounded-md border px-2 py-0.5 text-[10.5px] font-bold tracking-wider ${METHOD_COLORS[m]}`}>
                  {m}
                </span>
                <span className="text-fog-300">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* футер */}
      <footer className="border-t border-ink-800 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-[13px] text-fog-500">
          <div className="flex items-center gap-2.5">
            <Logo size={20} />
            <span className="font-display text-xs tracking-[0.2em] text-fog-300">SETKA</span>
            <span>— командное рабочее пространство</span>
          </div>
          <p className="font-mono text-[11px]">
            Next.js · PostgreSQL · Drizzle · S3 · tesseract.js · $N recognizer
          </p>
        </div>
      </footer>
    </div>
  );
}
