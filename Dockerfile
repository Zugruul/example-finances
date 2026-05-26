# syntax=docker/dockerfile:1.7
# Multi-stage build for examples/example-finances.
# Build context MUST be the monorepo root so workspace:* deps resolve.
#   docker compose build example-finances    # context wired in docker-compose.yaml

# ---------- Stage 1: builder ----------
# Install full workspace, build framework packages' dist/, then build the
# Next.js app (output:'standalone' bundles a self-contained server.js).
#
# We install the WHOLE workspace (not `--filter=example-finances...`) so
# devDependencies of transitive workspace deps (e.g. each framework
# package's own `typescript`) are available for `tsc -b`. The final
# runner image only carries `.next/standalone`, so this fat node_modules
# never ships.
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy lockfile + root configs + every workspace manifest BEFORE the
# `pnpm install` so the install layer caches on dep changes only, not
# every source edit.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.build.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY examples/example-finances ./examples/example-finances

RUN pnpm install --frozen-lockfile

# Build framework packages' dist/.
#
# The root monorepo pins `typescript@4.9.5` (legacy — used by some root
# scripts), but the framework packages' tsconfigs need TS5+ for
# `ClassDecoratorContext` (es2023 lib) etc. Several workspace packages
# (engine-mongo, metrics-prometheus, telemetry, plugin-cryptoshredding)
# already pull TS5.8.3 into the workspace via their own devDeps, and
# pnpm dedupes that copy into `node_modules/.pnpm/typescript@5.8.3/`.
# We invoke that binary explicitly so the build doesn't depend on
# pnpm's bin-hoisting heuristics (which differ subtly between the
# host's prior install state and a clean docker install).
RUN TSC=$(find /app/node_modules/.pnpm -path '*typescript@5*/node_modules/typescript/bin/tsc' | sort -V | tail -1) \
 && test -n "$TSC" \
 && node "$TSC" --build tsconfig.build.json \
 && test -f /app/packages/core/dist/index.js \
 && test -f /app/packages/engine-mongo/dist/index.js \
 && test -f /app/packages/engine-memory/dist/index.js \
 && test -f /app/packages/read-models/dist/index.js \
 && test -f /app/packages/plugin-cryptoshredding/dist/index.js \
 && test -f /app/packages/metrics-prometheus/dist/index.js

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/examples/example-finances
RUN pnpm build

# ---------- Stage 2: dev ----------
# Dev-loop image. Inherits FROM builder so the workspace install + framework
# dist/ artifacts produced by `tsc -b` are already on disk. We then bind-mount
# the host source over /app/examples/example-finances and /app/packages at
# runtime (via docker-compose.override.yaml) so edits propagate into the
# container; anonymous volumes shield container-owned node_modules and .next
# from the host.
#
# File-watching across the docker boundary requires polling on macOS Docker
# Desktop — chokidar/watchpack inotify events don't propagate reliably through
# osxfs/VirtioFS.
FROM builder AS dev
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHOKIDAR_USEPOLLING=true \
    WATCHPACK_POLLING=true \
    WATCHPACK_POLLING_INTERVAL=1000
WORKDIR /app/examples/example-finances
EXPOSE 3000
CMD ["pnpm", "dev"]

# ---------- Stage 3: runner ----------
# Minimal runtime. .next/standalone is self-contained — Next bundles all
# required node_modules into the standalone tree.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# .next/standalone is rooted at the monorepo root inside the image.
# Next emits the example's server entrypoint at
# `examples/example-finances/server.js` (preserves workspace layout).
COPY --from=builder --chown=nextjs:nodejs /app/examples/example-finances/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/examples/example-finances/.next/static ./examples/example-finances/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/examples/example-finances/public ./examples/example-finances/public

USER nextjs
EXPOSE 3000
CMD ["node", "examples/example-finances/server.js"]
