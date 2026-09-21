# app-template

A starting point for new apps in this repository. Copy this folder into `apps/`, rename it
to your app's name, and fill in the `backend/` and `frontend/` with your own code.

## Structure

```text
app-template/
├── docker-compose.yml   # Runs backend and frontend together locally
├── backend/             # API / server side (Node.js + Express)
│   ├── Dockerfile
│   ├── package.json
│   └── src/             # Application source
└── frontend/            # UI side (Node.js static server — replace with your framework)
    ├── Dockerfile
    ├── package.json
    └── src/             # Application source
```

## Running locally

From inside this folder (i.e. `apps/app-template/`):

```bash
docker compose up --build
```

This starts:

- **backend** on <http://localhost:3001> — health check at `/health`
- **frontend** on <http://localhost:5173>

### Running each part without Docker

```bash
# Backend
cd backend
npm install
npm start

# Frontend
cd frontend
npm install
npm start
```

## Creating a new app from this template

1. `cp -r apps/app-template apps/your-app`
2. Rename the package `name` fields in `backend/package.json` and `frontend/package.json`.
3. Update service names, container names, and ports in `docker-compose.yml`.
4. Replace the starter code in `backend/src/` and `frontend/src/`.
5. Rewrite this README to describe your app.