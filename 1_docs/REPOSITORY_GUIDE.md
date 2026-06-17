# Repository Guide

This document explains how the project is organized, why we structured it
this way, and how to run it locally for development and demos.

---

## Project Structure

```
psis-misinfo-intervention-group_b/
│
├── 1_docs/                          ← Documentation
│
├── 2_backend/                       ← FastAPI server + business logic
│   ├── main.py                      ← Entry point + API routes
│   ├── src/app/
│   │   ├── database.py              ← SQLite schema (users, behavior_logs)
│   │   ├── intervention.py          ← Risk score + intervention selection
│   │   └── factcheck/               ← Misinformation detection pipeline
│   │       ├── pipeline.py
│   │       ├── models.py
│   │       ├── prompts.py
│   │       ├── parser.py
│   │       ├── gemini_client.py
│   │       ├── google_client.py
│   │       └── claude_client.py
│   ├── tests/
│   ├── pyproject.toml / uv.lock
│   ├── env.example                  ← Template for required API keys
│   └── .env                         ← Local secrets (gitignored)
│
└── 3_frontend/                      ← Everything that runs in the browser
    │
    ├── mockup-website/              ← Simulated Twitter environment
    │   ├── index.html
    │   ├── app.js                   ← MVC-structured frontend
    │   ├── package.json             ← Babel for JSX compilation
    │   └── mock-data/               ← Posts and comments served to users
    │       ├── posts.json
    │       ├── comments.json
    │       └── DESIGN.md
    │
    └── browser-extension/           ← Chrome extension (intervention layer)
        └── (structure TBD — pending framework choice)
```

---

## Structural Rationale

The codebase is split into **two top-level concerns**:

1. **`2_backend/`** — the server (FastAPI + SQLite + factcheck pipeline)
2. **`3_frontend/`** — everything that runs inside the user's browser

Within `3_frontend/`, we have **two tightly coupled components**:

- **`mockup-website/`** — a controlled simulation of Twitter that we
  fully own. It serves a fixed set of posts (some true, some
  misinformation) so that user studies are reproducible. Without this,
  participants on real Twitter would never see a guaranteed mix of
  misinformation, and we could not measure intervention effects cleanly.

- **`browser-extension/`** — the actual research tool. It injects into
  the mockup website, reads posts from the DOM, calls the backend to
  classify them, and shows personalized interventions to the user.

The mockup-website and the browser-extension are **deliberately grouped**
under `3_frontend/` because they exist for each other: the mockup is the
controlled environment, and the extension is what we study inside that
environment. Outside this project they have no independent purpose.

### Frontend Architecture: MVC

Both the mockup-website and (eventually) the extension follow an **MVC
pattern**:

- **Model** — data access (post lists, user session, BFI scores)
- **View** — presentational React components rendered into the DOM
- **Controller** — interaction handling and side effects (fetch, state
  updates)

This separation keeps fetch/API logic out of UI components and makes it
easier to mirror the same architecture between the mockup site and the
extension.

---

## How Everything Connects

```
┌──────────────────────────────────────────────────────────────────────┐
│ One FastAPI process on localhost:8000                                │
│                                                                      │
│   /                       → mockup-website/index.html (static)       │
│   /mock-data/posts.json   → mockup-website/mock-data/...             │
│   /api/bigfive            → store BFI-10 scores, compute risk        │
│   /api/behavior           → log user interactions                    │
│   /api/detect             → factcheck pipeline (Gemini + Google)     │
│   /api/intervention       → personalized intervention                │
│   /api/dashboard/{id}     → aggregated stats + tips                  │
│   /docs                   → auto-generated OpenAPI docs              │
└──────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ HTTP
                                  │
        ┌─────────────────────────┴──────────────────────────┐
        │ User's browser                                     │
        │                                                    │
        │   ┌─ Mockup tab (localhost:8000) ─┐                │
        │   │ Twitter-style feed             │                │
        │   │ rendered from posts.json       │                │
        │   └────────────────────────────────┘                │
        │                  ▲                                 │
        │                  │ DOM injection                   │
        │                  │                                 │
        │   ┌─ Browser Extension (installed) ┐               │
        │   │ Reads DOM, calls backend,       │               │
        │   │ shows BFI/Intervention/Dashboard│               │
        │   └─────────────────────────────────┘               │
        └────────────────────────────────────────────────────┘
```

