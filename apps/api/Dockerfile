# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV APP_PORT=4000
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    bash \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 1001 shopynn
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY schema.sql ./schema.sql
COPY seed-permissions.sql ./seed-permissions.sql
COPY industries.sql ./industries.sql
COPY docs ./docs
RUN chmod +x scripts/db-migrate.sh
USER shopynn
EXPOSE 4000
# Same idea as FoaabMart (`prisma migrate deploy && start`): migrate then serve.
CMD ["bash", "-c", "bash scripts/db-migrate.sh && node src/app.js"]
