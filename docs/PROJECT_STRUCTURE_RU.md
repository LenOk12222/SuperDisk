# SETKA — структура проекта и ответственность файлов

## 1. Почему дерево отличается от «backend/frontend на Python»

Пример из задания — классическая схема «FastAPI backend + отдельный frontend». Наш проект собран на **Next.js fullstack**: интерфейс и REST API живут в одном репозитории и одном процессе. Поэтому физически папок `backend/` и `frontend/` нет, но **логически структура та же самая**:

| Слой в примере (Python/FastAPI) | Эквивалент в этом проекте | Где лежит |
| --- | --- | --- |
| `backend/app/main.py` | Точка входа Next.js: страницы + route handlers | `src/app/` |
| `backend/app/core/config.py` | Конфигурация из env | `.env`, `.env.example`, `drizzle.config.ts`, `next.config.ts` |
| `backend/app/core/security.py` | Хеши паролей, сессии, guards, лимиты | `src/lib/password.ts`, `src/lib/session.ts`, `src/lib/guard.ts`, `src/lib/ratelimit.ts` |
| `backend/app/core/deps.py` | Зависимости/проверки на каждый запрос | `src/lib/guard.ts`, `src/lib/http.ts` |
| `backend/app/core/storage.py` | Абстракция файлового хранилища | `src/lib/storage.ts` |
| `backend/app/models/` (SQLAlchemy) | Схема таблиц Drizzle ORM | `src/db/schema.ts` |
| `backend/app/db.py` | Подключение к PostgreSQL | `src/db/index.ts` |
| `backend/app/schemas/` (Pydantic) | Валидация входных данных (zod) + контракт API | `src/lib/validate.ts`, `src/lib/openapi-spec.ts` |
| `backend/app/api/*.py` | REST-эндпоинты (route handlers) | `src/app/api/**/route.ts` |
| `backend/app/services/recognition.py` | Распознавание штрихов и OCR | `src/lib/diagram/recognizer.ts`, `src/lib/ocr.ts` |
| `backend/app/services/templates/` | Эталоны обозначений и значки | `src/lib/diagram/templates.ts`, `src/components/diagram/DeviceIcon.tsx` |
| `backend/tests/` | Тесты | `tests/` |
| `backend/requirements.txt` | Зависимости Node.js | `package.json` |
| `backend/Dockerfile` | Контейнеризация приложения | не нужен для демо: `npm run build && npm run start`; Docker используется для инфраструктуры (`docker-compose.yml`) |
| `frontend/src/api/` | Клиент к REST API | `src/lib/api-client.ts` |
| `frontend/src/pages/` | Страницы (App Router) | `src/app/**/page.tsx` |
| `frontend/src/components/` | UI-компоненты | `src/components/` |
| `frontend/src/canvas/` | Холст редактора схем (SVG, pointer events — вместо Fabric.js) | `src/components/diagram/DiagramCanvas.tsx` |
| `docs/openapi.yaml` | Спецификация API | `openapi.yaml` в корне + живой `/api/openapi.json` и страница `/docs` |

Итог: переписывать проект на Python/FastAPI/Fabric.js ради дерева папок не нужно — ниже фактическое дерево этого репозитория с назначением каждого файла.

---

## 2. Фактическое дерево репозитория

