#!/usr/bin/env bash
# ============================================================
# PROJECT NEXUS — Bootstrap Script
# Run once from an empty directory: bash 00_SETUP.sh
# ============================================================
set -e

echo "▸ Installing global tooling..."
npm install -g pnpm@9 turbo@latest expo-cli@latest

echo "▸ Creating monorepo root..."
mkdir -p project-nexus && cd project-nexus

echo "▸ Initialising pnpm workspace + Turborepo..."
pnpm init
pnpm add -D turbo typescript@5 @turbo/gen

echo "▸ Creating workspace directories..."
mkdir -p \
  apps/web \
  apps/mobile \
  services/api-gateway \
  services/ai-service \
  services/data-processor \
  packages/ui \
  packages/types \
  packages/config \
  packages/schemas \
  packages/api-client \
  infra/terraform \
  infra/k8s \
  infra/nginx \
  .github/workflows \
  .gitlab-ci \
  docs

echo "▸ Scaffolding Next.js web app..."
cd apps/web
pnpm create next-app@latest . \
  --typescript --tailwind --eslint \
  --app --src-dir --import-alias "@/*" \
  --use-pnpm
pnpm add \
  zustand @tanstack/react-query @trpc/client @trpc/react-query @trpc/server \
  @apollo/client graphql \
  framer-motion three @types/three \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tabs @radix-ui/react-tooltip \
  class-variance-authority clsx tailwind-merge \
  lucide-react \
  next-pwa \
  zod \
  @clerk/nextjs \
  @stripe/stripe-js \
  @tensorflow/tfjs
pnpm add -D \
  @types/react @types/react-dom \
  postcss autoprefixer \
  @storybook/react @storybook/nextjs \
  jest @testing-library/react @testing-library/jest-dom \
  cypress playwright \
  eslint-config-next prettier eslint-config-prettier \
  lint-staged husky
cd ../..

echo "▸ Scaffolding Expo mobile app..."
cd apps/mobile
pnpm create expo-app@latest . --template blank-typescript
pnpm add \
  nativewind \
  expo-router \
  zustand @tanstack/react-query @trpc/client \
  zod
pnpm add -D \
  tailwindcss@3 \
  jest jest-expo \
  prettier eslint
cd ../..

echo "▸ Scaffolding NestJS API gateway..."
cd services/api-gateway
pnpm init
pnpm add \
  @nestjs/core @nestjs/common @nestjs/platform-express \
  @nestjs/microservices @nestjs/websockets @nestjs/platform-socket.io \
  @nestjs/swagger \
  @nestjs/config \
  @nestjs/jwt @nestjs/passport passport passport-jwt \
  @trpc/server \
  @apollo/server graphql @nestjs/graphql \
  @grpc/grpc-js @grpc/proto-loader \
  socket.io \
  prisma @prisma/client \
  mongoose \
  ioredis \
  helmet cors \
  express-rate-limit \
  bcrypt jsonwebtoken \
  stripe twilio @sendgrid/mail cloudinary \
  zod class-validator class-transformer \
  winston
pnpm add -D \
  @nestjs/cli @nestjs/testing \
  typescript @types/node @types/express \
  jest @types/jest ts-jest \
  prettier eslint \
  nodemon ts-node
cd ../..

echo "▸ Scaffolding Python AI service..."
cd services/ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install \
  fastapi uvicorn[standard] \
  langchain langchain-openai langchain-community \
  llama-index llama-index-vector-stores-pinecone \
  openai anthropic \
  pandas numpy scikit-learn \
  pinecone-client pymilvus \
  python-dotenv pydantic \
  grpcio grpcio-tools \
  httpx \
  prometheus-fastapi-instrumentator \
  sentry-sdk \
  pytest pytest-asyncio httpx
deactivate
cd ../..

echo "▸ Scaffolding Spring Boot data processor (Maven)..."
cd services/data-processor
mvn archetype:generate \
  -DgroupId=com.nexus \
  -DartifactId=data-processor \
  -DarchetypeArtifactId=maven-archetype-quickstart \
  -DinteractiveMode=false || echo "Maven not installed — create pom.xml manually"
cd ../..

echo "▸ Done! Run: cd project-nexus && pnpm install && pnpm dev"
