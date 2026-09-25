# Shadow Protocol

A browser-playable, Dockerized FPS. Built to slot into the `apps/<name>/`
layout used by this repo (see the top-level `app-template/`): a Python +
FastAPI `backend/` and a `frontend/` served over HTTP, orchestrated together
with `docker-compose.yml`.

```
apps/shadow-protocol/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
│       ├── __init__.py
│       └── main.py          # FastAPI: accounts, profile, loadout, stats, leaderboard
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.html        # menus, HUD, results screens
        ├── style.css
        ├── state.js           # shared client state + persisted settings
        ├── api.js             # backend client
        ├── ui.js               # screen navigation & forms
        ├── game.js            # Three.js FPS: movement, weapons, AI, waves
        └── main.js             # entry point
```

## Run it

```bash
cd apps/shadow-protocol
docker compose up --build
```

- Game: http://localhost:3000
- API: http://localhost:8000 (docs at `/docs`)

Both containers publish to the host, so the browser talks to the backend
directly on `:8000` — that's why `frontend` `depends_on` `backend` in
`docker-compose.yml` rather than the two talking over the Docker network.
Player data (accounts, XP, stats) persists in a SQLite file on the
`shadow-data` named volume, so progress survives `docker compose restart`.

## What's implemented

This is a single-player vertical slice covering the user stories that make
sense in one build, not all 50 — multiplayer (join match, team match, voice
chat, matchmaking) and live-service content (seasonal rewards, daily
challenges) need real server infrastructure and were left out rather than
faked. Implemented:

- **Epic 1 — Auth & profile**: create account, log in, edit profile (avatar
  color), stats synced to the backend, view stats screen.
- **Epic 2 — Loadout**: pick a primary and secondary weapon before deploying.
- **Epic 3 — Weapons**: fire (auto/semi per weapon), reload, ADS zoom,
  instant switch (1/2), spread/damage/headshot multiplier per weapon.
- **Epic 4 — Movement**: WASD walk/sprint, jump, crouch, slide (sprint +
  crouch), prone.
- **Epic 5 — Combat**: enemy health, per-weapon damage, headshot bonus,
  health regen after time out of combat, armor pickups.
- **Epic 6 — Enemies**: patrol waypoints, sound/sight-radius detection with
  line-of-sight checks, ranged attacks, a tougher "boss" every 3rd wave.
- **Epic 7 — Missions**: wave-based objectives with a short checkpoint pause
  between waves.
- **Epic 9 — Progression**: XP per kill/headshot/wave clear, leveling,
  persisted stats, a global leaderboard.
- **Epic 10 — Settings**: mouse sensitivity, volume, graphics quality,
  on-screen "subtitles" for audio cues, reticle color, pause/resume.

## Controls

WASD move · Shift sprint · Ctrl crouch (or slide while sprinting) · Z prone ·
Space jump · mouse look · left click fire · right click aim · R reload ·
1 / 2 switch weapon · Esc pause.

## Notes / next steps

- Auth is a minimal salted-hash + bearer-token scheme, fine for local/LAN
  play — swap in a real identity provider before deploying publicly.
- Multiplayer would need a websocket-based match server (e.g. an additional
  `realtime` service) rather than the current single-player loop.
