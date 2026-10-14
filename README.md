# SETKA — командное рабочее пространство

Веб-приложение для совместной работы сетевой команды: **файлы** в приватном
S3-совместимом хранилище, **текстовые заметки**, **сетевые схемы** с
ML-распознаванием рукописных набросков и **OCR** с сохранением результата
в заметку. Роли «владелец/участник», права проверяются на стороне API при
каждой операции.

**Стек:** Next.js 16 (App Router) · TypeScript · PostgreSQL + Drizzle ORM ·
S3-совместимое хранилище (AWS SDK, presigned URL) · tesseract.js (OCR, локальные
модели) · собственный $N-recognizer штрихов (настройка без внешних ML-сервисов) ·
Tailwind CSS 4.

**Документация:**

- 📘 [Подробная инструкция запуска и диагностики](docs/RUNBOOK_RU.md) — установка,
  PostgreSQL/Docker, `drizzle-kit push`, dev/production, MinIO (S3), тесты, типовые ошибки.
- 🗂 [Структура проекта и ответственность каждого файла](docs/PROJECT_STRUCTURE_RU.md) —
  дерево репозитория в привычной схеме «backend + frontend» и назначение всех файлов.

---

## Быстрый старт

### Вариант 1. Локально (minimal)

Требуется Node.js 20+ и PostgreSQL 14+

```bash
cp .env.example .env          # проверьте DATABASE_URL
npm install
npx drizzle-kit push          # создать таблицы
npm run dev                   # http://localhost:3000
```

### Вариант 2. Docker Compose: инфраструктура + локальный запуск приложения

```bash
docker compose --profile s3 up -d postgres minio   # postgres:5432, minio:9000 (+ консоль :9001)
cp .env.example .env
# для S3 в .env выставьте STORAGE_DRIVER=s3 (бакет setka создастся автоматически)
npm install
npx drizzle-kit push
npm run dev
```

### Вариант 3. Полностью в Docker

```bash
docker compose up --build -d
```

Соберёт образ приложения из `Dockerfile`, поднимет приложение и PostgreSQL,
применит схему Drizzle внутри контейнера `app` и откроет приложение на
http://localhost:3000. Файлы в этом режиме хранятся локально в Docker-томе
`app_storage`. MinIO вынесен в отдельный профиль и не блокирует обычный запуск:

```bash
$env:STORAGE_DRIVER = "s3"
docker compose --profile s3 up --build -d
```
Команду нужно выполнять из корня репозитория, где лежат `Dockerfile`,
`docker-compose.yml`, `package.json` и `package-lock.json`.

### Продакшен-сборка

```bash
npm run build && npm run start
```

### Если `drizzle-kit push` завис на `Pulling schema from database...`

Это означает, что Drizzle Kit не может завершить подключение к PostgreSQL.
Сначала остановите команду (`Ctrl+C`), запустите базу и проверьте порт:

```powershell
# PowerShell, если используете Docker Compose
docker compose up -d postgres
docker compose ps
Test-NetConnection 127.0.0.1 -Port 5432
```

`TcpTestSucceeded` должен быть `True`. Также убедитесь, что база `app_db` существует
(`drizzle-kit push` создаёт таблицы, но не саму базу), а `DATABASE_URL` в `.env`
совпадает с пользователем, паролем, портом и именем базы запущенного PostgreSQL.
После запуска базы повторите `npx drizzle-kit push`.

### Первые шаги

1. Зарегистрируйте двух пользователей (например, `alice` и `bob`).
2. `alice` создаёт пространство → Участники → добавить `bob` (по логину или email).
3. Всё: обмен файлами, заметки с автосохранением и OCR, редактор схем.

---

## Структура адресов (UI)

| Путь | Экран |
| --- | --- |
| `/login`, `/register` | вход и регистрация |
| `/app` | список пространств |
| `/app/w/[id]` | пространство: вкладки Файлы / Заметки / Схемы / Участники |
| `/app/w/[id]/notes/[noteId]` | редактор заметки (+ OCR) |
| `/app/w/[id]/diagrams/[diagramId]` | редактор схем |
| `/docs` | интерактивная документация API (рендерит `openapi.json`) |
| `/api/openapi.json` | спецификация OpenAPI 3.0.3 (зеркало — `openapi.yaml`) |

## API

Документация ведётся **spec-first**: единый источник —
[`src/lib/openapi-spec.ts`](src/lib/openapi-spec.ts), из него генерируется
`openapi.yaml`:

```bash
npx tsx scripts/gen-openapi.ts
```

Аутентификация — cookie `sid` (HttpOnly) **или** `Authorization: Bearer <token>`
(токен возвращается при логине/регистрации). Сводка эндпоинтов:

```
POST   /api/auth/register | login | logout          auth (лимиты)
GET    /api/auth/me
GET|POST /api/workspaces                            список / создать (owner)
GET|PATCH|DELETE /api/workspaces/{id}               детали / переименовать* / удалить*
GET|POST /api/workspaces/{id}/members               список / добавить по логину|email*
DELETE /api/workspaces/{id}/members/{userId}        удалить участника*
GET|POST /api/workspaces/{id}/files                 список / загрузка (≤20 МБ, allowlist)
GET|DELETE /api/files/{fileId}                      метаданные / удалить
GET    /api/files/{fileId}/download                 скачивание после проверки прав
GET|POST /api/workspaces/{id}/notes                 список / создать
GET|PATCH|DELETE /api/notes/{noteId}                чтение / правка любым участником / удалить
GET|POST /api/workspaces/{id}/diagrams              список / создать
GET|PATCH|DELETE /api/diagrams/{diagramId}          открыть / сохранить / удалить
POST   /api/ocr                                     распознать текст (rus|eng)
GET    /api/health                                  healthcheck
'*' — только владелец пространства
```

