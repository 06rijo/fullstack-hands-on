## Description

<!--
Explain what this change does and why. Reference the issue it resolves.
Keep each app self-contained under `apps/` — do not modify co-located apps.
-->

- Closes #

## Type of change

<!-- Check the box that applies. Delete irrelevant options. -->

- [ ] 🚀 Feature
- [ ] 🐛 Bug fix
- [ ] ♻️ Refactor
- [ ] 📝 Documentation
- [ ] 🔧 CI / build tooling
- [ ] ⚙️ Other (describe):

## Which app(s) are affected?

- [ ] `apps/app-template`
- [ ] `apps/` (new app → name it below)
- [ ] Other (describe):

## How to verify

<!--
CI builds and boots every app in a matrix, so a passing pipeline is part of
the bar. Still, tell a reviewer exactly what you tested and how.
-->

1. Local build check (required before opening the PR):
   ```bash
   cd apps/<your-app>
   docker compose build
   docker compose up -d --wait
   docker compose ps   # both services show "running"
   docker compose down -v
   ```

2. Manual smoke test — endpoints exercised:
   - Backend `/health`: <URL/curl output>
   - Frontend: <URL/screenshot or output>

## Checklist

Before submitting, confirm:

- [ ] My changes are scoped to the app(s) I named above.
- [ ] No secrets or local environment files (`.env*`, tokens, keys) are committed.
- [ ] `docker compose build` succeeds for every app I touched.
- [ ] The app(s) actually start and respond when checked locally.
- [ ] Commit message follows [Conventional Commits](https://www.conventionalcommits.org/).

## Screenshots / logs (if applicable)

<!-- Paste terminal output for build/run, or UI screenshots. -->