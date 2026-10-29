# syntax=docker/dockerfile:1.7

# SafeProducts Cloud Run build.
# Use a real Node 22 runtime for the repository's node --test checks, install
# pinned Bun for dependency/build commands, then emit a Nitro Node server.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Existing SafeProducts prebuild checks invoke Python; the project build uses Bun.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python-is-python3 ca-certificates \
  && npm install --global bun@1.4.2 \
  && npm cache clean --force \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first for stable layer caching.
COPY package.json bun.lockb bunfig.toml ./
RUN bun install --frozen-lockfile

# The repository's canonical .env contains only publishable Supabase bindings
# and feature flags. Vite reads its VITE_* values during the build. The final
# runtime stage copies only .output, so .env is never included in the image.
COPY . .

# Lovable/TanStack external-container deployment: emit the standalone Nitro
# Node server expected at .output/server/index.mjs.
ENV NITRO_PRESET=node-server

RUN bun run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

COPY --from=build --chown=node:node /app/.output ./.output

USER node

EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