```text
collaborative-workspace-mvp-development/
│
├── package.json                 # зависимости и npm-скрипты (аналог requirements.txt)
├── tsconfig.json                # TypeScript: пути @/* → src/*
├── next.config.ts               # Next.js: tesseract/S3 как внешние серверные пакеты
├── next-env.d.ts                # служебный файл Next.js (генерируется, не редактировать)
├── postcss.config.mjs           # PostCSS для Tailwind CSS 4
├── eslint.config.mjs            # правила ESLint
├── drizzle.config.ts            # Drizzle Kit: схема + DATABASE_URL из .env
├── docker-compose.yml           # app + PostgreSQL; MinIO — отдельный профиль s3
├── Dockerfile                   # образ приложения: npm ci по package-lock, build, start
├── .dockerignore                # контекст Docker-сборки (package-lock.json НЕ исключать)
├── package-lock.json            # зафиксированные версии зависимостей; нужен для npm ci
├── .env.example                 # шаблон конфигурации (в Git)
├── .env                         # реальные секреты (НЕ в Git, создаётся локально)
├── .gitignore                   # что нельзя коммитить (.env, node_modules, .next, .storage)
├── openapi.yaml                 # снапшот OpenAPI (генерируется из src/lib/openapi-spec.ts)
├── README.md                    # обзор проекта
│
├── docs/
│   ├── RUNBOOK_RU.md            # подробная инструкция запуска и диагностики
│   └── PROJECT_STRUCTURE_RU.md  # этот файл
│
├── scripts/
│   └── gen-openapi.ts           # генерация openapi.yaml из единого TS-источника спеки
│
├── samples/
│   ├── README.md                # как проверять OCR и распознавание
│   ├── ocr-sample-rus.png       # образец текста (рус.) для OCR
│   └── ocr-sample-eng.png       # образец текста (англ.) для OCR
│
├── tests/
│   ├── access.test.mjs          # интеграционные тесты прав доступа (node:test, HTTP)
│   └── recognizer.test.ts       # юнит-тесты $N-recognizer (tsx --test)
│
└── src/
    ├── db/
    │   ├── schema.ts            # таблицы: users, sessions, workspaces, members, files, notes, diagrams
    │   └── index.ts             # пул подключений pg + клиент Drizzle (db)
    │
    ├── lib/                     # ── ЛОГИЧЕСКИЙ BACKEND: ядро, безопасность, сервисы ──
    │   ├── http.ts              # ApiError, единый формат {data}/{error}, parseBody(zod), clientIp
    │   ├── validate.ts          # zod-схемы запросов, allowlist файлов ≤20 МБ, лимиты OCR
    │   ├── password.ts          # scrypt-хеширование и проверка паролей
    │   ├── session.ts           # сессии: токен→sha256 в БД, cookie/Bearer, вход/выход
    │   ├── guard.ts             # requireUser / requireMembership / requireOwner на каждый вызов
    │   ├── ratelimit.ts         # скользящий лимитер (вход 5/5мин, OCR, загрузки)
    │   ├── storage.ts           # хранилище файлов: локальный диск или S3 + presigned URL
    │   ├── ocr.ts               # серверный OCR: tesseract.js + локальные traineddata (rus/eng)
    │   ├── openapi-spec.ts      # единый источник OpenAPI 3.0 (spec-first)
    │   ├── api-client.ts        # браузерный клиент API + форматирование дат/размеров
    │   └── diagram/
    │       ├── types.ts         # модель схемы: объекты, устройства, фигуры, типы связей
    │       ├── templates.ts     # эталонные рукописные обозначения для recognizer и легенды
    │       └── recognizer.ts    # $N Unistroke Recognizer + эвристики пропорций/углов
    │
    ├── app/                     # Next.js App Router: страницы (фронт) + API (бэк)
    │   ├── layout.tsx           # корневой layout: шрифты, тема, metadata
    │   ├── globals.css          # Tailwind 4: тема, токены, кнопки/поля, сетка-чертёж
    │   ├── page.tsx             # лендинг /
    │   ├── login/page.tsx       # страница /login
    │   ├── register/page.tsx    # страница /register
    │   ├── docs/page.tsx        # /docs — живой просмотрщик OpenAPI
    │   ├── api/                 # ── REST API (аналог FastAPI routers) ──
    │   │   ├── health/route.ts          # GET /api/health — живость + проверка БД
    │   │   ├── openapi.json/route.ts    # GET /api/openapi.json — спецификация
    │   │   ├── ocr/route.ts             # POST /api/ocr — распознать текст
    │   │   ├── auth/
    │   │   │   ├── register/route.ts    # POST /api/auth/register
    │   │   │   ├── login/route.ts       # POST /api/auth/login (лимит попыток)
    │   │   │   ├── logout/route.ts      # POST /api/auth/logout (отзыв сессии)
    │   │   │   └── me/route.ts          # GET  /api/auth/me
    │   │   ├── workspaces/
    │   │   │   ├── route.ts                   # GET|POST /api/workspaces
    │   │   │   └── [id]/
    │   │   │       ├── route.ts               # GET|PATCH|DELETE /api/workspaces/{id}
    │   │   │       ├── members/route.ts       # GET|POST /api/workspaces/{id}/members
    │   │   │       ├── members/[userId]/route.ts # DELETE .../members/{userId}
    │   │   │       ├── files/route.ts         # GET|POST /api/workspaces/{id}/files
    │   │   │       ├── notes/route.ts         # GET|POST /api/workspaces/{id}/notes
    │   │   │       └── diagrams/route.ts      # GET|POST /api/workspaces/{id}/diagrams
    │   │   ├── files/
    │   │   │   ├── [fileId]/route.ts          # GET|DELETE /api/files/{fileId}
    │   │   │   └── [fileId]/download/route.ts # GET /api/files/{fileId}/download
    │   │   ├── notes/[noteId]/route.ts        # GET|PATCH|DELETE /api/notes/{noteId}
    │   │   └── diagrams/[diagramId]/route.ts  # GET|PATCH|DELETE /api/diagrams/{diagramId}
    │   └── app/                 # защищённая часть интерфейса (URL-префикс /app)
    │       ├── layout.tsx               # guard по сессии + шапка приложения
    │       ├── page.tsx                 # /app — список пространств
    │       └── w/[id]/
    │           ├── page.tsx                     # /app/w/{id} — пространство и вкладки
    │           ├── notes/[noteId]/page.tsx      # /app/w/{id}/notes/{noteId} — редактор заметки
    │           └── diagrams/[diagramId]/page.tsx # /app/w/{id}/diagrams/{diagramId} — редактор схем
    │
    └── components/              # ── ЛОГИЧЕСКИЙ FRONTEND: переиспользуемый UI ──
        ├── ui.tsx                       # Logo, тосты, Modal/Confirm, Badge, Avatar, Empty, скелетоны
        ├── landing/HeroCanvas.tsx       # анимированная «живая» топология на лендинге (Canvas 2D)
        ├── auth/AuthScreen.tsx          # формы входа/регистрации + бренд-панель
        ├── app/
        │   ├── TopBar.tsx               # верхняя панель: логотип, меню пользователя, выход
        │   ├── WorkspacesBrowser.tsx    # список/создание/удаление пространств
        │   └── workspace/
        │       ├── WorkspaceScreen.tsx  # каркас пространства: заголовок, вкладки, переименование
        │       ├── FilesTab.tsx         # файлы: drag&drop, прогресс, скачивание, удаление
        │       ├── NotesTab.tsx         # список заметок
        │       ├── DiagramsTab.tsx      # список схем
        │       └── MembersTab.tsx       # участники: добавление по логину/email, удаление
        ├── notes/
        │   ├── NoteEditor.tsx           # редактор заметки: автосейв, Ctrl+S, статус сохранения
        │   └── OcrModal.tsx             # OCR: загрузка картинки, язык, вставка/замена текста
        └── diagram/
            ├── DeviceIcon.tsx           # векторные значки устройств (стиль Cisco), GlyphArt для холста
            ├── DiagramPanels.tsx        # Toolbar, легенда обозначений, поповер-подсказка recognizer
            ├── DiagramCanvas.tsx        # холст SVG: рисование, перемещение, связи, undo/redo, зум
            └── DiagramEditorPage.tsx    # страница редактора схемы: загрузка/автосохранение документа
```

