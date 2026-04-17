#!/usr/bin/env python3
"""
ShadowLink E2E Chain Diagnostic Script
=======================================
Tests every layer of the request/response chain to find where it breaks.

Chain:
  Frontend(:3000) -> Vite Proxy -> Java Gateway(:8080) -> Python AI(:8000) -> LLM API

Usage:
    cd D:/ShadowLink/ShadowLink
    pip install httpx   (if not already in your shadowlink-ai venv)
    python diagnostic.py

Each test prints PASS/FAIL with details. Read from top to bottom —
the first FAIL is likely the root cause.
"""

import asyncio
import json
import sys
import time
import traceback
from dataclasses import dataclass, field

try:
    import httpx
except ImportError:
    print("ERROR: httpx not installed. Run: pip install httpx")
    print("  Or activate your shadowlink-ai venv which should already have it.")
    sys.exit(1)


# ── Configuration ──
PYTHON_AI_URL = "http://localhost:8000"
JAVA_GATEWAY_URL = "http://localhost:8080"
TIMEOUT = 15.0
SSE_TIMEOUT = 30.0

# Test message for SSE
TEST_SESSION_ID = f"diag-sess-{int(time.time())}"
TEST_MESSAGE = "Hello, say hi back in one sentence."


@dataclass
class TestResult:
    name: str
    passed: bool
    message: str
    details: str = ""
    events: list = field(default_factory=list)

    def __str__(self):
        icon = "\033[92m PASS \033[0m" if self.passed else "\033[91m FAIL \033[0m"
        s = f"[{icon}] {self.name}\n       {self.message}"
        if self.details:
            for line in self.details.split("\n"):
                s += f"\n       | {line}"
        return s


results: list[TestResult] = []


# ═══════════════════════════════════════════════════════════════════════
# Layer 1: Service Connectivity
# ═══════════════════════════════════════════════════════════════════════

async def test_python_ai_health():
    """L1-a: Can we reach the Python AI service at :8000?"""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            # Try multiple endpoints
            for endpoint in ["/docs", "/openapi.json", "/health"]:
                try:
                    r = await c.get(f"{PYTHON_AI_URL}{endpoint}")
                    if r.status_code < 500:
                        return TestResult(
                            "L1-a  Python AI Service (:8000)",
                            True,
                            f"Reachable — {endpoint} returned {r.status_code}",
                        )
                except Exception:
                    continue

            # If all fail, try just connecting
            r = await c.get(f"{PYTHON_AI_URL}/")
            return TestResult(
                "L1-a  Python AI Service (:8000)",
                r.status_code < 500,
                f"Root returned {r.status_code}",
            )
    except httpx.ConnectError:
        return TestResult(
            "L1-a  Python AI Service (:8000)",
            False,
            "Cannot connect! Is the Python service running?",
            "Start it with: cd shadowlink-ai && uvicorn app.main:app --host 0.0.0.0 --port 8000",
        )
    except Exception as e:
        return TestResult("L1-a  Python AI Service (:8000)", False, str(e))


async def test_java_gateway_health():
    """L1-b: Can we reach the Java Gateway at :8080?"""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            for endpoint in ["/actuator/health", "/health", "/doc.html"]:
                try:
                    r = await c.get(f"{JAVA_GATEWAY_URL}{endpoint}")
                    if r.status_code < 500:
                        return TestResult(
                            "L1-b  Java Gateway (:8080)",
                            True,
                            f"Reachable — {endpoint} returned {r.status_code}",
                        )
                except Exception:
                    continue

            r = await c.get(f"{JAVA_GATEWAY_URL}/")
            return TestResult(
                "L1-b  Java Gateway (:8080)",
                True,
                f"Root returned {r.status_code} (may be a redirect or 404, but port is open)",
            )
    except httpx.ConnectError:
        return TestResult(
            "L1-b  Java Gateway (:8080)",
            False,
            "Cannot connect! Is the Java backend running?",
            "Start it with: cd shadowlink-server && mvn spring-boot:run -pl shadowlink-starter",
        )
    except Exception as e:
        return TestResult("L1-b  Java Gateway (:8080)", False, str(e))


