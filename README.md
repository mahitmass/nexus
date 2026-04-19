# Project Nexus

> Agnostic AI-integrated universal data processing dashboard.
> Swap the theme tonight — zero changes to core infrastructure.

## Tech stack at a glance

| Layer | Technologies |
|---|---|
| Monorepo | Turborepo, pnpm workspaces |
| Web frontend | Next.js 14, React 18, SWC, Vite, TypeScript |
| Styling | Tailwind CSS, PostCSS, Autoprefixer, NativeWind |
| UI primitives | Shadcn UI, Radix UI (18 primitives), Framer Motion, Three.js / @react-three/fiber |
| State | Zustand, React Query, tRPC, Apollo Client, GraphQL |
| Mobile | Expo (managed), React Native, Expo Router, EAS |
| API Gateway | NestJS, Express, REST, GraphQL, gRPC, WebSocket / Socket.io |
| AI service | FastAPI, LangChain, LlamaIndex, OpenAI, Anthropic, HuggingFace |
| Data processor | Spring Boot (Java) |
| Vector store | Pinecone, Milvus |
| ORM | Prisma (PostgreSQL), Mongoose (MongoDB) |
| Databases | PostgreSQL 16, MongoDB 7, Redis 7 |
| BaaS | Supabase, Firebase |
| Auth | Clerk, NextAuth.js, OAuth, JWT, bcrypt |
| Security | Helmet.js, CORS, rate-limiting, CSP headers |
| Payments | Stripe |
| Comms | Twilio (SMS), SendGrid (email) |
| Media | Cloudinary |
| Validation | Zod (full stack) |
| Testing | Jest, Vitest, Cypress, Playwright, Mocha, Chai |
| E2E AI | TensorFlow.js (browser) |
| DevOps | Docker (multi-stage), Docker Compose, Kubernetes-ready |
| CI/CD | GitHub Actions, GitLab CI |
| IaC | Terraform (AWS) |
| Monitoring | Sentry, Datadog, Prometheus, Grafana |
| Server | Nginx, PM2 |
| Cloud | Vercel (web), AWS EC2 + S3, Expo EAS (mobile) |
| DX | ESLint, Prettier, Husky, Lint-staged, Storybook, VS Code workspace |
| Docs | OpenAPI / Swagger, Storybook, Markdown |

**Total integrations: 100+**

---

## Full file tree

