/**
 * Тесты проверки прав доступа к API (п.5 ТЗ).
 *
 * Запуск (сервер должен работать):
 *   npm run dev            # или npm run build && npm start
 *   node --test tests/access.test.mjs
 *
 * BASE_URL можно переопределить: BASE_URL=http://host:port node --test tests/
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function call(path, { method = "GET", token, body, formData } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData ?? (body ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* бинарный ответ */
  }
  return { status: res.status, json, res };
}

const users = {};
let wsId = "";
let fileId = "";
let noteId = "";
let diagramId = "";

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("регистрация троих участников сценария", async () => {
  for (const [key, password] of [
    ["owner", "password-owner-1"],
    ["member", "password-member-1"],
    ["outsider", "password-outsider-1"],
  ]) {
    const r = await call("/api/auth/register", {
      method: "POST",
      body: {
        username: `${key}_${sfx}`,
        email: `${key}_${sfx}@example.com`,
        password,
      },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    users[key] = { token: r.json.data.token, password, login: `${key}_${sfx}` };
  }
});

test("повторная регистрация с тем же логином → 409", async () => {
  const r = await call("/api/auth/register", {
    method: "POST",
    body: { username: users.owner.login, email: `x${sfx}@mail.com`, password: "password-x-1" },
  });
  assert.equal(r.status, 409);
});

test("аноним: защищённые эндпоинты отвечают 401", async () => {
  for (const p of ["/api/workspaces", "/api/auth/me"]) {
    const r = await call(p);
    assert.equal(r.status, 401, `${p} должен отвечать 401`);
  }
});

test("логин с неверным паролем → 401, перебор ограничивается 429", async () => {
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const r = await call("/api/auth/login", {
      method: "POST",
      body: { login: `bruteforce_${sfx}`, password: "wrong-password" },
    });
    last = r.status;
  }
  assert.equal(last, 429, "шестая попытка за 5 минут должна быть заблокирована");
});

test("owner создаёт пространство, добавляет member, outsider — нет", async () => {
  const c = await call("/api/workspaces", {
    method: "POST",
    token: users.owner.token,
    body: { name: `ws_${sfx}`, description: "test" },
  });
  assert.equal(c.status, 201);
  wsId = c.json.data.workspace.id;

  const add = await call(`/api/workspaces/${wsId}/members`, {
    method: "POST",
    token: users.owner.token,
    body: { login: users.member.login },
  });
  assert.equal(add.status, 201);

  // незарегистрированный пользователь
  const noUser = await call(`/api/workspaces/${wsId}/members`, {
    method: "POST",
    token: users.owner.token,
    body: { login: `ghost_${sfx}` },
  });
  assert.equal(noUser.status, 404);

  // повторное добавление
  const again = await call(`/api/workspaces/${wsId}/members`, {
    method: "POST",
    token: users.owner.token,
    body: { login: users.member.login },
  });
  assert.equal(again.status, 409);
});

test("member НЕ может управлять участниками (403), outsider — 404", async () => {
  const byMember = await call(`/api/workspaces/${wsId}/members`, {
    method: "POST",
    token: users.member.token,
    body: { login: users.outsider.login },
  });
  assert.equal(byMember.status, 403);

  const kickByMember = await call(
    `/api/workspaces/${wsId}/members/${users.outsider.login}`,
    { method: "DELETE", token: users.member.token },
  );
  assert.equal(kickByMember.status, 403);
});

test("файлы: загрузка/листинг/скачивание участниками; outsider ничего не получит", async () => {
  const fd = new FormData();
  fd.append("file", new Blob([Buffer.from(pngBase64, "base64")], { type: "image/png" }), "dot.png");
  const up = await call(`/api/workspaces/${wsId}/files`, {
    method: "POST",
    token: users.member.token,
    formData: fd,
  });
  assert.equal(up.status, 201, JSON.stringify(up.json));
  fileId = up.json.data.file.id;

  const list = await call(`/api/workspaces/${wsId}/files`, { token: users.owner.token });
  assert.equal(list.status, 200);
  assert.ok(list.json.data.files.some((f) => f.id === fileId));

  const dl = await fetch(`${BASE}/api/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${users.outsider.token}` },
  });
  assert.equal(dl.status, 404, "посторонний не скачивает даже прямым запросом");

  const dlAnon = await fetch(`${BASE}/api/files/${fileId}/download`);
  assert.equal(dlAnon.status, 401, "аноним не скачивает");

  const dlMember = await fetch(`${BASE}/api/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${users.member.token}` },
  });
  assert.equal(dlMember.status, 200);
  assert.equal(dlMember.headers.get("x-content-type-options"), "nosniff");

  const fdOut = new FormData();
  fdOut.append("file", new Blob([Buffer.from(pngBase64, "base64")], { type: "image/png" }), "x.png");
  const upOut = await call(`/api/workspaces/${wsId}/files`, {
    method: "POST",
    token: users.outsider.token,
    formData: fdOut,
  });
  assert.equal(upOut.status, 404);
});

