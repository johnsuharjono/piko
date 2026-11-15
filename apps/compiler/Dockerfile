# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS toolchain
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates xz-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /setup
COPY scripts/setup-arduino.mjs scripts/setup-native-avr.mjs ./scripts/
RUN ARDUINO_HOME=/opt/arduino node scripts/setup-arduino.mjs && rm -rf /opt/arduino/downloads

FROM node:24-bookworm-slim AS build
WORKDIR /build
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/compiler/package.json apps/compiler/package.json
COPY packages/compile-contract/package.json packages/compile-contract/package.json
RUN pnpm install --frozen-lockfile --filter @piko/compiler...
COPY apps/compiler/src apps/compiler/src
COPY packages/compile-contract/src packages/compile-contract/src
RUN pnpm --filter @piko/compiler build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=toolchain /opt/arduino /opt/arduino
COPY --from=build /build/apps/compiler/dist/index.mjs ./index.mjs
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 ARDUINO_HOME=/opt/arduino XDG_CACHE_HOME=/tmp/cache ARDUINO_BUILD_CACHE_PATH=/tmp/arduino-cache ARDUINO_DIRECTORIES_DOWNLOADS=/tmp/arduino-downloads
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "index.mjs"]