# ═══════════════════════════════════════════════════════════════════════
# Layer 2: Session API
# ═══════════════════════════════════════════════════════════════════════

async def test_session_api():
    """L2: Can we create and access sessions via the Java Gateway?"""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            # Test session creation
            r = await c.post(
                f"{JAVA_GATEWAY_URL}/api/sessions",
                json={"modeId": "general", "title": "Diagnostic Test"},
            )
            if r.status_code == 401 or r.status_code == 403:
                return TestResult(
                    "L2    Session API (/api/sessions)",
                    False,
                    f"Auth blocked! Status {r.status_code}",
                    "The /api/sessions/** path is not in the Spring Security whitelist.\n"
                    "Fix: Add \"/api/sessions/**\" to WHITE_LIST in SecurityConfig.java",
                )
            if r.status_code >= 400:
                return TestResult(
                    "L2    Session API (/api/sessions)",
                    False,
                    f"POST /api/sessions returned {r.status_code}",
                    f"Response: {r.text[:500]}",
                )

            body = r.json()
            session_id = None
            if body.get("data") and body["data"].get("sessionId"):
                session_id = body["data"]["sessionId"]

            # Test session listing
            r2 = await c.get(f"{JAVA_GATEWAY_URL}/api/sessions", params={"mode_id": "general"})

            detail = f"Create: {r.status_code}, List: {r2.status_code}"
            if session_id:
                detail += f", Session ID: {session_id}"

            return TestResult(
                "L2    Session API (/api/sessions)",
                r.status_code < 400,
                detail,
            )
    except httpx.ConnectError:
        return TestResult(
            "L2    Session API (/api/sessions)",
            False,
            "Cannot connect to Gateway (skip — see L1-b)",
        )
    except Exception as e:
        return TestResult(
            "L2    Session API (/api/sessions)",
            False,
            f"Exception: {e}",
            traceback.format_exc(),
        )


# ═══════════════════════════════════════════════════════════════════════
# Layer 3: LLM Provider Test
# ═══════════════════════════════════════════════════════════════════════

