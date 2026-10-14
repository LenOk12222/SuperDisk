"use client";

import { useState } from "react";
import { Crown, UserPlus, UserX } from "lucide-react";
import { api, ApiClientError, fmtDate } from "@/lib/api-client";
import { Avatar, Badge, Confirm, Modal, Spinner, useToast } from "@/components/ui";
import type { WsDetail } from "./WorkspaceScreen";

type Props = {
  workspaceId: string;
  myRole: "owner" | "member";
  members: WsDetail["members"];
  onChanged: () => void;
};

export default function MembersTab({ workspaceId, myRole, members, onChanged }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [busy, setBusy] = useState(false);
  const [kick, setKick] = useState<Props["members"][number] | null>(null);

  async function add() {
    if (!login.trim()) return;
    setBusy(true);
    try {
      await api(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: { login: login.trim() },
      });
      toast("ok", "Участник добавлен");
      setOpen(false);
      setLogin("");
      onChanged();
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!kick) return;
    setBusy(true);
    try {
      await api(`/api/workspaces/${workspaceId}/members/${kick.userId}`, { method: "DELETE" });
      toast("ok", `@${kick.username} удалён из пространства`);
      setKick(null);
      onChanged();
    } catch (e) {
      toast("err", e instanceof ApiClientError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {myRole === "owner" && (
        <div className="mb-5 flex justify-end">
          <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
            <UserPlus className="size-4" />
            Добавить участника
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {members.map((m) => (
          <div key={m.userId} className="card flex items-center gap-4 px-4 py-3.5">
            <Avatar name={m.displayName} className="size-10" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-fog-50">
                  {m.displayName}
                  {m.isMe && <span className="ml-2 text-fog-500">(это вы)</span>}
                </p>
                <Badge tone={m.role === "owner" ? "owner" : "neutral"}>
                  {m.role === "owner" && <Crown className="size-3" />}
                  {m.role === "owner" ? "владелец" : "участник"}
                </Badge>
              </div>
              <p className="mt-0.5 truncate font-mono text-[12px] text-fog-500">
                @{m.username} · {m.email} · с {fmtDate(m.addedAt)}
              </p>
            </div>
            {myRole === "owner" && m.role !== "owner" && (
              <button
                className="rounded-lg p-2 text-fog-600 transition hover:bg-rose-400/10 hover:text-rose-400"
                title="Удалить из пространства"
                onClick={() => setKick(m)}
              >
                <UserX className="size-4.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Добавить участника">
        <div className="flex flex-col gap-4">
          <p className="text-[13px] leading-relaxed text-fog-400">
            Укажите логин или email уже зарегистрированного пользователя — пространство
            сразу появится в его списке.
          </p>
          <input
            className="field"
            placeholder="net.admin или admin@corp.ru"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Отмена</button>
            <button className="btn btn-primary btn-sm" disabled={busy || !login.trim()} onClick={add}>
              {busy && <Spinner className="size-3.5" />}
              Добавить
            </button>
          </div>
        </div>
      </Modal>

      <Confirm
        open={kick !== null}
        onClose={() => setKick(null)}
        onConfirm={remove}
        loading={busy}
        title="Удалить участника?"
        text={`@${kick?.username} потеряет доступ к файлам, заметкам и схемам этого пространства.`}
        confirmText="Удалить участника"
      />
    </div>
  );
}
