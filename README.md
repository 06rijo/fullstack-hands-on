# fullstack-hands-on

Repository for hands-on full-stack projects built as part of fullstack training.

Every standalone application lives under `apps/` as its own self-contained folder.
New contributors add their apps there without interfering with existing ones.

## Getting started

```bash
git clone https://github.com/getwithashish/fullstack-hands-on.git
cd fullstack-hands-on
```

## Repository structure

```text
apps/                          # Directory containing individual apps
└── app-template/              # Starter template — copy it to create a new app
    ├── docker-compose.yml     # Local orchestration for backend + frontend
    ├── README.md
    ├── backend/               # API / server side
    │   ├── Dockerfile
    │   ├── package.json
    │   └── src/
    └── frontend/              # UI side
        ├── Dockerfile
        ├── package.json
        └── src/
```

## Creating your own app

1. Copy `apps/app-template/` to `apps/<your-app>/` (e.g. `apps/todo-app`).
2. Replace the starter implementation in `backend/` and `frontend/` with your code.
3. Update `docker-compose.yml` service names and ports to match your app.
4. See [`apps/app-template/README.md`](apps/app-template/README.md) for details and commands.

## Contributing

- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
- Keep each app self-contained under `apps/`.
- Verify your app builds and runs before opening a pull request.