Служебные/генерируемые папки (не исходники, в Git не коммитятся): `node_modules/` (зависимости), `.next/` (production-сборка), `.storage/` (файлы при `STORAGE_DRIVER=local`).

> Обратите внимание на `src/app/app/`: внешняя `src/app` — служебная папка Next.js App Router, внутренняя `app` — сегмент URL `/app`. Аналогично `src/app/api` — все REST-обработчики.

---

## 3. Ответственность ключевых файлов по слоям

### 3.1. Конфигурация и инфраструктура (аналог `core/config.py` + Docker)

| Файл | За что отвечает |
| --- | --- |
| `.env` / `.env.example` | Секреты и настройки окружения: `DATABASE_URL`, драйвер хранилища, доступы S3. `.env` создаётся локально из примера и не попадает в Git. |
| `drizzle.config.ts` | Конфигурация Drizzle Kit: где схема (`src/db/schema.ts`) и откуда брать подключение (`DATABASE_URL` из `.env` через dotenv). Используется командой `npx drizzle-kit push`. |
| `next.config.ts` | Настройки Next.js. Ключевое: `serverExternalPackages` для `tesseract.js` и AWS SDK, чтобы WASM/нативные зависимости не попадали в бандл. |
| `docker-compose.yml` | Локальный стек: приложение и PostgreSQL запускаются по умолчанию; MinIO (образ с официального Quay) вынесен в профиль `s3`. Отдельный mc-init не нужен — приложение само создаёт приватный бакет при первой загрузке файла. |
| `package.json` | Зависимости проекта и скрипты: `dev`, `build`, `start`, `lint`, `typecheck` (аналог `requirements.txt` + Makefile в одном файле). |
| `tsconfig.json` | Настройки TypeScript, включая алиас `@/* → src/*`. |
| `postcss.config.mjs`, `eslint.config.mjs` | Сборка CSS (Tailwind) и правила линтера. |
| `next-env.d.ts` | Служебные типы Next.js; генерируется автоматически, вручную не редактируется. |

