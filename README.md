# X-Check — Personalized Misinformation Intervention

> A Chrome extension that detects potential misinformation in social-media posts and delivers fact-check interventions whose **strength adapts to the user's behaviour** and whose **wording adapts to the user's personality**.

Course project · LMU - PSIS, Summer Semester 2026 · Group B
<h1 align="center">🛡️ X-Check</h1>

<p align="center">
  <b>Personalized misinformation intervention as a Chrome extension</b><br>
  Interventions whose <i>strength</i> adapts to user behaviour and whose <i>wording</i> adapts to personality.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome MV3">
  <img src="https://img.shields.io/badge/Gemini_API-8E75B2?logo=googlegemini&logoColor=white" alt="Gemini API">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React 18">
  <img src="https://img.shields.io/badge/tested_with-Jest-C21325?logo=jest&logoColor=white" alt="Jest">
</p>

<p align="center">
  Course project · LMU Munich – PSIS, Summer Semester 2026 · Group B
</p>

<p align="center">
  <img width="85%" alt="X-Check intervention on the mockup feed" src="https://github.com/user-attachments/assets/a3187a4b-31ce-49dd-ad16-39698c6c3144" />
  <br>
  <sub><i>X-Check flagging a post and showing a personalized intervention on the X-style mockup feed</i></sub>
</p>

<p align="center">
  <a href="#-why">Why</a> ·
  <a href="#%EF%B8%8F-how-it-works">How it works</a> ·
  <a href="#-key-features">Features</a> ·
  <a href="#-getting-started">Getting started</a> ·
  <a href="#-my-role">My role</a>
</p>

---
---

## Why

Most fact-checking is one-size-fits-all: every user sees the same label, regardless of how they interact with misinformation. X-Check explores a more adaptive approach. It escalates only when a user's behaviour suggests they are at risk, and it phrases each warning in a way the user is more likely to accept.

## How it works

```
Post on X-style mockup feed
  → claim extraction & fact-check (Gemini + Google Fact Check Tools)
  → verdict (False / Disputed / Misleading / Unverified)
  → Risk Score (0–100) from personality baseline + live behaviour
  → intervention tier: T1 Label → T2 Justification with sources → T3 Full-screen interruption
  → LLM-generated wording adapted to the user's personality
```

## Key features

- **Onboarding questionnaire**: BFI-10 Big Five assessment (plus an optional political-orientation item), converted locally into abstract personality labels.
- **Adaptive Risk Score with a learning loop**:
  - Behaviour events (sharing or liking flagged posts, dismissing warnings, reading expanded warnings, clicking trusted sources) raise or lower the score.
  - The score decays back toward neutral over time.
  - Passive signals such as fast scrolling are rate-limited, so ambient browsing alone cannot escalate a user beyond the lightest tier.
- **Three escalating intervention tiers**: the Risk Score alone selects the tier. Personality only changes the *wording*, never the *level*.
- **Personality-adapted LLM wording**: Gemini generates intervention text tuned to Openness, Agreeableness and Conscientiousness. A local fallback keeps the UI working when the API is slow or rate-limited.
- **Prebunking quiz**: in-feed cards ask users to identify the manipulation technique (FLICC taxonomy). Correct answers lower the Risk Score.
- **Live risk indicator & interaction dashboard**: shows the current risk tier and aggregates the user's interactions with flagged content.

## Design principles

- **Privacy by design / local-first**: questionnaire answers, profile and Risk Score history are stored only in `chrome.storage`. The LLM receives only abstract personality labels and the post text, never raw answers.
- **Bring-your-own-key**: API keys are entered in the extension popup and stored locally. Users can wipe all data with one click.
- **Testable core logic**: scoring, intervention decisions, quiz logic and dashboard statistics are pure functions covered by Jest unit tests.

## Tech stack

TypeScript · Chrome Extension (Manifest V3) · esbuild · Google Gemini API · Google Fact Check Tools API · React 18 + Tailwind (mockup site) · Jest / ts-jest

## Repository structure

```
1_docs/                Requirements & design decisions
2_browser-extension/   MV3 extension (TypeScript → esbuild → dist/)
  src/pipeline/        Fact-check pipeline (extract → search → align → verdict)
  src/profile/         BFI-10 questionnaire → personality profile
  src/scoring/         Risk Score, behaviour weights, learning loop
  src/interventions/   Tier selection & personality-adapted wording
  src/quiz/            Prebunking quiz logic
  src/dashboard/       Interaction statistics
  tests/               Jest unit tests
3_mockup-website/      X-style demo feed (React/JSX)
```

## Getting started

```bash
# 1. Mockup website
cd 3_mockup-website
./setup.sh            # Windows: setup.bat
npm start             # → http://localhost:8000

# 2. Extension
cd ../2_browser-extension
npm install
npm run build         # outputs dist/
npm test              # unit tests
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `2_browser-extension/`. Enter your Gemini and Fact Check API keys in the extension popup.

## My role (Jie Song)

- **Repository lead**: set up the project structure and branching/PR workflow, reviewed and merged pull requests, and led two architecture refactors.
- **Fact-check pipeline**: integrated the Gemini client with integration tests (together with Amin).
- **Extension architecture**: scaffolded the TypeScript + esbuild MV3 toolchain and the core modules for profile, scoring, interventions, storage, typed messaging and onboarding.
- **Risk Score model**: designed and implemented the personality baseline, the behaviour-driven learning loop and the in-page questionnaire panel.
- **Personalized interventions**: built personality-adapted prompts, connected quiz scoring with resilient Gemini wording generation, and added live risk-tier indicators.

## Team

Amin · Jie · Tolga · Sarah — PSIS SS2026, Group B. See [`1_docs/REQUIREMENTS.md`](1_docs/REQUIREMENTS.md) for the full role split.

## Limitations & next steps

- This is a research prototype, demonstrated on a mockup feed rather than real platforms.
- Post content is sent to Google APIs for fact-checking. A production version would need a backend proxy for API keys and a clear data-egress policy.
- Risk Score weights and thresholds are a first version and not yet empirically calibrated. The natural next step is a user study measuring whether personalized wording actually changes sharing behaviour.
