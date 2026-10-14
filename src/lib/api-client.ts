/** Клиентский fetch-обёртка, единаый формат { data } / { error } */
export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Json = Record<string, unknown> | unknown[] | null;

export async function api<T = Record<string, never>>(
  path: string,
  opts: {
    method?: string;
    body?: Json | FormData;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers: opts.body instanceof FormData ? opts.headers : {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...opts.headers,
    },
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  };
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiClientError(0, "network_error", "Нет соединения с сервером");
  }
  let json: { data?: T; error?: { code: string; message: string } } | null = null;
  try {
    json = await res.json();
  } catch {
    /* пустой ответ */
  }
  if (!res.ok) {
    const e = json?.error;
    throw new ApiClientError(res.status, e?.code ?? "error", e?.message ?? `Ошибка ${res.status}`);
  }
  return (json?.data ?? ({} as T)) as T;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

export function fmtDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