Key properties:

- **One server, one port.** The backend serves both the API and the
  mockup as static files. This matches how the extension will work in
  production (it talks to a single origin) and removes CORS configuration
  in development.
- **No posts in the database.** The mockup-website owns the posts; the
  backend only persists user data (BFI scores, behavior logs).
- **Detection runs on demand.** When the extension sees a post, it sends
  the content to `/api/detect`, which runs the factcheck pipeline and
  returns a verdict + explanation.

---

## Running the Project Locally

You need **two terminals**: one for the backend (which also serves the
mockup), and the browser to view the result.

### Prerequisites

- **Python 3.11+** with [`uv`](https://docs.astral.sh/uv/) installed
- **Node.js 18+** with `npm`
- A `.env` file inside `2_backend/` containing:
  ```
  FACT_CHECK_API="<your Google Fact Check API key>"
  GEMINI_API_KEY="<your Gemini API key>"
  ```
  Use `2_backend/env.example` as a template.

### First-time setup

```bash
# 1. Install backend dependencies
cd 2_backend
uv sync

# 2. Install frontend (mockup) dependencies and compile JSX
cd ../3_frontend/mockup-website
npm install
npm run compile
```

### Starting the server

```bash
cd 2_backend
uv run uvicorn main:app --reload --port 8000
```

Leave this running. You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000
[database] Initialized at .../2_backend/app.db
```

### Viewing the result in the browser

Open these URLs:

| URL                                      | What you should see                          |
| ---------------------------------------- | -------------------------------------------- |
| `http://localhost:8000/`                 | The mockup Twitter feed                      |
| `http://localhost:8000/docs`             | Interactive API documentation (FastAPI)      |
| `http://localhost:8000/mock-data/posts.json` | Raw JSON of the mock posts                |

### Re-compiling the frontend after edits

If you edit `3_frontend/mockup-website/app.js`, run:

```bash
cd 3_frontend/mockup-website
npm run compile
```

Then refresh the browser. The backend serves the freshly compiled file
automatically — no backend restart needed.

### Stopping the server

In the terminal running uvicorn: `Ctrl + C`.

### Resetting the database

The SQLite file (`2_backend/app.db`) is auto-created on first startup.
To wipe it and start fresh:

```bash
rm 2_backend/app.db
```

It will be re-initialized the next time the server starts.

---

## What Belongs Where

| If you want to...                              | Edit...                                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| Add or modify an API endpoint                  | `2_backend/main.py`                                  |
| Change the risk score formula or intervention selection | `2_backend/src/app/intervention.py`         |
| Modify the factcheck pipeline                  | `2_backend/src/app/factcheck/pipeline.py`            |
| Change the database schema                     | `2_backend/src/app/database.py`                      |
| Add or change posts shown in the mockup        | `3_frontend/mockup-website/mock-data/posts.json`     |
| Modify the mockup UI                           | `3_frontend/mockup-website/app.js` (then re-compile) |
| Build the actual intervention logic            | `3_frontend/browser-extension/` (TBD)                |

---

## Notes on the Mockup Website

The mockup is **not** a placeholder — it is the experiment environment.
The choice to use a self-hosted simulated platform (rather than injecting
the extension into real Twitter) is a deliberate methodological one:

- Twitter's Terms of Service do not allow DOM modification at scale
- Real feeds cannot guarantee that participants encounter misinformation
- Reproducibility requires identical content across participants
- Ethics approval is easier when we control what users are exposed to

See `3_frontend/mockup-website/mock-data/DESIGN.md` for further reasoning
about the platform and the post selection.
