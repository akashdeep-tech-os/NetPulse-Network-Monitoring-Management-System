"""End-to-end smoke test: boots the app, seeds, and exercises key endpoints."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

# Fresh database for a reproducible run (seeded again on app startup)
_DB = os.path.join(os.path.dirname(__file__), "netpulse.db")
if os.path.exists(_DB):
    os.remove(_DB)

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

# Enter the context manager so the lifespan runs (create tables + seed)
client.__enter__()


def test_health():
    r = client.get("/api/v1/system/health")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ok"


def test_login():
    r = client.post("/api/v1/auth/login", data={"username": "demo", "password": "Demo@1234"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["username"] == "demo"
    assert body["organization_name"] == "Demo Organization"
    return body


def test_me(bearer):
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {bearer}"})
    assert r.status_code == 200, r.text
    assert r.json()["username"] == "demo"


def test_dashboard(bearer):
    r = client.get("/api/v1/analytics/dashboard", headers={"Authorization": f"Bearer {bearer}"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "kpis" in body and "health_score" in body


def test_create_device(bearer):
    r = client.post(
        "/api/v1/devices",
        json={"name": "Router-1", "ip_address": "127.0.0.1", "device_type": "router"},
        headers={"Authorization": f"Bearer {bearer}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Router-1"
    return r.json()["id"]


def test_list_devices(bearer):
    r = client.get("/api/v1/devices", headers={"Authorization": f"Bearer {bearer}"})
    assert r.status_code == 200, r.text
    assert len(r.json()) >= 1


def test_create_group(bearer):
    r = client.post(
        "/api/v1/devices/groups?name=Core&color=%233b82f6",
        headers={"Authorization": f"Bearer {bearer}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Core"


def test_create_check(bearer, device_id):
    r = client.post(
        f"/api/v1/monitoring/checks?device_id={device_id}",
        json={"name": "ICMP 127.0.0.1", "check_type": "icmp", "host": "127.0.0.1"},
        headers={"Authorization": f"Bearer {bearer}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["check_type"] == "icmp"
    return r.json()["id"]


def test_run_check_now(bearer, check_id):
    r = client.post(
        f"/api/v1/monitoring/checks/{check_id}/run-now",
        headers={"Authorization": f"Bearer {bearer}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] in ("Online", "Offline", "unknown")


def test_ai_insights(bearer):
    r = client.post("/api/v1/ai/insights", headers={"Authorization": f"Bearer {bearer}"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "summary" in body


def test_ai_chat(bearer):
    r = client.post(
        "/api/v1/ai/chat",
        json={"message": "Which devices are offline?"},
        headers={"Authorization": f"Bearer {bearer}"},
    )
    assert r.status_code == 200, r.text
    assert "reply" in r.json()


def test_port_scan(bearer):
    r = client.post(
        "/api/v1/monitoring/port-scan",
        json={"target_ip": "127.0.0.1", "start_port": 80, "end_port": 90},
        headers={"Authorization": f"Bearer {bearer}"},
    )
    assert r.status_code == 200, r.text
    assert "open_ports" in r.json()


def test_reports(bearer):
    r = client.get("/api/v1/reports/uptime?fmt=csv", headers={"Authorization": f"Bearer {bearer}"})
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("text/csv")


def test_api_key_flow(bearer):
    r = client.post(
        "/api/v1/api-keys",
        json={"name": "CI", "scopes": ["devices.view", "monitoring.view"]},
        headers={"Authorization": f"Bearer {bearer}"},
    )
    assert r.status_code == 200, r.text
    plain = r.json()["plain_key"]
    assert plain.startswith("np_")
    r2 = client.get("/api/v1/devices", headers={"X-API-Key": plain})
    assert r2.status_code == 200, r2.text


def test_tenant_isolation(bearer):
    """API key without the right scope must be denied."""
    r = client.post(
        "/api/v1/api-keys",
        json={"name": "ReadOnly", "scopes": ["devices.view"]},
        headers={"Authorization": f"Bearer {bearer}"},
    )
    plain = r.json()["plain_key"]
    r2 = client.post("/api/v1/devices", json={"name": "X", "ip_address": "10.0.0.1"},
                     headers={"X-API-Key": plain})
    assert r2.status_code == 403, r2.text


def test_refresh(bearer, refresh_token):
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]


if __name__ == "__main__":
    login = test_login()
    token = login["access_token"]
    refresh = login["refresh_token"]
    test_health()
    test_me(token)
    test_dashboard(token)
    dev_id = test_create_device(token)
    test_list_devices(token)
    test_create_group(token)
    check_id = test_create_check(token, dev_id)
    test_run_check_now(token, check_id)
    test_ai_insights(token)
    test_ai_chat(token)
    test_port_scan(token)
    test_reports(token)
    test_api_key_flow(token)
    test_tenant_isolation(token)
    test_refresh(token, refresh)
    print("ALL SMOKE TESTS PASSED")
