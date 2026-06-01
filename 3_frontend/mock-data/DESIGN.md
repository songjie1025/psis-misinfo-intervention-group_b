# DESIGN.md — Mock Platform Design Decisions

## Why Twitter Instead of Facebook

**Functional fit:**
Twitter's format — short, text-heavy posts in a single scrolling timeline — makes it easier to prototype misinformation detection. Posts are self-contained and quick to analyze, unlike Facebook's mixed-media feed with long posts, images, videos, and nested comments.

**Implementation simplicity:**
A Twitter-like feed is a straight list of post cards. A Facebook-like feed requires handling multiple content types (photos, albums, events, groups), which adds weeks of UI work without benefiting the intervention research.

**Research alignment:**
Most existing misinformation research uses Twitter data (Song et al., 2024, Frontiers in Psychology). This makes it easier to reference prior work and compare findings.

---

## Intervention Types — Why Three

We use three escalation levels based on user vulnerability:

| Type | Name | When Applied | Rationale |
|------|------|-------------|-----------|
| 1 | Label | Low-risk users (low neuroticism, high openness) | A simple badge is enough — the user will investigate on their own |
| 2 | Justification | Medium-risk users (high openness, medium conscientiousness) | These users appreciate a detailed explanation with sources |
| 3 | Interruption | High-risk users (high neuroticism, low openness, high risk score) | A full-screen pause prevents impulsive sharing before the user processes the warning |

This maps to the psychological concept of "cognitive friction" — the more vulnerable a user is, the more friction we introduce before they interact with misinformation.

---

## Post Count — Why 20

20 posts (10 true, 10 misinformation) is sufficient for a prototype because:

1. It provides enough variety across 4 categories (health, politics, tech, science)
2. It allows testing all three intervention types multiple times
3. It keeps the BFI-10 test results meaningful — the user sees enough posts for behavior patterns to emerge
4. It is small enough to hard-code and iterate on quickly

We can expand to 50 posts later without changing any code structure.

---

## Tech Stack Rationale

| Choice | Reason |
|--------|--------|
| **Plain HTML + CDN React** (no build step) | Zero setup for all 4 teammates. No Node.js required to run the frontend. Just open `index.html` in a browser. |
| **Python FastAPI** (backend) | Fast to write, auto-generates API docs at `/docs`, async support for concurrent LLM calls |
| **SQLite** (database) | Zero-config, file-based, no server to install. Perfect for a prototype with one local user. |
| **No Vite / Webpack** | Build tools solve problems we don't have: no production deployment, no large codebase, no legacy browser support |

---

## Mock Data Philosophy

All posts in `posts.json` are **fabricated for demonstration purposes**. They are designed to:

- Be recognizable as true or false without external fact-checking (for prototype demo clarity)
- Cover diverse topics so the dashboard shows meaningful topic diversity
- Include a mix of obvious and subtle misinformation to test intervention sensitivity

In a real deployment, posts would come from a live social media API and detection would use ClaimBuster + LLM. For this prototype, we use pre-labeled ground truth to focus on the intervention logic.

---

## What This Prototype Does NOT Do (Yet)

- Real-time ClaimBuster API integration (stubbed — returns pre-labeled data)
- Real LLM calls (stubbed — returns pre-labeled ground truth)
- Multi-user support (single local session)
- Persistent risk score updates across sessions (risk score resets on page reload)
- Mobile-responsive design (desktop-only for demo)
