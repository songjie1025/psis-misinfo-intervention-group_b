# Repository Structure Guide

Welcome! This document explains how this project is organized and how to get started.

---

## Folder Overview

```
psis-misinfo-intervention-group_b/
├── README.md                 ← Project overview (you are here)
├── .gitignore                ← Files Git should ignore
├── 1_docs/                   ← Documentation for the team
│   └── REPOSITORY_GUIDE.md   ← This file
├── 2_backend/                ← Python backend (API server)
│   ├── requirements.txt      ← Python dependencies
│   ├── main.py               ← FastAPI application with all API routes
│   └── database.py           ← SQLite database setup + mock post data
└── 3_frontend/               ← Browser-based mockup (no build step)
    ├── index.html            ← Entry point — open this in your browser
    ├── app.js                ← All UI logic (React components)
    └── mock-data/            ← Content and design docs for the mock platform
        ├── posts.json        ← 20 mock social media posts
        └── DESIGN.md         ← Why we made certain design choices
```

---

## Backend (`2_backend/`)

### What Goes Here

- API route definitions
- Database models and queries
- Business logic (risk score calculation, intervention selection, LLM stubs)

### File Explanations

**`requirements.txt`**
Lists the Python packages needed to run the backend. Install with:

```bash
pip install -r requirements.txt
```

Currently contains: `fastapi`, `uvicorn`, `httpx`.

**`main.py`**
The main FastAPI application. Contains all 6 API endpoints:

| Endpoint                   | Method | Purpose                                          |
| -------------------------- | ------ | ------------------------------------------------ |
| `/api/posts`               | GET    | Return all mock posts                            |
| `/api/detect`              | POST   | Check if a post is misinformation                |
| `/api/bigfive`             | POST   | Submit BFI-10 personality test scores            |
| `/api/behavior`            | POST   | Log a user interaction (view, like, share, etc.) |
| `/api/intervention/{id}`   | GET    | Get personalized intervention for a post         |
| `/api/dashboard/{session}` | GET    | Return dashboard stats for a user                |

**`database.py`**
Sets up three SQLite tables (`users`, `posts`, `behavior_logs`) and contains 20 hard-coded mock posts. The `init_db()` function runs automatically when the server starts, creating tables and inserting posts if the database is empty.

### How to Run

```bash
cd 2_backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then open http://localhost:8000/docs to see the auto-generated API documentation.

### What to Edit

- To add or change API endpoints → edit `main.py`
- To add or change mock posts → edit the `MOCK_POSTS` list in `database.py`
- To change the database schema → edit the `SCHEMA` string in `database.py`

---

## Frontend (`3_frontend/`)

### What Goes Here

- HTML, CSS, and JavaScript for the browser-based mockup
- Mock content data (fake posts)

### File Explanations

**`index.html`**
The entry point. Open this file directly in Chrome or any modern browser. It loads React, Babel, and Tailwind CSS from CDN (no npm install needed).

**`app.js`**
Contains the entire frontend application as React components:

| Component             | What It Renders                                          |
| --------------------- | -------------------------------------------------------- |
| `App`                 | Root component, manages session and view switching       |
| `BigFiveTest`         | BFI-10 personality quiz (10 questions, Likert scale)     |
| `Feed`                | Main Twitter-style timeline, loads posts from backend    |
| `PostCard`            | Individual post with author, content, like/share buttons |
| `InterventionDisplay` | Shows one of three intervention types                    |
| `Dashboard`           | Stats page with topic diversity, misinfo exposure, tips  |

### How to Run

1. Make sure the backend is running (see above)
2. Open `index.html` in your browser
3. Complete the BFI-10 personality quiz
4. Click on posts to trigger misinformation detection

### What to Edit

- To change the UI layout → edit the JSX in `app.js`
- To add or modify mock posts → edit `mock-data/posts.json`
- To change styling → edit the `<style>` block in `index.html` or the Tailwind classes in `app.js`

---

## Mock Data (`3_frontend/mock-data/`)

**`posts.json`**
20 fabricated social media posts used by the prototype. 10 are true, 10 are misinformation. Each post has an author, content, category (health/politics/tech/science), and a truth label. The backend reads this file on startup and inserts the posts into the database.

**`DESIGN.md`**
Documents the design rationale behind key decisions: why we chose Twitter over Facebook, why we use three intervention types, why there are 20 posts, and why we chose a no-build-step frontend. Read this before making major design changes.

---

## How Everything Connects

```
Browser (index.html + app.js)
    │
    │  fetch() calls to http://localhost:8000/api/*
    │
    ▼
FastAPI Server (main.py)
    │
    │  reads/writes
    ▼
SQLite Database (app.db) ← created automatically on first run
    │
    │  seeded from
    ▼
database.py (MOCK_POSTS list)
```

The frontend talks to the backend via HTTP requests. The backend stores everything in a local SQLite file (`app.db`). No external services are needed — everything runs on your computer.

---

## Getting Started (Quick Start)

```bash
# 1. Clone the repository
git clone <repo-url>
cd psis-misinfo-intervention-group_b

# 2. Start the backend (in one terminal)
cd 2_backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3. Open the frontend (in your browser)
#    Open 3_frontend/index.html directly, OR
#    cd 3_frontend && python3 -m http.server 3000

# 4. Complete the personality quiz in the browser
# 5. Click on posts to see interventions
# 6. Click "Dashboard" in the nav bar to see your stats
```

---

## FAQ

**Q: Do I need to install Node.js?**
A: No. The frontend uses React via CDN. Just open `index.html` in a browser.

**Q: The frontend shows "Could not connect to backend". What's wrong?**
A: Make sure the backend is running (`uvicorn main:app --reload --port 8000` in the `2_backend/` folder). The frontend expects the API at `http://localhost:8000`.

**Q: How do I reset the database?**
A: Delete the `app.db` file in `2_backend/` and restart the server. It will be recreated with fresh mock data.

**Q: Where do I add real LLM / ClaimBuster calls?**
A: In `main.py`, inside the `detect_misinformation()` function. Currently it returns pre-labeled data from the database — replace with API calls to Gemini Flash or ClaimBuster.
