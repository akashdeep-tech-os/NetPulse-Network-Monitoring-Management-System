"""AI endpoints: insights, assistant chat, root cause, dashboard AI, usage."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ai import service as ai_service
from ai import usage as ai_usage
from core.dependencies import AuthContext, get_auth_context, get_db, require_permission
from models import Organization
from schemas import ChatRequest, ChatResponse, Message
from tenants.service import get_org_plan, get_organization

router = APIRouter(prefix="/ai", tags=["ai"])

ai_perm = require_permission("ai.view")


def _org(db: Session, auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return get_organization(db, auth.org_id)


@router.post("/dashboard")
def ai_dashboard(auth=Depends(ai_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    plan = get_org_plan(db, org)
    if not plan.ai_features_enabled:
        raise HTTPException(status_code=403, detail="AI features not included in your plan")
    ai_usage.enforce_quota(db, org.id, plan.ai_requests_per_month)
    data = ai_service.build_dashboard_ai(db, org.id)
    ai_usage.record_request(db, org.id)
    return data


@router.post("/insights")
def ai_insights(auth=Depends(ai_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    plan = get_org_plan(db, org)
    if not plan.ai_features_enabled:
        raise HTTPException(status_code=403, detail="AI features not included in your plan")
    ai_usage.enforce_quota(db, org.id, plan.ai_requests_per_month)
    summary = ai_service.generate_network_summary(db, org.id)
    root_cause = ai_service.explain_root_cause(db, org.id)
    ai_usage.record_request(db, org.id)
    return {"summary": summary, "root_cause": root_cause}


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, auth=Depends(ai_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    plan = get_org_plan(db, org)
    if not plan.ai_features_enabled:
        raise HTTPException(status_code=403, detail="AI features not included in your plan")
    ai_usage.enforce_quota(db, org.id, plan.ai_requests_per_month)
    if auth.user is None:
        raise HTTPException(status_code=403, detail="Chat requires a user session")
    answer = ai_service.answer_question(db, org.id, body.message, auth.user.id)
    ai_usage.record_request(db, org.id)
    return ChatResponse(**{k: v for k, v in answer.items() if k in ("reply", "tool_name", "evidence", "confidence")})


@router.get("/history")
def chat_history(auth=Depends(ai_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    if auth.user is None:
        raise HTTPException(status_code=403, detail="Chat history requires a user session")
    messages = ai_service.list_chat_history(db, org.id, auth.user.id, limit=50)
    return [
        {"role": m.role, "content": m.content, "tool_name": m.tool_name, "created_at": m.created_at}
        for m in messages
    ]


@router.get("/usage")
def ai_usage_stats(auth=Depends(ai_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    plan = get_org_plan(db, org)
    used = ai_usage.get_monthly_usage(db, org.id)
    return {"used": used, "limit": plan.ai_requests_per_month,
            "enabled": plan.ai_features_enabled}


@router.delete("/history", response_model=Message)
def clear_history(auth=Depends(ai_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    if auth.user is None:
        raise HTTPException(status_code=403, detail="Chat history requires a user session")
    from models import AIChatMessage

    db.query(AIChatMessage).filter(
        AIChatMessage.organization_id == org.id,
        AIChatMessage.user_id == auth.user.id,
    ).delete()
    db.commit()
    return Message(message="Chat history cleared")