### 3.2. База данных (аналог `models/` + `db.py` SQLAlchemy)

| Файл | За что отвечает |
| --- | --- |
| `src/db/schema.ts` | Все таблицы и связи: `users` (учётки, scrypt-хеш пароля), `sessions` (sha256 токенов, срок жизни), `workspaces`, `workspace_members` (роли `owner`/`member`), `files` (метаданные + ключ объекта в хранилище + sha256), `notes`, `diagrams` (JSON-документ схемы). Уникальные индексы: email, username, пара «пространство+пользователь». |
| `src/db/index.ts` | Пул подключений `pg` (переиспользуется в dev через globalThis) и экспорт клиента `db` Drizzle. Требует `DATABASE_URL`, иначе падает при старте — это намеренно. |

Как применить схему к базе: `npx drizzle-kit push` (см. RUNBOOK, шаг 5).

### 3.3. Ядро backend и безопасность (аналог `core/`)

| Файл | За что отвечает |
| --- | --- |
| `src/lib/http.ts` | Единый контракт API: успешный ответ `{ data }`, ошибка `{ error: { code, message } }`, класс `ApiError`, превращение zod-ошибок в `400 validation_error`, определение IP клиента. |
| `src/lib/validate.ts` | Все входные контракты (zod): регистрация/логин, пространства, участники, заметки, документ схемы. Здесь же allowlist типов файлов, лимит 20 МБ, лимиты OCR, очистка имени файла. |
| `src/lib/password.ts` | Пароли: хеш `scrypt(N=16384,r=8,p=1)` с солью 16 байт, проверка через `timingSafeEqual`. Открытый пароль нигде не хранится. |
| `src/lib/session.ts` | Сессии: выдача случайного токена (32 байта), в БД хранится только `sha256(токен)`; чтение из HttpOnly-cookie `sid` или `Authorization: Bearer`; создание/отзыв сессии; `getServerAuth()` для серверных страниц. |
| `src/lib/guard.ts` | Проверка прав **при каждой операции**: `requireUser` (401), `requireMembership` (посторонним — 404 без раскрытия существования), `requireOwner` (403), `canManageResource` (автор или владелец). |
| `src/lib/ratelimit.ts` | In-memory скользящий лимитер: вход 5 попыток/5 мин на (IP+логин), регистрации, загрузки, OCR. Для мультиинстансного прода заменить бэкенд на Redis — интерфейс функции тот же. |
| `src/lib/storage.ts` | Абстракция хранилища по `STORAGE_DRIVER`: `local` (приватная папка `.storage`, отдача только стримом через API) или `s3` (AWS SDK: Put/Get/Delete + presigned GET на 60 с после проверки прав). Ключ объекта содержит UUID, пользователь путь не контролирует. |
| `src/lib/ocr.ts` | Серверный OCR: кэш tesseract-воркеров, локальные языковые пакеты `rus`/`eng` из `node_modules/@tesseract.js-data` (интернет не нужен), распознавание Buffer → текст + confidence. |
| `src/lib/openapi-spec.ts` | Единый источник OpenAPI 3.0.3 (spec-first): все пути, схемы, коды ответов. Из него генерируется `openapi.yaml` и отдаётся `/api/openapi.json`. |
| `src/lib/api-client.ts` | Клиентская часть: fetch-обёртка для браузера (cookie, единый разбор `{data}/{error}`, `ApiClientError`), форматтеры размера файла и дат. |

### 3.4. ML распознавания схем (аналог `services/recognition.py` + `templates/`)

