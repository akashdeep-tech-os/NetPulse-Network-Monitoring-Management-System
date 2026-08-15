"""AI models: insights, chat messages, usage counters."""
from datetime import datetime

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from core.security import utcnow
from database.base import Base


class AIInsight(Base):
    __tablename__ = "ai_insights"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    insight_type = Column(String, nullable=False)
    # summary | anomaly | root_cause | recommendation | prediction
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    severity = Column(String, default="info")
    confidence = Column(Integer, nullable=True)  # 0-100
    evidence = Column(JSON, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)

    __table_args__ = (
        Index("ix_ai_insights_org_type", "organization_id", "insight_type"),
        Index("ix_ai_insights_org_ts", "organization_id", "created_at"),
    )


class AIChatMessage(Base):
    __tablename__ = "ai_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String, nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    tool_name = Column(String, nullable=True)
    evidence = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)


class AIUsage(Base):
    __tablename__ = "ai_usage"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    period = Column(String, nullable=False, index=True)  # YYYY-MM
    requests = Column(Integer, default=0)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("ix_ai_usage_org_period", "organization_id", "period", unique=True),
    )
