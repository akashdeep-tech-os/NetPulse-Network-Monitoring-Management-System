"""Prompt templates for LLM providers. Structured metrics are always computed in advance."""
from typing import Any

SYSTEM_GUARDRAILS = """
You are NetPulse AI, a network monitoring assistant embedded in a multi-tenant SaaS product.

STRICT RULES:
1. NEVER invent metrics, device names, IPs, outages or numbers. Only use the data provided.
2. NEVER claim a device is offline without evidence in the data.
3. NEVER expose or reference data outside the provided JSON.
4. NEVER write or suggest SQL. You can only interpret data.
5. Distinguish observed facts from interpretation. Use "probable"/"may indicate" for conclusions.
6. If the data is insufficient, say so explicitly.
7. Keep answers concise (under 200 words) and structured with bullet points.
"""


def summary_prompt(metrics: dict[str, Any]) -> tuple[str, str]:
    system = SYSTEM_GUARDRAILS + "\nYou produce the network summary in 3-4 sentences."
    user = (
        "Summarize the network health of this organization using ONLY this data.\n"
        f"DATA: {metrics}\n"
    )
    return system, user


def root_cause_prompt(metrics: dict[str, Any], anomalies: list[dict]) -> tuple[str, str]:
    system = SYSTEM_GUARDRAILS + "\nYou explain probable root causes with evidence and confidence."
    user = (
        "Analyze why the network may be unhealthy. Use ONLY this data. For each conclusion add a confidence percentage.\n"
        f"METRICS: {metrics}\n"
        f"DETECTED_ANOMALIES: {anomalies}\n"
    )
    return system, user


def chat_prompt(question: str, tool_data: dict[str, Any], tool_name: str) -> tuple[str, str]:
    system = SYSTEM_GUARDRAILS + "\nYou answer the user's question using the retrieved tool data."
    user = (
        f"USER QUESTION: {question}\n"
        f"RETRIEVED DATA (from tool {tool_name}): {tool_data}\n"
        "Answer the question from this data. If the data does not answer it, say so.\n"
    )
    return system, user