| Файл | За что отвечает |
| --- | --- |
| `src/lib/diagram/types.ts` | Модель документа схемы: объекты `stroke` (исходный росчерк), `shape` (7 фигур), `device` (10 значков), `link` (ethernet/fiber/wireless с привязанными `aId/bId`), `text`. Метаданные подписей и цветов связей. |
| `src/lib/diagram/templates.ts` | Заранее заданные образцы рукописных обозначений: для каждой фигуры и сетевого значка — эталонные штрихи в координатах 0..1. Используются и recognizer-ом, и легендой в редакторе («как рисовать»). |
| `src/lib/diagram/recognizer.ts` | $N Unistroke Recognizer: перебор порядка/направлений штрихов (до 3), ресемплинг до 96 точек, поворот к инициативному углу, поиск золотым сечением ±30°, плюс эвристики: замкнутость, прямизна (линия/стрелка), пропорции (квадрат/прямоугольник, круг/эллипс), число изломов. Возвращает топ-кандидатов со score 0..1. |
| `src/components/diagram/DeviceIcon.tsx` | Отрисовка «аккуратных» значков устройств в стиле Cisco (SVG): `DeviceGlyph` для UI и `GlyphArt` для вставки в холст. |

Логика подтверждения/исправления: распознанный значок **не подменяет** рисунок молча. `DiagramCanvas` показывает поповер с топ-кандидатом и уверенностью; кнопки «Другой…» (список кандидатов) и «Оставить штрихи». Исходные штрихи сохраняются в поле `raw` объекта, кнопка «Вернуть набросок» в тулбаре восстанавливает их.

### 3.5. REST API (аналог `api/*.py` FastAPI)

| Файл | Эндпоинты и ответственность |
| --- | --- |
| `src/app/api/health/route.ts` | `GET /api/health` — проверка живости приложения и БД (`select 1`). |
| `src/app/api/auth/register/route.ts` | `POST /api/auth/register` — регистрация, уникальность логина/email, scrypt-хеш, сразу выдаёт сессию. |
| `src/app/api/auth/login/route.ts` | `POST /api/auth/login` — вход по логину или email; лимит 5/5мин; «фиктивный» хеш выравнивает время ответа. |
| `src/app/api/auth/logout/route.ts` | `POST /api/auth/logout` — отзыв сессии в БД + очистка cookie. |
| `src/app/api/auth/me/route.ts` | `GET /api/auth/me` — текущий пользователь по сессии. |
| `src/app/api/workspaces/route.ts` | `GET /api/workspaces` (только мои, с ролью и числом участников), `POST` — создать (создатель становится `owner`, транзакция). |
| `src/app/api/workspaces/[id]/route.ts` | `GET` детали+участники; `PATCH` переименовать (owner); `DELETE` удалить пространство и его файлы из хранилища (owner). |
| `src/app/api/workspaces/[id]/members/route.ts` | `GET` список участников; `POST` добавить существующего пользователя по логину/email (только owner; 404 — не зарегистрирован, 409 — уже участник). |
| `src/app/api/workspaces/[id]/members/[userId]/route.ts` | `DELETE` — удалить участника (owner; нельзя удалить владельца и себя). Доступ теряется со следующего запроса. |
| `src/app/api/workspaces/[id]/files/route.ts` | `GET` список файлов; `POST` загрузка multipart: проверка лимита 20 МБ, allowlist типов, sha256, запись в хранилище. |
| `src/app/api/files/[fileId]/route.ts` | `GET` метаданные файла; `DELETE` — удалить (автор загрузки или owner пространства) из БД и хранилища. |
| `src/app/api/files/[fileId]/download/route.ts` | `GET` скачивание **после** `requireMembership`: S3 → 302 на presigned-URL; local → стрим с `nosniff`, `Content-Disposition`, `mode=inline` для предпросмотра картинок/PDF. |
| `src/app/api/workspaces/[id]/notes/route.ts` | `GET` список заметок (excerpt без полного текста), `POST` создать. |
| `src/app/api/notes/[noteId]/route.ts` | `GET` заметка; `PATCH` редактировать может любой участник; `DELETE` — автор или owner. |
| `src/app/api/workspaces/[id]/diagrams/route.ts` | `GET` список схем, `POST` создать схему с JSON-документом. |
| `src/app/api/diagrams/[diagramId]/route.ts` | `GET` открыть схему заново; `PATCH` сохранить/переименовать; `DELETE` — автор или owner. |
| `src/app/api/ocr/route.ts` | `POST /api/ocr` — multipart-картинка (≤10 МБ) + `lang=rus|eng`; вызывает `src/lib/ocr.ts`; лимит 20/мин. Текст в заметку вставляет уже клиент. |
| `src/app/api/openapi.json/route.ts` | `GET /api/openapi.json` — отдаёт `OPENAPI_SPEC` как JSON. |

