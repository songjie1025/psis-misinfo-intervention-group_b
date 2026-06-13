"""
intervention.py — Intervention Selection Engine & Risk Score

This module implements the core personalization logic for XCheck.
It decides WHICH intervention to show based on:
  1. BFI-10 Big Five personality scores
  2. Computed risk score (0–1)
  3. Post category

Three intervention types:
  Type 1 — Label:       simple warning badge, minimal friction
  Type 2 — Justification: detailed explanation with source
  Type 3 — Interruption:  full-screen modal, forced pause
"""

# ---------------------------------------------------------------
# Risk Score Calculation
# ---------------------------------------------------------------
# Weights are based on misinformation susceptibility research:
#   - High Neuroticism (N): emotionally reactive → more vulnerable to fear-based content
#   - Low Openness (O): less likely to question unfamiliar claims
#   - Low Conscientiousness (C): less careful verification before sharing
#   - High Agreeableness (A): more trusting of others' claims
#   - Extraversion (E): mixed — more exposure but also more social verification
#
# All inputs are BFI-10 scores in range 2–10.
# Output is a float in range 0–1.

RISK_WEIGHTS = {
    "neuroticism": 0.35,        # strongest predictor
    "openness": -0.25,          # negative: high O = lower risk
    "conscientiousness": -0.15, # negative: high C = lower risk
    "agreeableness": 0.15,      # positive: high A = more trusting
    "extraversion": 0.10,       # slight positive: more exposure
}


def calculate_risk_score(scores: dict) -> float:
    """
    Compute misinformation vulnerability risk from BFI-10 scores.

    Args:
        scores: {"openness": 7, "conscientiousness": 6, ...}  (each 2–10)

    Returns:
        float between 0 and 1 (higher = more vulnerable)
    """
    raw = 0.0
    for trait, weight in RISK_WEIGHTS.items():
        value = scores.get(trait, 5)  # default to midpoint if missing
        if weight < 0:
            # Invert: low trait value → higher risk contribution
            raw += abs(weight) * (10 - value)
        else:
            raw += weight * value

    # Normalize to 0–1. Max possible raw ≈ 8.0
    risk = raw / 8.0
    return round(min(max(risk, 0.0), 1.0), 3)


# ---------------------------------------------------------------
# Intervention Selection
# ---------------------------------------------------------------

def select_intervention(
    bfi_scores: dict,
    risk_score: float,
    post_category: str,
    post_content: str,
    fact_check: str,
) -> dict:
    """
    Choose the appropriate intervention type and generate its content.

    Decision logic:
      risk < 0.35 AND openness >= 7  → Type 1 (Label)
      risk >= 0.65                   → Type 3 (Interruption)
      otherwise                      → Type 2 (Justification)

    Special override: neuroticism >= 8 → never Type 1 (too vulnerable for just a label)
    """
    openness = bfi_scores.get("openness", 5)
    neuroticism = bfi_scores.get("neuroticism", 5)

    # Decision tree
    if risk_score >= 0.65:
        intervention_type = "interruption"
    elif risk_score < 0.35 and openness >= 7 and neuroticism < 8:
        intervention_type = "label"
    else:
        intervention_type = "justification"

    # Build the intervention payload based on type
    if intervention_type == "label":
        return _build_label(post_category, fact_check)
    elif intervention_type == "justification":
        return _build_justification(post_category, post_content, fact_check)
    else:
        return _build_interruption(post_category, fact_check)


# ---------------------------------------------------------------
# Intervention Payload Builders
# ---------------------------------------------------------------

def _build_label(category: str, fact_check: str) -> dict:
    """Type 1: Simple warning badge — minimal friction."""
    category_labels = {
        "health": "⚠️ Health Claim — Verify Before Sharing",
        "politics": "⚠️ Political Claim — Check Facts First",
        "science": "⚠️ Science Claim — Needs Verification",
        "tech": "⚠️ Tech Claim — Fact Check Recommended",
    }
    badge = category_labels.get(category, "⚠️ This Claim Needs Verification")
    return {
        "type": "label",
        "badge_text": badge,
        "action_text": "Why is this flagged?",
        "color": "#ef4444",
        "title": "Flagged Content",
        "body": fact_check[:200] if fact_check else "",
    }


def _build_justification(
    category: str, content: str, fact_check: str
) -> dict:
    """Type 2: Detailed explanation with reasoning and source."""
    explanations = {
        "health": "Many health claims online lack scientific evidence. "
                  "Clinical trials and peer-reviewed studies are the gold standard.",
        "politics": "Political misinformation often uses emotional language "
                    "to bypass critical thinking. Check multiple sources.",
        "science": "Scientific claims require reproducible evidence. "
                   "A single study or anonymous source is not enough.",
        "tech": "Tech rumors spread fast. Wait for official announcements "
                "before believing investment or product claims.",
    }
    explanation = explanations.get(category, explanations["science"])
    return {
        "type": "justification",
        "title": "Why This May Be Misleading",
        "explanation": explanation,
        "source": f"Fact check: {fact_check}",
        "action_text": "I understand",
    }


def _build_interruption(category: str, fact_check: str) -> dict:
    """Type 3: Full-screen modal — forced pause for high-risk users."""
    messages = {
        "health": "This post contains a health claim that has been debunked "
                  "by medical experts. Acting on false health information "
                  "can be dangerous.",
        "politics": "This post contains a political claim that fact-checkers "
                    "have found to be false. Please take a moment to review.",
        "science": "This post makes a scientific claim that is not supported "
                   "by evidence. Scientific consensus matters.",
        "tech": "This post contains a tech-related claim that has been "
                "verified as false by independent sources.",
    }
    body = messages.get(category, messages["science"])
    return {
        "type": "interruption",
        "title": "⚠️ Misinformation Detected",
        "body": f"{body}\n\n{fact_check}",
        "confirm_text": "I understand, continue browsing",
        "cancel_text": "Go back to feed",
    }


# ---------------------------------------------------------------
# Personalized Tips (for Dashboard)
# ---------------------------------------------------------------

def generate_tips(bfi_scores: dict) -> list[str]:
    """Generate personalized media literacy tips based on personality."""
    tips = []
    o = bfi_scores.get("openness", 5)
    n = bfi_scores.get("neuroticism", 5)
    c = bfi_scores.get("conscientiousness", 5)
    a = bfi_scores.get("agreeableness", 5)

    if o <= 5:
        tips.append(
            "Try reading news from sources you disagree with — "
            "it helps build a more complete picture."
        )
    if n >= 7:
        tips.append(
            "When a post makes you feel angry or scared, pause for 10 seconds "
            "before sharing. Emotional content is designed to bypass logic."
        )
    if c <= 5:
        tips.append(
            "Before sharing, ask yourself: 'Do I know this is true?' "
            "A quick web search can prevent spreading misinformation."
        )
    if a >= 7:
        tips.append(
            "Being trusting is a strength — but online, even friends "
            "can accidentally share false information. Verify independently."
        )
    if o >= 7:
        tips.append(
            "Your curiosity is valuable! Use it to dig deeper into claims "
            "rather than accepting them at face value."
        )

    # Always include at least one general tip
    if len(tips) < 2:
        tips.append(
            "Check the source: who wrote this, and why? "
            "Credible sources name their authors and cite evidence."
        )
    if len(tips) < 3:
        tips.append(
            "If a claim sounds too good (or bad) to be true, it probably is. "
            "Extraordinary claims require extraordinary evidence."
        )

    return tips
