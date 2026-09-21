# app-template

A starting point for new apps in this repository. Copy this folder into `apps/`, rename it
to your app's name, and fill in the `backend/` and `frontend/` with your own code.

## Structure

```text
app-template/
├── docker-compose.yml   # Runs backend and frontend together locally
├── backend/             # API / server side (Python + FastAPI)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/             # Application source (Python package)
│       ├── __init__.py
│       └── main.py      # FastAPI app + / and /health endpoints
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

- **backend** on <http://localhost:8000> — health check at `/health`, interactive docs at `/docs`
- **frontend** on <http://localhost:5173>

### Running each part without Docker

```bash
# Backend (Python 3.12)
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.main:app --reload    # http://localhost:8000

# Frontend (Node.js)
cd frontend
npm install
npm start                        # http://localhost:5173
```

## Creating a new app from this template

1. `cp -r apps/app-template apps/your-app`
2. Add your own packages to `backend/requirements.txt` and to
   `frontend/package.json` (renaming the `name` field in the latter).
3. Update service names, container names, and ports in `docker-compose.yml`.
4. Replace the starter code in `backend/src/` and `frontend/src/`.
5. Rewrite this README to describe your app.