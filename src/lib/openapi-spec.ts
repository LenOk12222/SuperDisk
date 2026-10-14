/** Единый источник правды: /api/openapi.json (зеркало — openapi.yaml в корне репозитория) */

const err = (desc: string) => ({
  description: desc,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
});

const okJson = (schema: object, desc = "OK") => ({
  description: desc,
  content: { "application/json": { schema: schema as never } },
});

const tags = ["Auth", "Workspaces", "Members", "Files", "Notes", "Diagrams", "OCR"].map(
  (name) => ({ name }),
);

export const OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "SETKA — Team Workspace API",
    version: "1.0.0",
    description:
      "REST API командного рабочего пространства: пространства и участники, приватные файлы (S3), текстовые заметки, сетевые схемы, OCR.\n\n" +
      "**Аутентификация:** сессионная cookie `sid` (HttpOnly) либо заголовок `Authorization: Bearer <session-token>` — токен возвращается в ответе `/api/auth/login` и `/api/auth/register`. В БД хранится только SHA-256 от токена, пароли — scrypt-хеши.\n\n" +
      "**Авторизация:** на каждом запросе API проверяет членство пользователя в пространстве; операции управления участниками и пространством — только владельцу (`role=owner`). Посторонний пользователь получает `404 workspace_not_found`.\n\n" +
      "**Лимиты:** вход — 5 попыток / 5 мин (IP+логин); загрузка файлов ≤ 20 МБ, MIME-allowlist; OCR ≤ 10 МБ, 20 запросов/мин.",
    license: { name: "MIT" },
  },
  servers: [{ url: "/", description: "Текущий сервер" }],
  tags,
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "sid" },
      bearerAuth: { type: "http", scheme: "bearer" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: { code: { type: "string" }, message: { type: "string" } },
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          username: { type: "string" },
          email: { type: "string" },
          displayName: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Workspace: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          myRole: { type: "string", enum: ["owner", "member"] },
          membersCount: { type: "integer" },
        },
      },
      Member: {
        type: "object",
        properties: {
          userId: { type: "string", format: "uuid" },
          username: { type: "string" },
          email: { type: "string" },
          displayName: { type: "string" },
          role: { type: "string", enum: ["owner", "member"] },
          addedAt: { type: "string", format: "date-time" },
        },
      },
      FileMeta: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          mime: { type: "string" },
          size: { type: "integer", maximum: 20971520 },
          sha256: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          uploaderId: { type: "string", format: "uuid" },
          downloadUrl: { type: "string" },
          previewUrl: { type: "string", nullable: true },
        },
      },
      Note: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          workspaceId: { type: "string", format: "uuid" },
          title: { type: "string" },
          content: { type: "string" },
          authorId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Diagram: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          workspaceId: { type: "string", format: "uuid" },
          name: { type: "string" },
          doc: {
            type: "object",
            description: "Канвас: { version: 1, objects: DiagramObject[] } — устройства, фигуры, штрихи, соединения",
          },
          authorId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ sessionCookie: [] }, { bearerAuth: [] }],
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Регистрация",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "email", "password"],
                properties: {
                  username: { type: "string", pattern: "^[a-zA-Z0-9_.-]{3,32}$" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8, maxLength: 128 },
                  displayName: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": okJson({ $ref: "#/components/schemas/User" }, "Создан, выдана сессия"),
          "409": err("Логин/email заняты"),
          "429": err("Превышен лимит регистраций"),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Вход (login = логин или email)",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["login", "password"],
                properties: {
                  login: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": okJson({ $ref: "#/components/schemas/User" }, "Вход выполнен, cookie sid + token"),
          "401": err("Неверные учётные данные"),
          "429": err("Блокировка перебора: 5 попыток / 5 мин"),
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Выход (отзыв сессии)",
        responses: { "200": okJson({ type: "object" }, "ОК") },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Текущий пользователь",
        responses: {
          "200": okJson({ $ref: "#/components/schemas/User" }),
          "401": err("Не аутентифицирован"),
        },
      },
    },
    "/api/workspaces": {
      get: {
        tags: ["Workspaces"],
        summary: "Список моих пространств",
        responses: {
          "200": okJson({ type: "array", items: { $ref: "#/components/schemas/Workspace" } }),
        },
      },
      post: {
        tags: ["Workspaces"],
        summary: "Создать пространство (создатель = owner)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", maxLength: 80 },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": okJson({ $ref: "#/components/schemas/Workspace" }) },
      },
    },
    "/api/workspaces/{id}": {
      get: {
        tags: ["Workspaces"],
        summary: "Детали пространства + участники",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": okJson({ $ref: "#/components/schemas/Workspace" }),
          "404": err("Нет доступа / не существует"),
        },
      },
      patch: {
        tags: ["Workspaces"],
        summary: "Переименовать пространство — owner",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { name: { type: "string" }, description: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": okJson({ type: "object" }), "403": err("Только владелец") },
      },
      delete: {
        tags: ["Workspaces"],
        summary: "Удалить пространство и все файлы — owner",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ type: "object" }), "403": err("Только владелец") },
      },
    },
    "/api/workspaces/{id}/members": {
      get: {
        tags: ["Members"],
        summary: "Список участников",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ type: "array", items: { $ref: "#/components/schemas/Member" } }) },
      },
      post: {
        tags: ["Members"],
        summary: "Добавить участника по логину или email — owner",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["login"],
                properties: {
                  login: { type: "string", description: "username или email" },
                  role: { type: "string", enum: ["owner", "member"], default: "member" },
                },
              },
            },
          },
        },
        responses: {
          "201": okJson({ $ref: "#/components/schemas/Member" }),
          "404": err("Пользователь не зарегистрирован"),
          "409": err("Уже участник"),
          "403": err("Только владелец"),
        },
      },
    },
    "/api/workspaces/{id}/members/{userId}": {
      delete: {
        tags: ["Members"],
        summary: "Удалить участника — owner",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": okJson({ type: "object" }),
          "403": err("Только владелец; нельзя удалить владельца"),
        },
      },
    },
    "/api/workspaces/{id}/files": {
      get: {
        tags: ["Files"],
        summary: "Список файлов пространства",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ type: "array", items: { $ref: "#/components/schemas/FileMeta" } }) },
      },
      post: {
        tags: ["Files"],
        summary: "Загрузить файл (multipart, ≤ 20 МБ, allowlist типов)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          "201": okJson({ $ref: "#/components/schemas/FileMeta" }, "Загружен"),
          "413": err("Больше 20 МБ"),
          "415": err("Недопустимый тип"),
        },
      },
    },
    "/api/files/{fileId}": {
      get: {
        tags: ["Files"],
        summary: "Метаданные файла",
        parameters: [{ name: "fileId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ $ref: "#/components/schemas/FileMeta" }), "404": err("Нет доступа") },
      },
      delete: {
        tags: ["Files"],
        summary: "Удалить файл — uploader или owner пространства",
        parameters: [{ name: "fileId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ type: "object" }), "403": err("Недостаточно прав") },
      },
    },
    "/api/files/{fileId}/download": {
      get: {
        tags: ["Files"],
        summary: "Скачать файл (после проверки прав; s3 → redirect на presigned URL)",
        parameters: [
          { name: "fileId", in: "path", required: true, schema: { type: "string" } },
          {
            name: "mode",
            in: "query",
            schema: { type: "string", enum: ["inline"] },
            description: "inline-предпросмотр для изображений и PDF",
          },
        ],
        responses: {
          "200": { description: "Содержимое файла", content: { "application/octet-stream": {} } },
          "302": { description: "Redirect на presigned URL (S3)" },
          "401": err("Не аутентифицирован"),
          "404": err("Нет доступа"),
        },
      },
    },
    "/api/workspaces/{id}/notes": {
      get: {
        tags: ["Notes"],
        summary: "Список заметок",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ type: "array", items: { $ref: "#/components/schemas/Note" } }) },
      },
      post: {
        tags: ["Notes"],
        summary: "Создать заметку",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: { title: { type: "string" }, content: { type: "string" } },
              },
            },
          },
        },
        responses: { "201": okJson({ $ref: "#/components/schemas/Note" }) },
      },
    },
    "/api/notes/{noteId}": {
      get: {
        tags: ["Notes"],
        summary: "Получить заметку",
        parameters: [{ name: "noteId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ $ref: "#/components/schemas/Note" }), "404": err("Нет доступа") },
      },
      patch: {
        tags: ["Notes"],
        summary: "Обновить заметку (любой участник)",
        parameters: [{ name: "noteId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { title: { type: "string" }, content: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": okJson({ $ref: "#/components/schemas/Note" }) },
      },
      delete: {
        tags: ["Notes"],
        summary: "Удалить заметку — автор или owner",
        parameters: [{ name: "noteId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ type: "object" }), "403": err("Недостаточно прав") },
      },
    },
    "/api/workspaces/{id}/diagrams": {
      get: {
        tags: ["Diagrams"],
        summary: "Список схем",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ type: "array", items: { $ref: "#/components/schemas/Diagram" } }) },
      },
      post: {
        tags: ["Diagrams"],
        summary: "Создать схему (doc: JSON канваса)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "doc"],
                properties: { name: { type: "string" }, doc: { type: "object" } },
              },
            },
          },
        },
        responses: { "201": okJson({ $ref: "#/components/schemas/Diagram" }) },
      },
    },
    "/api/diagrams/{diagramId}": {
      get: {
        tags: ["Diagrams"],
        summary: "Открыть схему заново",
        parameters: [{ name: "diagramId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ $ref: "#/components/schemas/Diagram" }), "404": err("Нет доступа") },
      },
      patch: {
        tags: ["Diagrams"],
        summary: "Сохранить схему / переименовать",
        parameters: [{ name: "diagramId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { name: { type: "string" }, doc: { type: "object" } },
              },
            },
          },
        },
        responses: { "200": okJson({ type: "object" }) },
      },
      delete: {
        tags: ["Diagrams"],
        summary: "Удалить схему — автор или owner",
        parameters: [{ name: "diagramId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": okJson({ type: "object" }), "403": err("Недостаточно прав") },
      },
    },
    "/api/ocr": {
      post: {
        tags: ["OCR"],
        summary: "Распознать текст на изображении (tesseract, eng|rus)",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["image"],
                properties: {
                  image: { type: "string", format: "binary" },
                  lang: { type: "string", enum: ["eng", "rus"], default: "rus" },
                },
              },
            },
          },
        },
        responses: {
          "200": okJson({
            type: "object",
            properties: {
              text: { type: "string" },
              confidence: { type: "number" },
              lang: { type: "string" },
              tookMs: { type: "integer" },
            },
          }),
          "413": err("Больше 10 МБ"),
          "429": err("20 запросов/мин"),
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Проверка живости",
        security: [],
        responses: { "200": okJson({ type: "object" }) },
      },
    },
  },
} as const;

// дополнительный тег вне основного набора
export const OPENAPI_EXTRA_TAGS = [{ name: "Health" }];
void OPENAPI_EXTRA_TAGS;