async def test_llm_provider_via_python():
    """L3-a: Test LLM provider connectivity via Python settings endpoint."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.get(f"{PYTHON_AI_URL}/v1/settings/providers")
            if r.status_code != 200:
                return TestResult(
                    "L3-a  LLM Providers (Python)",
                    False,
                    f"GET /v1/settings/providers returned {r.status_code}",
                    f"Response: {r.text[:500]}",
                )

            body = r.json()
            data_payload = body.get("data", {})
            
            # Handle both list and dict response formats
            providers = []
            if isinstance(data_payload, list):
                providers = data_payload
            elif isinstance(data_payload, dict):
                providers = data_payload.get("providers", [])

            active = [p for p in providers if p.get("is_active")]
            if not active:
                detail = "No active LLM provider configured.\n"
                detail += "Configure one via the Settings page or .env file:\n"
                detail += "  SHADOWLINK_LLM_BASE_URL=https://api.openai.com/v1\n"
                detail += "  SHADOWLINK_LLM_API_KEY=sk-...\n"
                detail += "  SHADOWLINK_LLM_MODEL=gpt-4o-mini"
                return TestResult("L3-a  LLM Providers (Python)", False, "No active provider!", detail)

            p = active[0]
            return TestResult(
                "L3-a  LLM Providers (Python)",
                True,
                f"Active provider: {p.get('name', '?')} | model={p.get('default_model', '?')} | base_url={p.get('base_url', '?')[:60]}",
            )
    except httpx.ConnectError:
        return TestResult("L3-a  LLM Providers (Python)", False, "Cannot connect to Python AI (skip — see L1-a)")
    except Exception as e:
        return TestResult("L3-a  LLM Providers (Python)", False, str(e))


async def test_llm_direct_call():
    """L3-b: Make a minimal LLM call via the Python non-streaming endpoint."""
    try:
        async with httpx.AsyncClient(timeout=SSE_TIMEOUT) as c:
            r = await c.post(
                f"{PYTHON_AI_URL}/v1/agent/chat",
                json={
                    "session_id": TEST_SESSION_ID,
                    "mode_id": "general",
                    "message": "Say exactly: DIAGNOSTIC_OK",
                    "strategy": "direct",
                    "max_iterations": 1,
                    "context": {},
                },
            )
            if r.status_code != 200:
                return TestResult(
                    "L3-b  LLM Direct Call (non-streaming)",
                    False,
                    f"POST /v1/agent/chat returned {r.status_code}",
                    f"Response: {r.text[:800]}",
                )

            body = r.json()
            answer = body.get("data", {}).get("answer", "") if body.get("data") else ""
            if not answer:
                answer = body.get("answer", "")

            return TestResult(
                "L3-b  LLM Direct Call (non-streaming)",
                bool(answer),
                f"Got response ({len(answer)} chars): {answer[:120]}...",
            )
    except httpx.ConnectError:
        return TestResult("L3-b  LLM Direct Call", False, "Cannot connect (skip — see L1-a)")
    except httpx.ReadTimeout:
        return TestResult(
            "L3-b  LLM Direct Call",
            False,
            "Timeout after 30s — LLM API might be unreachable",
            "Check your API key, base URL, and network connectivity to the LLM provider.",
        )
    except Exception as e:
        return TestResult("L3-b  LLM Direct Call", False, str(e), traceback.format_exc())


# ═══════════════════════════════════════════════════════════════════════
# Layer 4: Python SSE Stream (Direct)
# ═══════════════════════════════════════════════════════════════════════

async def test_python_sse_direct():
    """L4: Send an SSE stream request directly to Python AI service."""
    try:
        events_received = []
        token_content = ""

        async with httpx.AsyncClient(timeout=httpx.Timeout(SSE_TIMEOUT, connect=10.0)) as c:
            async with c.stream(
                "POST",
                f"{PYTHON_AI_URL}/v1/agent/stream",
                json={
                    "session_id": TEST_SESSION_ID,
                    "mode_id": "general",
                    "message": TEST_MESSAGE,
                    "strategy": "direct",
                    "max_iterations": 1,
                    "context": {},
                },
                headers={"Accept": "text/event-stream"},
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    return TestResult(
                        "L4    Python SSE Stream (Direct to :8000)",
                        False,
                        f"HTTP {response.status_code}",
                        f"Response: {body.decode()[:500]}",
                    )

                current_event = ""
                current_data = ""

                async for line in response.aiter_lines():
                    line = line.strip()
                    if line.startswith("event:"):
                        current_event = line[6:].strip()
                    elif line.startswith("data:"):
                        current_data += line[5:].strip()
                    elif line == "" and current_data:
                        try:
                            parsed = json.loads(current_data)
                            evt_type = parsed.get("event", current_event)
                            events_received.append(evt_type)

                            if evt_type == "token":
                                token_content += parsed.get("data", {}).get("content", "")
                            elif evt_type == "error":
                                error_msg = parsed.get("data", {}).get("content", "unknown")
                                return TestResult(
                                    "L4    Python SSE Stream (Direct to :8000)",
                                    False,
                                    f"Stream returned ERROR event: {error_msg}",
                                    f"Events before error: {events_received}",
                                )
                        except json.JSONDecodeError as je:
                            events_received.append(f"PARSE_ERROR: {current_data[:100]}")
                        current_event = ""
                        current_data = ""

        has_tokens = "token" in events_received
        has_done = "done" in events_received

        detail = f"Events: {events_received}\n"
        detail += f"Token content ({len(token_content)} chars): {token_content[:150]}"

        return TestResult(
            "L4    Python SSE Stream (Direct to :8000)",
            has_tokens and has_done,
            f"{len(events_received)} events, tokens={'yes' if has_tokens else 'NO'}, done={'yes' if has_done else 'NO'}",
            detail,
        )
    except httpx.ConnectError:
        return TestResult(
            "L4    Python SSE Stream (Direct to :8000)",
            False,
            "Cannot connect (skip — see L1-a)",
        )
    except httpx.ReadTimeout:
        return TestResult(
            "L4    Python SSE Stream (Direct to :8000)",
            False,
            "Timeout — stream didn't complete in 30s",
            f"Events received before timeout: {events_received if 'events_received' in dir() else 'none'}",
        )
    except Exception as e:
        return TestResult(
            "L4    Python SSE Stream (Direct to :8000)",
            False,
            f"Exception: {e}",
            traceback.format_exc(),
        )


# ═══════════════════════════════════════════════════════════════════════
# Layer 5: Java Gateway SSE Proxy
# ═══════════════════════════════════════════════════════════════════════

async def test_gateway_sse_proxy():
    """L5: Send an SSE stream request through the Java Gateway proxy."""
    try:
        events_received = []
        token_content = ""

        async with httpx.AsyncClient(timeout=httpx.Timeout(SSE_TIMEOUT, connect=10.0)) as c:
            async with c.stream(
                "POST",
                f"{JAVA_GATEWAY_URL}/api/ai/agent/stream",
                json={
                    "session_id": TEST_SESSION_ID,
                    "mode_id": "general",
                    "message": TEST_MESSAGE,
                    "strategy": "direct",
                    "max_iterations": 1,
                    "context": {},
                },
                headers={"Accept": "text/event-stream", "Content-Type": "application/json"},
            ) as response:
                if response.status_code == 401 or response.status_code == 403:
                    return TestResult(
                        "L5    Gateway SSE Proxy (:8080 -> :8000)",
                        False,
                        f"Auth blocked! Status {response.status_code}",
                        "The /api/ai/** path should be in the Spring Security whitelist.",
                    )
                if response.status_code != 200:
                    body = await response.aread()
                    return TestResult(
                        "L5    Gateway SSE Proxy (:8080 -> :8000)",
                        False,
                        f"HTTP {response.status_code}",
                        f"Response: {body.decode()[:500]}",
                    )

                current_event = ""
                current_data = ""

                async for line in response.aiter_lines():
                    line = line.strip()
                    if line.startswith("event:"):
                        current_event = line[6:].strip()
                    elif line.startswith("data:"):
                        current_data += line[5:].strip()
                    elif line == "" and current_data:
                        try:
                            parsed = json.loads(current_data)
                            evt_type = current_event or parsed.get("event", "unknown")
                            events_received.append(evt_type)

                            # Gateway forwards JsonNode; structure varies
                            data_payload = parsed.get("data", parsed)
                            if evt_type == "token":
                                content = ""
                                if isinstance(data_payload, dict):
                                    content = data_payload.get("content", "")
                                token_content += content
                            elif evt_type == "error":
                                error_msg = data_payload.get("content", "unknown") if isinstance(data_payload, dict) else str(data_payload)
                                return TestResult(
                                    "L5    Gateway SSE Proxy (:8080 -> :8000)",
                                    False,
                                    f"Stream returned ERROR: {error_msg}",
                                    f"Events before error: {events_received}",
                                )
                        except json.JSONDecodeError:
                            events_received.append(f"PARSE_ERROR: {current_data[:80]}")
                        current_event = ""
                        current_data = ""

        has_tokens = "token" in events_received
        has_done = "done" in events_received

        detail = f"Events: {events_received}\n"
        detail += f"Token content ({len(token_content)} chars): {token_content[:150]}"

        return TestResult(
            "L5    Gateway SSE Proxy (:8080 -> :8000)",
            has_tokens and has_done,
            f"{len(events_received)} events, tokens={'yes' if has_tokens else 'NO'}, done={'yes' if has_done else 'NO'}",
            detail,
        )
    except httpx.ConnectError:
        return TestResult(
            "L5    Gateway SSE Proxy (:8080 -> :8000)",
            False,
            "Cannot connect to Gateway (skip — see L1-b)",
        )
    except httpx.ReadTimeout:
        return TestResult(
            "L5    Gateway SSE Proxy (:8080 -> :8000)",
            False,
            "Timeout — Gateway didn't complete SSE stream in 30s",
        )
    except Exception as e:
        return TestResult(
            "L5    Gateway SSE Proxy (:8080 -> :8000)",
            False,
            f"Exception: {e}",
            traceback.format_exc(),
        )


# ═══════════════════════════════════════════════════════════════════════
# Layer 6: Frontend SSE Format Validation
# ═══════════════════════════════════════════════════════════════════════

async def test_sse_event_format():
    """L6: Validate SSE event format matches what the frontend expects."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(SSE_TIMEOUT, connect=10.0)) as c:
            async with c.stream(
                "POST",
                f"{PYTHON_AI_URL}/v1/agent/stream",
                json={
                    "session_id": TEST_SESSION_ID,
                    "mode_id": "general",
                    "message": "Say: test",
                    "strategy": "direct",
                    "max_iterations": 1,
                    "context": {},
                },
                headers={"Accept": "text/event-stream"},
            ) as response:
                if response.status_code != 200:
                    return TestResult("L6    SSE Event Format", False, f"HTTP {response.status_code}")

                raw_lines = []
                first_data_event = None
                current_event = ""
                current_data = ""

                async for line in response.aiter_lines():
                    raw_lines.append(line)
                    stripped = line.strip()

                    if stripped.startswith("event:"):
                        current_event = stripped[6:].strip()
                    elif stripped.startswith("data:"):
                        current_data += stripped[5:].strip()
                    elif stripped == "" and current_data:
                        if first_data_event is None:
                            first_data_event = {"event": current_event, "raw_data": current_data}
                            try:
                                parsed = json.loads(current_data)
                                first_data_event["parsed"] = parsed
                            except Exception:
                                first_data_event["parse_error"] = True
                        current_event = ""
                        current_data = ""

                    if len(raw_lines) > 50:
                        break

        if not first_data_event:
            return TestResult("L6    SSE Event Format", False, "No SSE events received")

        issues = []
        parsed = first_data_event.get("parsed")
        if first_data_event.get("parse_error"):
            issues.append(f"data field is not valid JSON: {first_data_event['raw_data'][:100]}")
        elif parsed:
            # Frontend expects: { event: "xxx", data: { content: "..." }, session_id: "..." }
            if "event" not in parsed:
                issues.append("Missing 'event' field in data JSON")
            if "data" not in parsed:
                issues.append("Missing 'data' field in data JSON")
            if "session_id" not in parsed:
                issues.append("Missing 'session_id' field (minor)")

        detail = f"First event type: {first_data_event.get('event', '?')}\n"
        detail += f"First data (raw): {first_data_event.get('raw_data', '')[:200]}\n"
        detail += f"Total raw lines sampled: {len(raw_lines)}"

        if issues:
            detail += f"\nIssues: {'; '.join(issues)}"

        return TestResult(
            "L6    SSE Event Format",
            len(issues) == 0,
            "Format OK — matches frontend expectations" if not issues else f"{len(issues)} format issue(s)",
            detail,
        )
    except httpx.ConnectError:
        return TestResult("L6    SSE Event Format", False, "Cannot connect (skip — see L1-a)")
    except Exception as e:
        return TestResult("L6    SSE Event Format", False, str(e), traceback.format_exc())