```
project-nexus/
├── .github/
│   └── workflows/
│       ├── ci.yml                        ✅ Generated
│       └── release.yml
├── .vscode/
│   ├── extensions.json                   ✅ Generated
│   └── settings.json                     ✅ Generated
├── apps/
│   ├── web/                              Next.js 14
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── globals.css
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── sign-in/page.tsx
│   │   │   │   │   └── sign-up/page.tsx
│   │   │   │   └── (dashboard)/
│   │   │   │       ├── layout.tsx
│   │   │   │       ├── dashboard/page.tsx    ← THEME ENTRY
│   │   │   │       ├── records/
│   │   │   │       ├── analytics/
│   │   │   │       ├── ai-assistant/
│   │   │   │       └── settings/
│   │   │   ├── components/
│   │   │   │   ├── providers/
│   │   │   │   ├── layout/
│   │   │   │   └── dashboard/
│   │   │   ├── lib/
│   │   │   │   ├── trpc/
│   │   │   │   ├── apollo/
│   │   │   │   ├── auth/
│   │   │   │   └── db/
│   │   │   ├── hooks/
│   │   │   └── store/
│   │   ├── prisma/
│   │   │   └── schema.prisma             ✅ Generated
│   │   ├── public/
│   │   │   └── manifest.json
│   │   ├── .storybook/
│   │   ├── next.config.js                ✅ Generated
│   │   ├── package.json                  ✅ Generated
│   │   └── STRUCTURE.md                  ✅ Generated
│   │
│   └── mobile/                           Expo + React Native
│       ├── app/
│       │   ├── _layout.tsx
│       │   ├── (auth)/
│       │   │   ├── sign-in.tsx
│       │   │   └── sign-up.tsx
│       │   └── (tabs)/
│       │       ├── _layout.tsx
│       │       ├── index.tsx             ← Dashboard
│       │       ├── records.tsx
│       │       └── settings.tsx
│       ├── components/
│       ├── hooks/
│       ├── store/
│       ├── app.json                      ✅ Generated
│       └── package.json                  ✅ Generated
│
├── services/
│   ├── api-gateway/                      NestJS
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── records/              ← Agnostic CRUD
│   │   │   │   ├── ai/
│   │   │   │   ├── websocket/
│   │   │   │   ├── payments/
│   │   │   │   └── notifications/
│   │   │   ├── grpc/
│   │   │   │   └── proto/
│   │   │   ├── graphql/
│   │   │   │   └── schema.graphql
│   │   │   └── common/
│   │   │       ├── guards/
│   │   │       ├── decorators/
│   │   │       ├── pipes/
│   │   │       └── interceptors/
│   │   ├── test/
│   │   ├── Dockerfile                    ✅ Generated
│   │   └── package.json                  ✅ Generated
│   │
│   ├── ai-service/                       Python FastAPI
│   │   ├── app/
│   │   │   ├── main.py                   ✅ Generated
│   │   │   ├── core/
│   │   │   │   └── config.py
│   │   │   ├── routers/
│   │   │   │   ├── health.py
│   │   │   │   ├── inference.py
│   │   │   │   ├── rag.py
│   │   │   │   ├── embeddings.py
│   │   │   │   └── data.py
│   │   │   ├── services/
│   │   │   │   ├── llm_service.py
│   │   │   │   ├── rag_service.py
│   │   │   │   └── vector_service.py
│   │   │   ├── grpc/
│   │   │   └── models/
│   │   ├── tests/
│   │   ├── requirements.txt              ✅ Generated
│   │   └── Dockerfile                    ✅ Generated
│   │
│   └── data-processor/                   Spring Boot (Java)
│       ├── src/main/java/com/nexus/
│       │   ├── DataProcessorApplication.java
│       │   ├── controllers/
│       │   ├── services/
│       │   ├── repositories/
│       │   └── models/
│       ├── src/main/resources/
│       │   └── application.yml
│       └── pom.xml
│
├── packages/
│   ├── types/
│   │   └── src/index.ts                  ✅ Generated
│   ├── schemas/
│   │   └── src/index.ts                  ✅ Generated
│   ├── config/
│   │   ├── eslint/base.js                ✅ Generated
│   │   └── tailwind/base.js              ✅ Generated
│   └── api-client/
│       └── src/
│           ├── trpc.ts
│           └── graphql/
│
├── infra/
│   ├── terraform/
│   │   ├── main.tf                       ✅ Generated
│   │   └── variables.tf                  ✅ Generated
│   ├── k8s/
│   │   ├── deployments/
│   │   └── services/
│   ├── nginx/
│   │   └── nginx.conf                    ✅ Generated
│   ├── prometheus/
│   │   └── prometheus.yml                ✅ Generated
│   └── grafana/
│       └── dashboards/
│
├── docs/
│   └── ADR/                              Architecture Decision Records
│
├── .env.example                          ✅ Generated
├── .gitignore
├── docker-compose.yml                    ✅ Generated
├── package.json                          ✅ Generated
├── pnpm-workspace.yaml                   ✅ Generated
├── turbo.json                            ✅ Generated
├── tsconfig.json                         ✅ Generated
└── README.md                             ✅ This file
```

---

## Quickstart

```bash
# 1. Clone / init
bash 00_SETUP.sh

# 2. Install all workspace deps
pnpm install

# 3. Copy env and fill in secrets
cp .env.example .env.local
# Fill in DATABASE_URL, CLERK keys, OPENAI_API_KEY etc.

# 4. Start all services
docker compose up -d       # postgres, mongo, redis, nginx, grafana

# 5. Run DB migration
pnpm --filter @nexus/web exec prisma migrate dev --name init

# 6. Start dev servers (all in parallel via Turborepo)
pnpm dev

# Web   → http://localhost:3000
# API   → http://localhost:4000
# AI    → http://localhost:8000
# Docs  → http://localhost:4000/api/docs  (Swagger)
# GQL   → http://localhost:4000/graphql
# Mobile → scan Expo QR in terminal
```

---

## Theme swap guide (tonight's checklist)

To switch from generic → Agriculture / Healthcare / FinTech:

| File | What to change |
|---|---|
| `.env.example` → `.env.local` | Set `DOMAIN_THEME=agriculture` |
| `prisma/schema.prisma` | Rename `Record` model + fields (see comments) |
| `apps/web/src/app/(dashboard)/dashboard/page.tsx` | Theme-specific KPI labels |
| `packages/config/tailwind/base.js` | Swap CSS variable color values |
| `apps/web/public/manifest.json` | App name, icons |
| `apps/mobile/app.json` | `name`, `slug`, `bundleIdentifier` |
| `infra/terraform/variables.tf` | `domain_theme` default value |

**Nothing else changes.** All routing, auth, AI, realtime, and DevOps wiring is agnostic.
