set shell := ["bash", "-uc"]

COMPOSE := "docker compose"
FRONTEND := "frontend"
TEST_IMAGE := "kanban-frontend-test"
BACKEND_IMAGE := "kanban-backend:latest"

# Print the list of available recipes
default:
    @just --list

# Build the frontend tooling image (node + deps) used by lint/format/typecheck/build
test-image:
    docker build -f {{FRONTEND}}/Dockerfile.test -t {{TEST_IMAGE}} {{FRONTEND}}

# Build the backend image used by the e2e tests
backend-image:
    docker build -t {{BACKEND_IMAGE}} ./backend

# Run ESLint over the frontend sources (in a container)
lint: test-image
    docker run --rm {{TEST_IMAGE}} npm run lint

# Run prettier in write mode over the frontend sources (in a container)
format: test-image
    docker run --rm {{TEST_IMAGE}} npm run format

# Type-check the frontend, no output (in a container)
typecheck: test-image
    docker run --rm {{TEST_IMAGE}} npx tsc --noEmit

# Build the frontend production bundle, type-check + vite build (in a container)
build: test-image
    docker run --rm {{TEST_IMAGE}} npm run build

# Build both Docker images
build-images:
    {{COMPOSE}} build

# Run the full test suite (lint + typecheck + build + e2e, all in containers)
test:
    just lint typecheck build test-e2e

# Run Playwright e2e tests (spawns an isolated test backend container)
test-e2e: backend-image
    bash {{FRONTEND}}/scripts/e2e.sh

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
