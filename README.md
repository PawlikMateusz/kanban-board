# kanban-board

<p align="center">
  <img src="screenshots/kanban-view.png" width="24%" alt="Kanban view" />
  <img src="screenshots/dashboard-timeline.png" width="24%" alt="Dashboard timeline" />
  <img src="screenshots/card-edit-view.png" width="24%" alt="Card edit view" />
  <img src="screenshots/adding-new-card.png" width="24%" alt="Adding a new card" />
</p>

I tried a lot of self-hosted kanban boards but never quite liked any of them, so I built my own. This project was created entirely by AI.

## Stack

- **Frontend** — React 19, Vite, TypeScript, Tailwind CSS
- **Backend** — PocketBase (SQLite) with auto-applied migrations
- **Infra** — Docker Compose, images published to GitHub Container Registry
- **Tests** — Playwright e2e run in CI on every commit

## Features

- Drag-and-drop kanban board with columns and projects
- Cards with checklists, labels, comments and attachments
- Dashboard with a timeline and mini calendar
- Quick-create, global search and keyboard shortcuts
- Responsive mobile UI
- Optional CalDAV (Radicale) sync: push a due-dated task to your iPhone as a Reminder

## Run with Docker Compose

```yaml
services:
  backend:
    image: ghcr.io/pawlikmateusz/kanban-backend:latest
    container_name: kanban-backend
    restart: unless-stopped
    ports:
      - "8090:8080"
    volumes:
      - ./pb_data:/pb_data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/api/health"]
      interval: 5s
      timeout: 3s
      retries: 10

  frontend:
    image: ghcr.io/pawlikmateusz/kanban-frontend:latest
    container_name: kanban-frontend
    restart: unless-stopped
    ports:
      - "5173:80"
    depends_on:
      backend:
        condition: service_healthy
```

```sh
docker compose up -d
```

Open http://localhost:5173. Data is stored in `./pb_data`.

Reverse-proxy only the **frontend** (port 5173) — it already proxies `/api/` to the backend internally. Keep the backend port (8090) private.

## CalDAV sync (optional)

When configured, tasks **with a due date** show a "Send to calendar" button in the
details drawer. It writes the task to your Radicale calendar as a VTODO and it
will appear on your iPhone as a Reminder. Only the task's **due date** is synced
(date and time); Radicale has no reminders/alarms, so the entry mirrors what the
iOS Reminders app writes itself (a VTODO with `DTSTART`/`DUE` in the local
timezone). Re-sending just updates the same entry with the current due date.
If you change a synced task's due date, the button turns amber with an
"Out of sync" badge until you re-sync.

### Setup

1. Set these environment variables on the `backend` service (Compose already
   forwards `RADICALE_*` from your shell or `.env` file):

   ```sh
   RADICALE_URL="https://radicale.example.com/yourname/calendar"   # calendar collection base URL
   RADICALE_USER="yourname"
   RADICALE_PASSWORD="yourpassword"
   ```

   `RADICALE_URL` must point directly at the calendar collection that will hold
   the entries (create it in Radicale first, e.g. `/yourname/calendar/`).
   `RADICALE_TZID` is optional and defaults to `Europe/Warsaw` (the timezone
   used for `DTSTART`/`DUE`).

2. Restart the stack:

   ```sh
   docker compose up -d
   ```

3. On your iPhone: *Settings → Calendar → Accounts → Add Account → Other → Add
   CalDAV Account*, enter your Radicale server, user and password, then make
   sure **Reminders** sync is enabled for the account. The synced tasks appear
   as reminders in the Reminders app; they refresh on the normal sync schedule.

Re-sending a task updates the same entry (the resource URL is derived from the
task id, so it is idempotent) and the ✕ button removes the entry from Radicale.
The feature is fully disabled when the env vars above are not set.
