"""Individual monitoring check implementations: ICMP, TCP, HTTP/HTTPS, DNS."""
import platform
import socket
import ssl
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

ICMP = "icmp"
TCP = "tcp"
HTTP = "http"
DNS = "dns"

CHECK_TYPES = {ICMP, TCP, HTTP, DNS}


@dataclass
class CheckOutcome:
    status: str  # Online | Offline
    latency: Optional[float] = None
    packet_loss: Optional[float] = None
    response_code: Optional[int] = None
    error_message: Optional[str] = None
    details: Optional[dict] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── ICMP ──────────────────────────────────────────────────────
def icmp_check(host: str, timeout_seconds: int = 5, count: int = 3) -> CheckOutcome:
    """Ping with latency + packet loss. Uses subprocess ping (works on Windows/Linux)."""
    try:
        if platform.system().lower() == "windows":
            cmd = ["ping", "-n", str(count), "-w", str(timeout_seconds * 1000), host]
        else:
            cmd = ["ping", "-c", str(count), "-W", str(max(1, timeout_seconds)), host]
        start = time.monotonic()
        output = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds * 2 + 5,
        )
        elapsed = (time.monotonic() - start) * 1000
        text = output.stdout.lower()
        if "unreachable" in text or "timed out" in text or "timeout" in text:
            return CheckOutcome(status="Offline", error_message="No reply (destination unreachable/timeout)", details={"elapsed_ms": round(elapsed, 1)})

        latencies: list[float] = []
        import re

        for m in re.finditer(r"time[=<]\s*([\d.]+)\s*ms", text):
            latencies.append(float(m.group(1)))
        if not latencies and "ttl=" not in text:
            return CheckOutcome(status="Offline", error_message="Host did not respond", details={"elapsed_ms": round(elapsed, 1)})
        if not latencies:
            latencies = [elapsed]

        loss = 0.0
        loss_m = re.search(r"\((\d+)\%\)\s*loss", text) or re.search(r"loss\s*=?\s*(\d+)\s*%\s*", text)
        if loss_m:
            loss = float(loss_m.group(1))
        return CheckOutcome(
            status="Online",
            latency=round(sum(latencies) / len(latencies), 2),
            packet_loss=loss,
            details={"samples": len(latencies), "elapsed_ms": round(elapsed, 1), "checked_at": _now_iso()},
        )
    except subprocess.TimeoutExpired:
        return CheckOutcome(status="Offline", error_message="Ping timed out")
    except Exception as e:
        return CheckOutcome(status="Offline", error_message=str(e)[:200])


# ─── TCP ───────────────────────────────────────────────────────
def tcp_check(host: str, port: int, timeout_seconds: int = 5) -> CheckOutcome:
    try:
        start = time.monotonic()
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout_seconds)
            result = sock.connect_ex((host, port))
            latency = (time.monotonic() - start) * 1000
        if result == 0:
            return CheckOutcome(status="Online", latency=round(latency, 2), details={"port": port})
        return CheckOutcome(status="Offline", error_message=f"Connection refused (port {port})", details={"port": port})
    except socket.timeout:
        return CheckOutcome(status="Offline", error_message=f"Connection timed out (port {port})", details={"port": port})
    except Exception as e:
        return CheckOutcome(status="Offline", error_message=str(e)[:200], details={"port": port})


# ─── HTTP / HTTPS ──────────────────────────────────────────────
def http_check(url: str, expected_status_code: Optional[int] = None, timeout_seconds: int = 5) -> CheckOutcome:
    import urllib.request

    expected = expected_status_code or 200
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NetPulse-Monitor/1.0"})
        start = time.monotonic()
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            latency = (time.monotonic() - start) * 1000
            code = resp.status
        if code == expected:
            return CheckOutcome(status="Online", latency=round(latency, 2), response_code=code)
        return CheckOutcome(
            status="Offline",
            latency=round(latency, 2),
            response_code=code,
            error_message=f"Unexpected HTTP status {code} (expected {expected})",
        )
    except urllib.error.HTTPError as e:
        if e.code == expected:
            return CheckOutcome(status="Online", response_code=e.code, error_message=None)
        return CheckOutcome(status="Offline", response_code=e.code, error_message=f"HTTP error {e.code}")
    except Exception as e:
        return CheckOutcome(status="Offline", error_message=str(e)[:200])


def ssl_expiry_days(host: str, port: int = 443, timeout_seconds: int = 5) -> Optional[int]:
    """Returns days until SSL certificate expiry, or None on failure."""
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=timeout_seconds) as sock:
            with context.wrap_socket(sock, server_hostname=host) as tls:
                cert = tls.getpeercert()
        not_after = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
        return (not_after - datetime.utcnow()).days
    except Exception:
        return None


# ─── DNS ───────────────────────────────────────────────────────
def dns_check(host: str, timeout_seconds: int = 5) -> CheckOutcome:
    try:
        start = time.monotonic()
        import dns.resolver

        answers = dns.resolver.resolve(host, "A", lifetime=timeout_seconds)
        latency = (time.monotonic() - start) * 1000
        if answers:
            return CheckOutcome(status="Online", latency=round(latency, 2), details={"ip": str(answers[0])})
        return CheckOutcome(status="Offline", error_message="No A records found")
    except ImportError:
        try:
            start = time.monotonic()
            info = socket.getaddrinfo(host, None)
            latency = (time.monotonic() - start) * 1000
            if info:
                return CheckOutcome(status="Online", latency=round(latency, 2), details={"ip": info[0][4][0]})
            return CheckOutcome(status="Offline", error_message="Resolution returned no addresses")
        except socket.gaierror as e:
            return CheckOutcome(status="Offline", error_message=f"DNS resolution failed: {e}")
        except Exception as e:
            return CheckOutcome(status="Offline", error_message=str(e)[:200])
    except Exception as e:
        return CheckOutcome(status="Offline", error_message=str(e)[:200])


def run_check(check_type: str, host: str, port: Optional[int] = None, url: Optional[str] = None,
              expected_status_code: Optional[int] = None, timeout_seconds: int = 5) -> CheckOutcome:
    """Dispatches to the correct checker. The monitoring engine calls this for every check."""
    check_type = check_type.lower()
    if check_type == ICMP:
        return icmp_check(host, timeout_seconds)
    if check_type == TCP:
        if not port:
            return CheckOutcome(status="Offline", error_message="TCP check requires a port")
        return tcp_check(host, port, timeout_seconds)
    if check_type == HTTP:
        if not url:
            if host:
                url = f"http://{host}"
            else:
                return CheckOutcome(status="Offline", error_message="HTTP check requires a URL")
        return http_check(url, expected_status_code, timeout_seconds)
    if check_type == DNS:
        return dns_check(host, timeout_seconds)
    return CheckOutcome(status="Offline", error_message=f"Unknown check type: {check_type}")
