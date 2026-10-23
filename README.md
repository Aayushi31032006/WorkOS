# Communication System

A secure, standalone, multi-tenant internal messaging system — channels,
DMs, threads, files, search, and notifications — designed to embed into
WorkOS without accessing WorkOS source, database, or production infrastructure.

> ?? **Standalone product** — Never reads from or writes to WorkOS systems.
> All WorkOS integration is via JWT tokens and the embedding SDK.

---

## Quick Start (One Command)

### Option A: Full Docker stack (recommended)
```bash
docker compose -f infra/docker-compose.yml up
```

### Option B: Local development
```bash
# Prerequisites: Node 22+, pnpm 9+, PostgreSQL 16, MinIO

cp .env.example .env                    # Fill in local values
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mock-idp/.env.example apps/mock-idp/.env

pnpm install
pnpm dev:all                           # Starts all services in parallel
```

### Option C: Using Make
```bash
make setup    # Install + copy env files
make dev      # Start all services
make test     # Run all tests
```

---

## Service URLs (Local)

| Service | URL | Description |
|---|---|---|
| Web App | http://localhost:5173 | React frontend |
| API | http://localhost:3001 | Fastify backend |
| API Docs | http://localhost:3001/docs | Swagger UI |
| Mock IdP | http://localhost:4001 | Dev JWT issuer ?? |
| Mock Webhook | http://localhost:4002 | Dev webhook receiver ?? |
| MinIO Console | http://localhost:9001 | Object storage admin |

---

## Getting a Test Token

```bash
# Get a token for the Acme owner (Alice)
curl http://localhost:4001/token?tag=acme-owner

# List all synthetic users
curl http://localhost:4001/users

# Available tags:
#   acme-owner, acme-admin, acme-member, acme-guest, acme-bot
#   globex-owner, globex-admin, globex-member, globex-member-private, globex-readonly
```

---

## Repository Structure

```
communication-system/
+-- apps/
¦   +-- web/          React 19 + Vite frontend
¦   +-- api/          Fastify + Node 22 backend
¦   +-- mock-idp/     DEV ONLY – JWT issuer (port 4001)
¦   +-- mock-webhook/ DEV ONLY – Webhook receiver (port 4002)
+-- packages/
¦   +-- contracts/    Zod schemas, types, events, permissions
¦   +-- sdk/          Host integration client
¦   +-- ui/           React components + design tokens
¦   +-- test-fixtures/ Synthetic test data
+-- docs/             Full documentation
+-- infra/            Docker, CI, scripts
```

---

## Documentation

| Document | Description |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design and tech stack decisions |
| [RBAC.md](docs/RBAC.md) | Permission model, RBAC matrix, tenant isolation |
| [API.md](docs/API.md) | REST API reference |
| [REALTIME.md](docs/REALTIME.md) | WebSocket protocol and events |
| [WEBHOOKS.md](docs/WEBHOOKS.md) | Webhook payloads and signature verification |
| [EMBEDDING.md](docs/EMBEDDING.md) | SDK integration guide for host apps |
| [ENVIRONMENT.md](docs/ENVIRONMENT.md) | All environment variables |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment guide |
| [SECURITY.md](docs/SECURITY.md) | Threat model and break-glass policy |
| [DECISIONS.md](docs/DECISIONS.md) | Architecture decision records |
| [THIRD_PARTY_LICENSES.md](docs/THIRD_PARTY_LICENSES.md) | Dependency licenses |

---

## Development

```bash
pnpm lint           # Lint all packages
pnpm typecheck      # Type-check all packages
pnpm test           # Run unit tests
pnpm test:integration  # Run integration tests (needs DB)
pnpm test:e2e       # Run Playwright tests
pnpm build          # Build all packages
pnpm format         # Format all files
```

---

## Contributing

- Commits must follow [Conventional Commits](https://www.conventionalcommits.org/)
- All PRs require passing CI: lint + typecheck + unit tests + integration tests
- Run `pnpm format` before committing (enforced by Husky pre-commit hook)
