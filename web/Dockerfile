# Opengrowth web app + worker image (one image, two services in docker-compose.yml).
FROM node:22-bookworm-slim

# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# Dev dependencies stay: next start loads next.config.ts, and the worker runs through tsx.
RUN npx prisma generate && npm run build && mkdir -p /app/storage && chown -R node:node /app/storage

ENV NODE_ENV=production
USER node
EXPOSE 3000

# Apply any new database migrations, then serve. The worker service overrides this command.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000 -H 0.0.0.0"]