test("файлы: неподдерживаемый тип и оверсайз отвергаются", async () => {
  const exe = new FormData();
  exe.append("file", new Blob([Buffer.from("MZ")], { type: "application/x-msdownload" }), "evil.exe");
  const r1 = await call(`/api/workspaces/${wsId}/files`, {
    method: "POST",
    token: users.owner.token,
    formData: exe,
  });
  assert.equal(r1.status, 415);

  const big = new FormData();
  big.append(
    "file",
    new Blob([new Uint8Array(21 * 1024 * 1024)], { type: "text/plain" }),
    "big.txt",
  );
  const r2 = await call(`/api/workspaces/${wsId}/files`, {
    method: "POST",
    token: users.owner.token,
    formData: big,
  });
  assert.equal(r2.status, 413);
});

test("заметки: совместное редактирование, аутсайдеру 404", async () => {
  const crt = await call(`/api/workspaces/${wsId}/notes`, {
    method: "POST",
    token: users.member.token,
    body: { title: "Адресный план", content: "10.0.0.0/24" },
  });
  assert.equal(crt.status, 201);
  noteId = crt.json.data.note.id;

  const patch = await call(`/api/notes/${noteId}`, {
    method: "PATCH",
    token: users.owner.token,
    body: { content: "10.0.0.0/24 core, 10.0.1.0/24 users" },
  });
  assert.equal(patch.status, 200);

  const out = await call(`/api/notes/${noteId}`, { token: users.outsider.token });
  assert.equal(out.status, 404);

  // удалять может автор или владелец; тут владелец — ок
  const delByOwner = await call(`/api/notes/${noteId}`, {
    method: "DELETE",
    token: users.owner.token,
  });
  assert.equal(delByOwner.status, 200);
});

test("схемы: создание, повторное открытие, изоляция", async () => {
  const crt = await call(`/api/workspaces/${wsId}/diagrams`, {
    method: "POST",
    token: users.owner.token,
    body: {
      name: "Топология",
      doc: {
        version: 1,
        objects: [
          { id: "r1", t: "device", kind: "router", x: 10, y: 10, w: 90, h: 90 },
          { id: "s1", t: "device", kind: "switch", x: 220, y: 10, w: 90, h: 90 },
          { id: "l1", t: "link", aId: "r1", bId: "s1", kind: "ethernet" },
        ],
      },
    },
  });
  assert.equal(crt.status, 201);
  diagramId = crt.json.data.diagram.id;

  const openMember = await call(`/api/diagrams/${diagramId}`, { token: users.member.token });
  assert.equal(openMember.status, 200);
  assert.equal(openMember.json.data.diagram.doc.objects.length, 3);

  const outOpen = await call(`/api/diagrams/${diagramId}`, { token: users.outsider.token });
  assert.equal(outOpen.status, 404);
  const outPatch = await call(`/api/diagrams/${diagramId}`, {
    method: "PATCH",
    token: users.outsider.token,
    body: { name: "hack" },
  });
  assert.equal(outPatch.status, 404);
});

test("outsider не видит пространство в своём списке и по прямому GET", async () => {
  const list = await call("/api/workspaces", { token: users.outsider.token });
  assert.equal(list.status, 200);
  assert.ok(!list.json.data.workspaces.some((w) => w.id === wsId));

  const detail = await call(`/api/workspaces/${wsId}`, { token: users.outsider.token });
  assert.equal(detail.status, 404);
});

test("после удаления участника доступ теряется сразу", async () => {
  const members = await call(`/api/workspaces/${wsId}/members`, { token: users.owner.token });
  const memberRow = members.json.data.members.find((m) => m.username === users.member.login);
  const kick = await call(`/api/workspaces/${wsId}/members/${memberRow.userId}`, {
    method: "DELETE",
    token: users.owner.token,
  });
  assert.equal(kick.status, 200);

  const after = await call(`/api/workspaces/${wsId}/notes`, { token: users.member.token });
  assert.equal(after.status, 404);
});

console.log(`\nSETKA access-control tests against ${BASE}\n`);