# ═══════════════════════════════════════════════════════════════════════
# Layer 7: Code-Level Checks
# ═══════════════════════════════════════════════════════════════════════

def test_code_issues():
    """L7: Static checks for known code issues."""
    issues = []
    fixes = []

    # Check agent_router.py for import time
    try:
        with open("shadowlink-ai/app/api/v1/agent_router.py", "r", encoding="utf-8") as f:
            content = f.read()
        if "import time" not in content and "time.time()" in content:
            issues.append("agent_router.py: uses time.time() but does NOT import time -> NameError!")
            fixes.append("Add 'import time' to the imports in agent_router.py")
        elif "import time" in content:
            pass  # Fixed
    except FileNotFoundError:
        issues.append("agent_router.py not found at expected path")

    # Check SecurityConfig for session whitelist
    try:
        with open(
            "shadowlink-server/shadowlink-auth/src/main/java/com/shadowlink/auth/config/SecurityConfig.java",
            "r",
            encoding="utf-8",
        ) as f:
            sec_content = f.read()
        if "/api/sessions/**" not in sec_content:
            issues.append("SecurityConfig.java: /api/sessions/** is NOT in the whitelist")
            fixes.append('Add "/api/sessions/**" to WHITE_LIST in SecurityConfig.java')
    except FileNotFoundError:
        pass

    # Check vite proxy config
    try:
        with open("shadowlink-web/vite.config.ts", "r", encoding="utf-8") as f:
            vite_content = f.read()
        if "'/api/ai'" not in vite_content and '"/api/ai"' not in vite_content:
            issues.append("vite.config.ts: missing /api/ai proxy rule")
    except FileNotFoundError:
        pass

    if issues:
        detail = "Issues found:\n" + "\n".join(f"  - {i}" for i in issues)
        if fixes:
            detail += "\n\nFixes needed:\n" + "\n".join(f"  - {f}" for f in fixes)
        return TestResult(
            "L7    Code-Level Checks",
            False,
            f"{len(issues)} issue(s) found in source code",
            detail,
        )
    return TestResult("L7    Code-Level Checks", True, "No known code issues detected")


