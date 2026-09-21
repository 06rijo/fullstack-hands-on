"""FastAPI application entrypoint for the app-template backend.

Run locally from the ``backend`` directory with::

    uvicorn src.main:app --reload

or inside Docker via ``docker compose up --build`` from ``apps/app-template/``.
"""

from fastapi import FastAPI

app = FastAPI(
    title="app-template backend",
    description="Minimal FastAPI backend for the fullstack-hands-on app-template.",
    version="0.1.0",
)


@app.get("/")
def root() -> dict[str, str]:
    """Identify the service and point at the interactive API docs."""
    return {"service": "app-template-backend", "docs": "/docs"}


@app.get("/health")
def health() -> dict[str, str]:
    """Report service health; orchestrators poll this to confirm the container is up."""
    return {"status": "ok", "service": "app-template-backend"}