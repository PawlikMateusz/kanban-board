# kanban-board

A simple kanban board for personal usage, built with a React/Vite frontend and a
[PocketBase](https://pocketbase.io/) backend.

## Stack

- **Frontend** — React 19, Vite, TypeScript, Tailwind CSS
- **Backend** — PocketBase (SQLite), ships its schema migrations in `backend/pb_migrations`
- **Tests** — Playwright e2e (frontend) run against an isolated test backend

## Development

Requires [just](https://github.com/casey/just) and Docker.

```sh
just setup      # install frontend dependencies
just dev        # run frontend + backend locally (docker compose)
just test       # lint + type-check + build the frontend
just test-e2e   # run Playwright e2e tests
just build-images  # build Docker images
```

Run `just --list` to see all available recipes.

## Deploy with Docker Compose

The CI pipeline builds and pushes container images to GHCR
(`ghcr.io/pawlikmateusz/kanban-{backend,frontend}`).

```sh
git clone git@github.com:PawlikMateusz/kanban-board.git
cd kanban-board
docker compose pull    # pull images from GHCR
docker compose up -d   # start backend (:8090) and frontend (:5173)
```

> Make sure the GHCR packages are set to **public** (GitHub → package settings),
> or authenticate with `docker login ghcr.io -u <user> -p <PAT>` first.

Alternatively, build everything locally instead of pulling:

```sh
docker compose up -d --build
```

Data is persisted in `./pb_data` (SQLite database + file storage). To reset,
stop the stack and remove the directory or run `just clean`.

## Pull requests

Every commit pushed to a PR runs the full test suite automatically. A testable
container image is also built and published per PR as
`ghcr.io/pawlikmateusz/kanban-{backend,frontend}:pr-<number>`, and the tag is
posted as a comment on the PR.
