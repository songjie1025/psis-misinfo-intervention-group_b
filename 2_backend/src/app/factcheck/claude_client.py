"""Contains the claude client."""

from __future__ import annotations

import requests


class ClaudeClient:
    """Client to send requests to the Claude API."""

    API_URL = "https://api.anthropic.com/v1/messages"
    DEFAULT_MODEL = "claude-sonnet-4-20250514"

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL) -> None:
        """Initialize the client."""
        self.model = model
        self.api_key = api_key

    def ask(self, prompt: str) -> str:
        """Send the prompt to the LLM."""
        response = requests.post(
            self.API_URL,
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": self.model,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        response.raise_for_status()
        return response.json()["content"][0]["text"]
