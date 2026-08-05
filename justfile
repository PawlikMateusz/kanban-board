set shell := ["bash", "-uc"]

COMPOSE := "docker compose"
FRONTEND := "frontend"

# Print the list of available recipes
default:
    @just --list

# Install all dependencies (npm ci in the frontend)
setup:
    cd {{FRONTEND}} && npm ci

# Run ESLint over the frontend sources
lint:
    cd {{FRONTEND}} && npm run lint

# Run prettier in write mode over the frontend sources
format:
    cd {{FRONTEND}} && npm run format

# Type-check the frontend (tsc --noEmit, no output)
typecheck:
    cd {{FRONTEND}} && npx tsc --noEmit

# Build the frontend production bundle (type-check + vite build)
build:
    cd {{FRONTEND}} && npm run build

# Build both Docker images
build-images:
    {{COMPOSE}} build

# Run the full frontend test suite (lint + typecheck + build)
test:
    just lint typecheck build

# Run Playwright e2e tests (spawns an isolated test backend container)
test-e2e:
    cd {{FRONTEND}} && npm run test:e2e

# Bring the full stack up (builds images on first run)
up:
    {{COMPOSE}} up -d --build

# Run the full stack locally (builds and starts backend + frontend containers)
dev:
    {{COMPOSE}} up -d --build
    just logs

# Bring the stack down (keeps data volume)
down:
    {{COMPOSE}} down

# Bring the local testing stack up (builds both images from source, no GHCR pull)
test-up:
    {{COMPOSE}} -f docker-compose.local.yml up -d --build

# Bring the local testing stack down
test-down:
    {{COMPOSE}} -f docker-compose.local.yml down

# Tail logs of all services
logs:
    {{COMPOSE}} logs -f

# Stop containers and remove the local data volume
clean:
    {{COMPOSE}} down -v
