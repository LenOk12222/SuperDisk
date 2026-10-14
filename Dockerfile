# SETKA — Next.js fullstack (UI + API в одном процессе)
# Важно: npm ci работает только с package-lock.json, поэтому копируем оба файла.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Нужен только на этапе сборки; реальный DATABASE_URL придёт из окружения при запуске.
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/app_db
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src ./src

RUN mkdir -p .storage && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["npm", "run", "start"]