Правило, действующее во всех файлах этого слоя: сначала `requireUser`, затем `requireMembership`/`requireOwner` по пространству ресурса — и только потом работа с данными.

### 3.6. Страницы и компоненты интерфейса (аналог `frontend/src/pages` + `components`)

| Файл | За что отвечает |
| --- | --- |
| `src/app/layout.tsx` | Корневой layout: шрифты (Manrope, JetBrains Mono, Unbounded), `globals.css`, SEO-metadata. |
| `src/app/globals.css` | Дизайн-система Tailwind 4: тёмная тема «сетевой чертёж», токены цветов, `.btn`, `.field`, `.card`, сетки, анимации. |
| `src/app/page.tsx` | Лендинг `/`: hero, возможности, сетка значков, блок API. |
| `src/components/landing/HeroCanvas.tsx` | Canvas 2D-анимация «живой топологии»: узлы, связи, пакеты, реакция на курсор. |
| `src/app/login/page.tsx`, `src/app/register/page.tsx` | Тонкие страницы-обёртки, рендерят `AuthScreen` в нужном режиме. |
| `src/components/auth/AuthScreen.tsx` | Формы входа/регистрации, ошибки API, переход в `/app` после успеха. |
| `src/app/app/layout.tsx` | Защищённый каркас `/app/*`: серверная проверка сессии (нет — redirect на `/login`), `TopBar`, провайдер тостов. |
| `src/components/app/TopBar.tsx` | Шапка приложения: логотип, ссылка на API-документацию, меню пользователя и выход. |
| `src/app/app/page.tsx` + `src/components/app/WorkspacesBrowser.tsx` | `/app`: список моих пространств, создание, удаление (owner), роли-бейджи. |
| `src/app/app/w/[id]/page.tsx` | Серверный guard страницы пространства: членство проверяется до рендера, посторонний уходит в `/app`. |
| `src/components/app/workspace/WorkspaceScreen.tsx` | Каркас пространства: заголовок, переименование (owner), вкладки Файлы/Заметки/Схемы/Участники (состояние вкладки — в URL `?tab=`). |
| `.../workspace/FilesTab.tsx` | Файлы: drag&drop-зона, загрузка с прогрессом (XHR), превью картинок, скачивание, удаление с подтверждением. Клиентская предпроверка 20 МБ и расширений (сервер проверяет повторно). |
| `.../workspace/NotesTab.tsx` | Сетка заметок: автор, даты, создание с переходом в редактор, удаление. |
| `.../workspace/DiagramsTab.tsx` | Сетка схем: создание с переходом в редактор, удаление. |
| `.../workspace/MembersTab.tsx` | Участники: список с ролями; owner добавляет по логину/email и удаляет участников (модалки + подтверждения). |
| `src/app/app/w/[id]/notes/[noteId]/page.tsx` | Серверный guard редактора заметки (заметка принадлежит пространству + членство). |
| `src/components/notes/NoteEditor.tsx` | Редактор заметки: загрузка, автосохранение (debounce 1.2 с), `Ctrl+S`, индикатор «сохранено/сохраняю/ошибка», кнопка OCR и удаление. |
| `src/components/notes/OcrModal.tsx` | Модалка OCR: выбор картинки и языка rus/eng, прогресс, редактируемый результат с confidence, «Вставить в конец» или «Заменить заметку». |
| `src/app/app/w/[id]/diagrams/[diagramId]/page.tsx` | Серверный guard редактора схем; редактор занимает весь экран под шапкой. |
| `src/components/diagram/DiagramEditorPage.tsx` | Загрузка схемы по API, поле названия, автосохранение документа (debounce 1.5 с), статус сохранения, ручное «Сохранить». |
| `src/components/diagram/DiagramCanvas.tsx` | Ядро редактора (SVG + Pointer Events, работает мышью и пальцем): инструменты выбор/панорама/рисование/соединение/текст; распознавание после штриха и поповер-подтверждение; перемещение и resize объектов; привязка связей к устройствам; зум/панорама; undo/redo; сохранение исходных штрихов (`raw`). |
| `src/components/diagram/DiagramPanels.tsx` | Панели редактора: `Toolbar` (инструменты, тип связи Ethernet/оптоволокно/Wi-Fi, «Вставить», undo/redo, «Вернуть набросок», удаление), `Legend` (все образцы обозначений), `SuggestionPopover` (топ-кандидат, уверенность, альтернативы). |
| `src/app/docs/page.tsx` | Страница `/docs`: тянет `/api/openapi.json`, группирует эндпоинты по тегам, поиск, карточки ответов, блок curl-примеров. |
| `src/components/ui.tsx` | Общие примитивы: `Logo`, `Spinner`, тосты (`ToastProvider/useToast`), `Modal`, `Confirm`, `Empty`, `Badge`, `Avatar`, `SkeletonList`. |

