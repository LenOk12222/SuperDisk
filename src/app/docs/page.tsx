"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenText, KeySquare, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ui";

type Operation = {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: { type?: string } }>;
  requestBody?: { required?: boolean; content: Record<string, unknown> };
  responses?: Record<string, { description?: string }>;
};

type Spec = {
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, Operation>>;
  tags?: { name: string }[];
};

const METHODS = ["get", "post", "patch", "put", "delete"] as const;
const METHOD_STYLE: Record<string, string> = {
  get: "text-mint-400 border-mint-400/40 bg-mint-400/10",
  post: "text-pulse-400 border-pulse-400/40 bg-pulse-400/10",
  patch: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  delete: "text-rose-400 border-rose-400/40 bg-rose-400/10",
};

export default function DocsPage() {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/openapi.json")
      .then((r) => r.json())
      .then(setSpec)
      .catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    if (!spec) return [];
    const map = new Map<string, Array<{ method: string; path: string; op: Operation }>>();
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const [m, op] of Object.entries(ops)) {
        if (!(METHODS as readonly string[]).includes(m)) continue;
        const tag = op.tags?.[0] ?? "Прочее";
        if (!map.has(tag)) map.set(tag, []);
        map.get(tag)!.push({ method: m, path, op });
      }
    }
    const order = (spec.tags ?? []).map((t) => t.name);
    const extra = [...map.keys()].filter((k) => !order.includes(k));
    return [...order.filter((k) => map.has(k)), ...extra].map((k) => ({ tag: k, items: map.get(k)! }));
  }, [spec]);

  const q = filter.trim().toLowerCase();

  return (
    <div className="min-h-dvh bg-ink-950 text-fog-50">
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <Link href="/app" className="rounded-lg p-1.5 text-fog-400 transition hover:bg-ink-800 hover:text-fog-100">
              <ArrowLeft className="size-4" />
            </Link>
            <Logo size={22} />
            <span className="font-display text-[13px] font-semibold tracking-[0.18em]">SETKA / API</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              className="field w-44 py-1.5 text-[13px] sm:w-64"
              placeholder="Фильтр: files, notes, ocr…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <a href="/api/openapi.json" target="_blank" className="btn btn-ghost btn-sm">
              openapi.json
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="blueprint-grid relative mb-10 overflow-hidden rounded-3xl border border-ink-800 bg-ink-900/60 p-8 sm:p-10">
          <h1 className="font-display text-3xl font-semibold">
            {spec ? spec.info.title : "Загрузка спецификации…"}
          </h1>
          <p className="mt-2 font-mono text-[12px] text-fog-400">
            OpenAPI 3.0.3 · v{spec?.info.version ?? "…"} · зеркало спеки: openapi.yaml в корне репозитория
          </p>
          {spec?.info.description && (
            <div className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-fog-300">
              {spec.info.description}
            </div>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-950/60 p-4">
              <KeySquare className="mt-0.5 size-4 shrink-0 text-pulse-400" />
              <div className="text-[12.5px] leading-relaxed text-fog-300">
                <b>Авторизация.</b> cookie <code className="font-mono text-pulse-300">sid</code> после логина
                или заголовок <code className="font-mono text-pulse-300">Authorization: Bearer &lt;token&gt;</code>.
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-950/60 p-4">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint-400" />
              <div className="text-[12.5px] leading-relaxed text-fog-300">
                <b>Права.</b> Каждая операция проверяет членство в пространстве. Посторонний получает{" "}
                <code className="font-mono text-rose-300">404</code>, участник при owner-операциях —{" "}
                <code className="font-mono text-rose-300">403</code>.
              </div>
            </div>
          </div>
        </div>

        {!spec ? (
          <p className="flex items-center gap-2 text-fog-500">
            <BookOpenText className="size-4 animate-pulse" />
            Загружаю /api/openapi.json…
          </p>
        ) : (
          grouped.map(({ tag, items }) => {
            const shown = items.filter(
              ({ method, path, op }) =>
                !q ||
                path.toLowerCase().includes(q) ||
                op.summary?.toLowerCase().includes(q) ||
                method.includes(q),
            );
            if (shown.length === 0) return null;
            return (
              <section key={tag} className="mb-10">
                <h2 className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-pulse-400">
                  <span className="h-px w-8 bg-pulse-400/40" />
                  {tag}
                </h2>
                <div className="flex flex-col gap-2.5">
                  {shown.map(({ method, path, op }) => (
                    <details key={method + path} className="card group overflow-hidden">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                        <span
                          className={`w-16 shrink-0 rounded-md border px-2 py-1 text-center font-mono text-[10.5px] font-bold uppercase tracking-wider ${METHOD_STYLE[method]}`}
                        >
                          {method}
                        </span>
                        <code className="font-mono text-[12.5px] text-fog-100">{path}</code>
                        <span className="ml-auto hidden text-[12px] text-fog-500 group-open:hidden sm:block">
                          {op.summary}
                        </span>
                      </summary>
                      <div className="border-t border-ink-800 px-4 py-4">
                        <p className="mb-3 text-sm text-fog-300">{op.summary}</p>
                        {op.parameters && op.parameters.length > 0 && (
                          <div className="mb-3">
                            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-fog-500">
                              Параметры
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {op.parameters.map((p) => (
                                <span key={p.name} className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 font-mono text-[11px] text-fog-300">
                                  {p.name}
                                  <span className="text-fog-600"> · {p.in}</span>
                                  {p.required && <span className="text-rose-400">*</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {op.requestBody && (
                          <p className="mb-3 text-[12px] text-fog-400">
                            Тело: <code className="font-mono text-pulse-300">{Object.keys(op.requestBody.content).join(", ")}</code>
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(op.responses ?? {}).map(([code, r]) => (
                            <span
                              key={code}
                              className={`rounded-md px-2 py-1 font-mono text-[11px] ${
                                code.startsWith("2")
                                  ? "bg-mint-400/10 text-mint-400"
                                  : code.startsWith("4") || code.startsWith("5")
                                    ? "bg-rose-400/10 text-rose-300"
                                    : "bg-ink-700 text-fog-300"
                              }`}
                            >
                              {code} {r.description && <span className="text-fog-500">— {r.description}</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })
        )}

        <section className="mb-16 rounded-2xl border border-ink-800 bg-ink-900/50 p-6">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-pulse-400">Быстрый пример (curl)</h2>
          <pre className="overflow-x-auto rounded-xl bg-ink-950 p-4 font-mono text-[12px] leading-relaxed text-fog-300">{`# 1. логин → получаем токен
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \\
  -H 'Content-Type: application/json' \\
  -d '{"login":"alice","password":"password-1"}' | jq -r .data.token)

# 2. список пространств
curl -s http://localhost:3000/api/workspaces \\
  -H "Authorization: Bearer $TOKEN" | jq

# 3. загрузка файла (multipart, ≤20 МБ)
curl -s -X POST http://localhost:3000/api/workspaces/<ws-id>/files \\
  -H "Authorization: Bearer $TOKEN" -F "file=@topology.pdf"

# 4. OCR картинки в текст
curl -s -X POST http://localhost:3000/api/ocr \\
  -H "Authorization: Bearer $TOKEN" -F "image=@label.png" -F "lang=rus"`}</pre>
        </section>
      </main>
    </div>
  );
}
