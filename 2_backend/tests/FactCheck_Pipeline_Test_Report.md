# FactCheck Pipeline — Integration Test Report

> PSIS Group B — XCheck | Tested: 2026-06-11 | Jie Song (Backend)

---

## Status

The end-to-end pipeline runs without errors. Gemini and the Google FactCheck API cooperate correctly across all test cases. However, several accuracy and reliability issues were identified and are documented below.

---

## Pipeline

```
Post text
  → [1] Gemini: extract atomic claims
  → [2] Google FactCheck API: search for matching records
  → [3] Gemini: alignment check (are the records relevant to the claim?)
  → [4] Rule-based verdict: CONTRADICTED→FALSE | MISLEADING | Mixed→DISPUTED | None→UNVERIFIED
  → [5] Gemini: generate plain-language explanation for the user
```

---

## Test Results

| #   | Post                                                             | Google Records | Verdict      | Notes                                                                            |
| --- | ---------------------------------------------------------------- | -------------- | ------------ | -------------------------------------------------------------------------------- |
| 1   | "The WHO admitted COVID-19 was created in a lab as a bioweapon." | Multiple found | `UNVERIFIED` | ⚠️ Should be FALSE — alignment step rejected all records due to wording mismatch |
| 2   | "Drinking celery juice every morning cures cancer."              | 0              | No verdict   | ✅ Graceful fallback — niche claim not in database                                |
| 3   | "The government uses vaccines to implant microchips."            | 0              | No verdict   | ✅ Graceful fallback                                                              |

---

## Performance

| Mode                             | Latency   | Notes                                           |
| -------------------------------- | --------- | ----------------------------------------------- |
| Database mode (`?live=false`)    | ~0.002s   | Reads pre-labeled SQLite field — instant        |
| **Pipeline mode (`?live=true`)** | **~6.6s** | Gemini ×3 calls + Google API ×N claims (serial) |
| └ Gemini claim extraction        | ~1.5s     |                                                 |
| └ Google API per claim           | ~1.2s     | Scales linearly with claim count                |
| └ Gemini alignment               | ~2.0s     |                                                 |
| └ Gemini explanation             | ~1.5s     |                                                 |

Typical range: **5–15s** depending on claim count and API availability.

---

## Key Findings

### 1. Accuracy — Wording Mismatch Causes False UNVERIFIED

The most significant accuracy gap: Google returned relevant fact-check records for the COVID bioweapon claim, but Gemini's alignment step judged them as not directly matching the claim's exact wording and filtered them out. The final verdict was `UNVERIFIED` instead of `FALSE`.

**Impact:** Well-documented misinformation can slip through if the post wording differs from indexed fact-check titles.

### 2. Misleading `UNVERIFIED` Response

When no records are found, the pipeline returns `is_misinformation: false`. This tells the frontend the post is safe, when the reality is simply "no data available." Users may be misled into trusting unverified posts.

**Impact:** `UNVERIFIED` ≠ true. A third state (`no_data`) is needed.

### 3. Uneven Google API Coverage

Global, high-profile claims (COVID, vaccines, 5G) return rich records. Niche, local, or newly emerged misinformation returns zero results and cannot be verified by this pipeline at all.

### 4. Gemini 503 on Free Tier

During peak hours, Gemini 2.5 Flash returns transient 503 errors. The current pipeline has no retry logic — a single failure aborts the request.

---

## Optimization Roadmap

### A — Parallelize Google API Queries *(highest impact, minimal code change)*

Google API calls currently run serially per claim. Running them concurrently with `asyncio` or `ThreadPoolExecutor` reduces total latency from `1.2s × N` to `~1.2s` regardless of claim count.

Estimated saving: ~2–4s for posts with 3+ claims (total ~4s).

### B — Cache Results Per Post

The same post can be clicked by multiple users. Store `post_id → verdict` in SQLite after the first pipeline run. Cache hits return in <10ms instead of 6.6s.

### C — Use a Lighter Model for Alignment

Alignment is a binary relevance judgment — it does not require Gemini 2.5 Flash. Switching this step to `gemini-2.0-flash-lite` (free tier) reduces alignment latency from ~2.0s to ~0.8s with negligible accuracy loss for a classification task.

### D — Introduce a Three-State Verdict

Replace the current binary `is_misinformation: true/false` with three states:

| State            | Meaning                                     | Frontend display                                         |
| ---------------- | ------------------------------------------- | -------------------------------------------------------- |
| `verified_false` | Pipeline found and confirmed misinformation | Show intervention                                        |
| `verified_true`  | Pipeline found supporting records           | No intervention                                          |
| `no_data`        | No fact-check records found                 | Show "No verification data available — review carefully" |

This prevents `UNVERIFIED` claims from silently passing as safe.