Примеры запросов — в блоке «Быстрый пример (curl)» на странице `/docs`.

---

## Безопасность

- **Пароли:** `scrypt(N=16384,r=8,p=1)` + timingSafeEqual; в открытом виде не хранятся.
- **Сессии:** непрозрачные токены (32 байта, base64url), в БД — только `sha256(токен)`;
  cookie `HttpOnly + SameSite=Lax + Secure(прод)`, TTL 30 дней, отзыв при выходе.
- **Авторизация:** `requireMembership()` вызывается при каждой операции с данными
  пространства; владельческие операции — `requireOwner()`. Посторонним отдаётся
  `404 workspace_not_found` (без раскрытия существования ресурса).
- **Лимит входа:** 5 попыток / 5 минут на пару (IP, логин) + «фиктивный» хеш
  для выравнивания времени ответа; лимит регистраций и OCR. Лимитер in-memory —
  для мультиинстансного прода заменить на Redis (`src/lib/ratelimit.ts`).
- **Файлы:** лимит 20 МБ (проверка и по Content-Length, и по фактическому размеру),
  allowlist типов (png/jpeg/gif/webp/pdf/txt/md/csv/json/zip/docx/xlsx),
  контроль расширения + MIME, sanitize имени, ключ объекта с UUID — путь не
  контролируется пользователем. Скачивание: `nosniff`, `Content-Disposition`,
  приватное кэширование no-store; для S3 — presigned GET на приватный бакет (60 с).
- **Секреты:** только через переменные окружения (`.env` в `.gitignore`);
  OCR-модели и весь ML — локально, без внешних вызовов.

## ML: распознавание набросков

Собственная реализация **$N Unistroke Recognizer** (обобщение $1-recognizer,
Wobbrock et al.) в [`src/lib/diagram/recognizer.ts`](src/lib/diagram/recognizer.ts):

- вход: 1–3 штриха (мышь или палец, pointer events);
- перебор порядка и направлений штрихов, ресемплинг до 96 точек,
  поворот к инициативному углу, уточнение золотым сечением (±30°);
- эвристики: замкнутость, прямизна (линия/стрелка), пропорции
  (квадрат/прямоугольник, круг/эллипс), число изломов (прямоугольник/эллипс);
- 17 эталонов в [`templates.ts`](src/lib/diagram/templates.ts) — их же видит
  пользователь в «легенде» редактора (это и есть образцы рукописных обозначений).

По ТЗ реализованы: подтверждение распознавания (поповер), исправление ошибки
(список топ-кандидатов «Другой…»), сохранение исходного росчерка (объект хранит
`raw`-штрихи, кнопка «Вернуть набросок»), ручная вставка, перемещение,
масштабирование, удаление, соединения Ethernet/оптоволокно/беспроводное с
привязкой к устройствам (визуально различаются: сплошная/пунктир/точки+дуги).

## OCR

`tesseract.js` в серверном API `/api/ocr`, языковые модели `rus` и `eng`
локально из пакетов `@tesseract.js-data/*` (интернет не нужен). Результат
вставляется в открытую заметку. Образцы — в [`samples/`](samples/).

## Тесты

```bash
# интеграционные тесты прав доступа (нужен запущенный сервер)
npm run dev &
node --test tests/access.test.mjs

# юнит-тесты распознавателя (18 эталонов + шумы)
npx tsx --test tests/recognizer.test.ts
```

`tests/access.test.mjs` проверяет всю матрицу доступа: регистрация/лимиты,
owner-only операции (403 для участника), изоляция от постороннего (404 при
прямых запросах к пространству/файлам/заметкам/схемам, включая download),
валидация типов и лимита 20 МБ, мгновенная потеря доступа после исключения.

## Сценарий демонстрации (приёмка)

1. `alice` регистрируется, создаёт пространство, добавляет `bob`.
2. `bob` загружает файл → `alice` скачивает его (и наоборот).
3. Совместно правят заметку; `bob` распознаёт `samples/ocr-sample-rus.png` →
   текст сохраняется в заметку.
4. В редакторе рисуют значки по легенде (набросок → предложение → замена),
   соединяют устройства разными типами связей, сохраняют схему и открывают её заново.
5. Посторонний пользователь `eve` по прямым ссылкам/curl получает `401/404` даже
   на скачивание файла (`tests/access.test.mjs` автоматизирует всё это).

## Структура проекта

```
src/
  app/
    api/                 # REST API (route handlers)
    app/                 # защищённые экраны (workspace UI)
    docs/                # просмотрщик OpenAPI
    login/ register/     # экраны аутентификации
  components/            # UI: app, diagram (редактор), notes, auth, landing
  db/                    # drizzle: схема и клиент
  lib/
    diagram/             # типы, эталоны, $N-recognizer
    session.ts password.ts guard.ts ratelimit.ts storage.ts ocr.ts
tests/                   # tests доступа и распознавателя
scripts/gen-openapi.ts   # генерация openapi.yaml
openapi.yaml             # снапшот спецификации
samples/                 # примеры для OCR и распознавания
```

## Ограничения MVP (вне объёма)

Чаты, видеозвонки, история версий, публичные ссылки, совместное редактирование
в реальном времени, почтовые приглашения (участникам назначается доступ
напрямую по логину/email), распознавание обозначений вне согласованного списка.