### 3.7. Тесты, примеры, документация

| Файл | За что отвечает |
| --- | --- |
| `tests/access.test.mjs` | Сквозные HTTP-тесты прав доступа против запущенного сервера: регистрация, лимиты, роли owner/member, изоляция постороннего (включая прямое скачивание файла), 413/415, потеря доступа после исключения. Запуск: `node --test tests/access.test.mjs`. |
| `tests/recognizer.test.ts` | Юнит-тесты recognizer: все эталоны с шумом/поворотом/масштабом, различение пар по пропорциям, отказ на «мусорном» штрихе. Запуск: `npx tsx --test tests/recognizer.test.ts`. |
| `samples/ocr-sample-rus.png`, `samples/ocr-sample-eng.png` | Контрольные картинки для OCR (русский и английский текст) — проверка без ручной подготовки. |
| `samples/README.md` | Как проверять OCR и рисование обозначений, список поддерживаемых объектов. |
| `scripts/gen-openapi.ts` | Регенерация `openapi.yaml` из `src/lib/openapi-spec.ts`: `npx tsx scripts/gen-openapi.ts`. |
| `openapi.yaml` | Файловый снапшот спецификации для GitHub/внешних инструментов; источник правды — TS-спека. |
| `README.md` | Обзор, быстрый старт, сценарий приёмки. |
| `docs/RUNBOOK_RU.md` | Подробный запуск: установка, БД, `drizzle-kit push`, dev/prod, MinIO, тесты, диагностика зависания `Pulling schema...`. |
| `docs/PROJECT_STRUCTURE_RU.md` | Этот файл: карта слоёв и ответственность файлов. |

---

## 4. Как слои связаны во время работы (один запрос целиком)

Пример: пользователь скачивает файл.

1. Браузер (`FilesTab`) → `GET /api/files/{id}/download` с cookie сессии.
2. `src/app/api/files/[fileId]/download/route.ts`: `requireUser` (сессия через `session.ts`) → ищет файл в БД (`db/schema.ts` через `db/index.ts`) → `requireMembership` по `workspaceId` файла (`guard.ts`).
3. Только после проверки прав: `storage.ts` либо редиректит на presigned-URL приватного S3-бакета, либо стримит байты из `.storage`.
4. Посторонний пользователь на шаге 2 получает `404`, аноним — `401`. Прямой доступ к бакету/папке закрыт всегда.

Пример: распознавание наброска.

1. `DiagramCanvas` копит штрихи pointer-событий → `recognizer.ts` сверяет их с `templates.ts`.
2. Поповер (`DiagramPanels`) предлагает значок из `DeviceIcon.tsx`; пользователь подтверждает, выбирает другой или оставляет штрихи.
3. Документ схемы уходит в `PATCH /api/diagrams/{id}` и сохраняется в `diagrams.doc` (JSON).
� бакету/папке закрыт всегда.

Пример: распознавание наброска.

1. `DiagramCanvas` копит штрихи pointer-событий → `recognizer.ts` сверяет их с `templates.ts`.
2. Поповер (`DiagramPanels`) предлагает значок из `DeviceIcon.tsx`; пользователь подтверждает, выбирает другой или оставляет штрихи.
3. Документ схемы уходит в `PATCH /api/diagrams/{id}` и сохраняется в `diagrams.doc` (JSON).
