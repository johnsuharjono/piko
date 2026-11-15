# Deployment preparation

The prepared topology is a Cloudflare-hosted website plus a compiler service on a VPS. Authentication, persistent projects, and user quotas can be added later. No live resources have been created by this refactor.

## Compiler image

Build from the **repository root**, not `apps/compiler/`:

```sh
docker build -f apps/compiler/Dockerfile -t piko-compiler:local .
```

Verify the resulting image locally with real Blink/LCD compilation under the Compose resource limits:

```sh
pnpm check:compiler-image piko-compiler:local
```

The test creates a temporary container and removes it afterward. On an ARM Mac, an amd64 image runs under emulation; timings do not predict native VPS performance.

The multi-stage image installs the pinned Arduino toolchain, bundles only the compiler service, and runs Node as a non-root user. It includes no frontend dependencies, source project files, local environment files, or Mac toolchain. `GET /healthz` is public liveness; `POST /compile` requires `Authorization: Bearer <token>`.

For an AMD DigitalOcean Droplet, use the manually triggered **Build compiler image** GitHub Actions workflow. It builds `linux/amd64` on CI and publishes a commit-tagged GHCR image. This keeps image builds off the 1 GiB VPS. A private GHCR image requires registry authentication when pulling it. Alternatively build an amd64 image with Docker Buildx and publish it to a registry you control.

## VPS configuration

Install Docker and its Compose plugin. Copy `deploy/compose.yml` and `deploy/.env.example` to a directory on the server; rename the example to `.env` and fill in the image tag and a service token. Generate a token using:

```sh
openssl rand -hex 32
```

Keep the token in the server’s `.env` file with permissions `chmod 600 .env`. Do not commit it. Start from that deployment directory:

```sh
docker compose --env-file .env -f compose.yml pull
docker compose --env-file .env -f compose.yml up -d
curl http://127.0.0.1:3001/healthz
```

Compose binds the service to **loopback**, caps it at 512 MiB RAM / one CPU / 64 processes, provides a bounded 192 MiB temporary filesystem, drops capabilities and uses a read-only root filesystem. That temporary filesystem counts toward the memory limit. Logs rotate at 5 MB, keeping two files. These are starting limits, not a capacity guarantee; monitor real compilation workloads and adjust them if needed.

Expose only an HTTPS reverse proxy publicly. `deploy/Caddyfile` is an optional **host-installed Caddy** configuration: set `COMPILER_DOMAIN` in Caddy’s service environment, point that hostname’s DNS record at the VPS, and allow inbound 80/443 for certificate issuance and HTTPS. It forwards to loopback port 3001. Do not expose port 3001 directly. Caddy runs on the host in this example; the compiler Compose file does not install it or create DNS records.

## Cloudflare website

The web app uses the Cloudflare Vite plugin and `apps/web/wrangler.jsonc`. Its API route is a proxy; Arduino CLI stays on the VPS. Markdown, SVG assets, editor and browser simulation worker deploy with the website.

After signing in to Wrangler, configure the two server-side bindings on the **piko** Worker:

- `COMPILER_URL`: the HTTPS origin of your compiler, such as `https://compiler.example.com`.
- `COMPILER_TOKEN`: the same random credential configured on the compiler.

Use the Cloudflare dashboard’s Worker settings or Wrangler secret prompts. Never prefix either value with `VITE_`, include credentials in a URL, or put them in the repository. Both can be stored as secrets. The local `.dev.vars` file is not a production secret configuration.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:unit
pnpm deploy:web
```

`deploy:web` rebuilds before deploying. For Git-based Workers Builds use repository root `/`, build command `pnpm --filter @piko/web build`, and deploy command `pnpm --filter @piko/web exec wrangler deploy`. Set secrets on the production Worker, not as public client build variables. Preview environments need their own compiler URL/token if you enable compilation there.

The Worker’s free CPU allowance is separate from time waiting on the VPS. Server-rendered page CPU usage still needs measurement on a real deployment. Static assets bypass Worker execution when the configured asset routing allows it. Do not assume every SSR page fits the free tier solely because the compiler is elsewhere.

## Verification

1. `/healthz` succeeds on the VPS, and `/compile` without credentials returns 401.
2. The website homepage and a project article load over HTTPS.
3. Blink compiles through the website, returns HEX and runs in the browser.
4. Invalid code returns a useful compiler diagnostic. Pause/resume and button input work without new compiler requests.
5. The service token is absent from browser assets and responses. Missing/wrong configuration produces a user-facing connection error rather than leaking upstream details.

## Limits and public access

The service accepts at most 40 KB per request and 32,000 sketch characters. It compiles one sketch at a time with a 45-second timeout and a global, in-process cap of 30 authenticated requests per minute. Busy/limited requests return 429. The website proxy has a 50-second upstream timeout, refuses cross-origin browser requests and forwards to HTTPS (HTTP is allowed only for loopback development).

These are **service controls, not user authentication or a complete untrusted-code sandbox**. The public website proxy can still be called without an account; origin checks are not authentication. The service cap is per process and resets on restart. A container boundary limits host access but compilation jobs still share the service container, including its process namespace. Removing credentials from compiler subprocess environments is only partial hardening.

Use this initial setup as a controlled preview. Before unrestricted public compilation, add independently isolated compilation jobs with no access to service secrets, edge request limits, and user/guest admission limits with shared accounting. Do not mount the Docker socket or host source/secrets into the compiler container. A future account/data provider stays separate from this compiler boundary.

## Independent local commands

`pnpm dev` starts both services and generates a local token if needed. To run them independently, configure `apps/compiler/.env` and `apps/web/.dev.vars` using the examples and the same token, then use `pnpm dev:compiler` and `pnpm dev:web`. Local development keeps the native tools in the root `.arduino/`; `ARDUINO_HOME`, `ARDUINO_CLI`, `ARDUINO_CONFIG`, and `ARDUINO_COMPILER_PATH` can override tool locations.

Reference: [Cloudflare TanStack Start deployment](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/), [pnpm workspaces](https://pnpm.io/workspaces), [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