# ═══════════════════════════════════════════════════════════════════════
# Runner
# ═══════════════════════════════════════════════════════════════════════

async def run_all():
    print()
    print("=" * 70)
    print("  ShadowLink E2E Chain Diagnostic")
    print("=" * 70)
    print()

    # L7: Code checks (synchronous, runs first)
    print("Running code-level checks...")
    results.append(test_code_issues())
    print(results[-1])
    print()

    # L1: Service connectivity (parallel)
    print("Testing service connectivity...")
    l1a, l1b = await asyncio.gather(
        test_python_ai_health(),
        test_java_gateway_health(),
    )
    results.extend([l1a, l1b])
    print(l1a)
    print(l1b)
    print()

    # L2: Session API
    if l1b.passed:
        print("Testing session API...")
        l2 = await test_session_api()
        results.append(l2)
        print(l2)
        print()
    else:
        print("  Skipping L2 (Java Gateway unreachable)\n")

    # L3: LLM Provider
    if l1a.passed:
        print("Testing LLM provider...")
        l3a = await test_llm_provider_via_python()
        results.append(l3a)
        print(l3a)

        if l3a.passed:
            print("Testing LLM direct call (this may take a few seconds)...")
            l3b = await test_llm_direct_call()
            results.append(l3b)
            print(l3b)
        print()

    # L4: Python SSE direct
    if l1a.passed:
        print("Testing Python SSE stream (direct)...")
        l4 = await test_python_sse_direct()
        results.append(l4)
        print(l4)
        print()

    # L5: Gateway SSE proxy
    if l1a.passed and l1b.passed:
        print("Testing Gateway SSE proxy (full chain)...")
        l5 = await test_gateway_sse_proxy()
        results.append(l5)
        print(l5)
        print()

    # L6: SSE format validation
    if l1a.passed:
        print("Validating SSE event format...")
        l6 = await test_sse_event_format()
        results.append(l6)
        print(l6)
        print()

    # ── Summary ──
    print("=" * 70)
    print("  SUMMARY")
    print("=" * 70)

    passed = sum(1 for r in results if r.passed)
    failed = sum(1 for r in results if not r.passed)

    for r in results:
        icon = "\033[92m OK \033[0m" if r.passed else "\033[91m !! \033[0m"
        print(f"  [{icon}] {r.name}")

    print()
    print(f"  Passed: {passed}  |  Failed: {failed}  |  Total: {len(results)}")
    print()

    if failed > 0:
        print("  DIAGNOSIS — First failure likely indicates root cause:")
        for r in results:
            if not r.passed:
                print(f"  >>> {r.name}: {r.message}")
                if r.details:
                    for line in r.details.split("\n")[:5]:
                        print(f"      {line}")
                break
    else:
        print("  All checks passed! If the frontend still doesn't show responses,")
        print("  check the browser developer console (F12 -> Console/Network tab).")
        print("  Look for:")
        print("    - Failed fetch requests to /api/ai/agent/stream")
        print("    - CORS errors")
        print("    - JavaScript errors in SSE parsing")

    print()


if __name__ == "__main__":
    asyncio.run(run_all())
