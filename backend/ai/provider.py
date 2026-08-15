"""AI provider abstraction. The app never depends on one vendor.

rule_based  — deterministic generator from real metrics (default, no API key needed)
openai      — OpenAI-compatible chat completions API
custom      — any OpenAI-compatible endpoint (AI_BASE_URL)
"""
import json
import logging
import urllib.request
from abc import ABC, abstractmethod
from typing import Optional

from core.config import settings

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """Interface every provider implements."""

    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str, max_tokens: int = 800) -> Optional[str]:
        """Returns generated text or None on failure."""


class RuleBasedProvider(AIProvider):
    """No-LLM fallback. Produces clear, factual responses only."""

    def generate(self, system_prompt: str, user_prompt: str, max_tokens: int = 800) -> Optional[str]:
        return None  # never used directly; the service composes answers itself


class OpenAICompatProvider(AIProvider):
    """Speaks the OpenAI chat-completions protocol (works with OpenAI, Azure, Ollama, LM Studio)."""

    def __init__(self, api_key: str, model: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.model = model or "gpt-4o-mini"
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")

    def generate(self, system_prompt: str, user_prompt: str, max_tokens: int = 800) -> Optional[str]:
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.2,
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"AI provider call failed: {e}")
            return None


def get_provider() -> AIProvider:
    if settings.AI_PROVIDER in ("openai", "custom") and settings.AI_API_KEY:
        return OpenAICompatProvider(settings.AI_API_KEY, settings.AI_MODEL, settings.AI_BASE_URL)
    return RuleBasedProvider()


def is_llm_available() -> bool:
    return settings.AI_PROVIDER in ("openai", "custom") and bool(settings.AI_API_KEY)
