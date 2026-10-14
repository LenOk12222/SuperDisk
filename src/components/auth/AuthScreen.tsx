"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Lock, Mail, User, ShieldCheck, Spline } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Logo, Spinner, ToastProvider, useToast } from "@/components/ui";
import { DeviceGlyph } from "@/components/diagram/DeviceIcon";
import { DeviceKind } from "@/lib/diagram/types";

const SIDE_ICONS: { kind: DeviceKind; x: string; y: string; delay: string }[] = [
  { kind: "router", x: "12%", y: "16%", delay: "0s" },
  { kind: "switch", x: "70%", y: "26%", delay: "1.2s" },
  { kind: "server", x: "18%", y: "62%", delay: "0.6s" },
  { kind: "cloud", x: "66%", y: "68%", delay: "1.8s" },
  { kind: "pc", x: "44%", y: "84%", delay: "0.9s" },
];

function Form({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    login: "",
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        await api("/api/auth/login", { method: "POST", body: { login: form.login, password: form.password } });
      } else {
        await api("/api/auth/register", {
          method: "POST",
          body: { username: form.username, email: form.email, password: form.password },
        });
      }
      toast("ok", mode === "login" ? "С возвращением!" : "Аккаунт создан. Добро пожаловать!");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Что-то пошло не так");
      setPending(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">
          {mode === "login" ? "С возвращением" : "Создать аккаунт"}
        </h1>
        <p className="mt-1.5 text-sm text-fog-400">
          {mode === "login"
            ? "Войдите по логину или email, чтобы открыть свои пространства."
            : "Регистрация займёт полминуты. Приглашать можно по логину или email."}
        </p>
      </div>

      {mode === "login" ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fog-300">Логин или email</span>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fog-600" />
            <input
              className="field pl-10"
              placeholder="net.admin или admin@corp.ru"
              value={form.login}
              onChange={set("login")}
              autoFocus
              required
            />
          </div>
        </label>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-fog-300">Логин</span>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fog-600" />
              <input
                className="field pl-10"
                placeholder="net.admin"
                pattern="[a-zA-Z0-9_.\-]{3,32}"
                title="3–32 символа: латиница, цифры, _ . -"
                value={form.username}
                onChange={set("username")}
                autoFocus
                required
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-fog-300">Email</span>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fog-600" />
              <input
                className="field pl-10"
                type="email"
                placeholder="admin@corp.ru"
                value={form.email}
                onChange={set("email")}
                required
              />
            </div>
          </label>
        </>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-fog-300">Пароль</span>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fog-600" />
          <input
            className="field pl-10"
            type="password"
            placeholder={mode === "register" ? "минимум 8 символов" : "••••••••"}
            minLength={mode === "register" ? 8 : 1}
            value={form.password}
            onChange={set("password")}
            required
          />
        </div>
      </label>

      {error && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3.5 py-2.5 text-[13px] text-rose-200">
          {error}
        </div>
      )}

      <button className="btn btn-primary py-3 text-[15px]" disabled={pending}>
        {pending ? <Spinner className="size-4" /> : mode === "login" ? <KeyRound className="size-4" /> : <ArrowRight className="size-4" />}
        {mode === "login" ? "Войти" : "Зарегистрироваться"}
      </button>

      <p className="text-center text-[13px] text-fog-500">
        {mode === "login" ? (
          <>
            Нет аккаунта?{" "}
            <Link className="font-medium text-pulse-400 hover:text-pulse-300" href="/register">
              Регистрация
            </Link>
          </>
        ) : (
          <>
            Уже есть аккаунт?{" "}
            <Link className="font-medium text-pulse-400 hover:text-pulse-300" href="/login">
              Войти
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

export default function AuthScreen({ mode }: { mode: "login" | "register" }) {
  return (
    <ToastProvider>
      <div className="relative flex min-h-dvh bg-ink-950">
        {/* брендовая панель */}
        <div className="blueprint-grid relative hidden flex-1 items-center justify-center overflow-hidden border-r border-ink-800 lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(76,194,255,0.09),transparent_55%)]" />
          {SIDE_ICONS.map((s) => (
            <div
              key={s.kind}
              className="animate-float absolute text-pulse-400/45"
              style={{ left: s.x, top: s.y, animationDelay: s.delay }}
            >
              <DeviceGlyph kind={s.kind} className="size-16" />
            </div>
          ))}
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-30">
            <line x1="20%" y1="24%" x2="70%" y2="34%" stroke="#4cc2ff" strokeDasharray="4 6" />
            <line x1="70%" y1="34%" x2="72%" y2="70%" stroke="#7c5cff" strokeDasharray="4 6" />
            <line x1="24%" y1="70%" x2="66%" y2="74%" stroke="#4cc2ff" strokeDasharray="4 6" />
          </svg>
          <div className="relative max-w-md px-10">
            <div className="mb-6 flex items-center gap-3">
              <Logo size={34} />
              <span className="font-display text-lg font-semibold tracking-[0.2em]">SETKA</span>
            </div>
            <p className="font-display text-[26px] font-medium leading-snug">
              Рабочее место инженера: <span className="text-gradient">файлы, заметки, схемы сети</span>
            </p>
            <ul className="mt-8 flex flex-col gap-3.5 text-sm text-fog-400">
              <li className="flex items-center gap-3">
                <ShieldCheck className="size-4 shrink-0 text-mint-400" />
                Приватное S3-хранилище, доступ после проверки прав
              </li>
              <li className="flex items-center gap-3">
                <Spline className="size-4 shrink-0 text-vio-400" />
                ML-распознавание набросков в значки топологии
              </li>
              <li className="flex items-center gap-3">
                <KeyRound className="size-4 shrink-0 text-pulse-400" />
                scrypt-пароли, сессии, лимит попыток входа
              </li>
            </ul>
          </div>
        </div>

        {/* форма */}
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <div className="flex w-full max-w-sm flex-col">
            <Link href="/" className="mb-10 flex items-center gap-2.5 lg:hidden">
              <Logo size={26} />
              <span className="font-display text-[15px] font-semibold tracking-[0.18em]">SETKA</span>
            </Link>
            <Form mode={mode} />
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
