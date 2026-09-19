import json
import time

import httpx
import pytest

from agenthub import AutoLLMClient, ChatGPTCodexClient, ChatGPTCredentials
from agenthub.chatgpt_codex import refresh_chatgpt_credentials, start_chatgpt_device_authorization


AUTH = ChatGPTCredentials("access-secret", "refresh-secret", "account", time.time() + 3600)


async def credentials():
    return AUTH


@pytest.mark.asyncio
@pytest.mark.parametrize("model", ["subscription-a", "subscription-b"])
async def test_subscription_stream(monkeypatch, model):
    seen = []

    def handle(request):
        seen.append(request)
        assert request.headers["Authorization"] == "Bearer access-secret"
        assert request.headers["ChatGPT-Account-Id"] == "account"
        body = json.loads(request.content)
        assert body["instructions"] == ""
        assert body["store"] is False
        assert "max_output_tokens" not in body
        assert body["include"] == ["reasoning.encrypted_content"]
        events = [
            {"type": "response.output_text.delta", "delta": "OK"},
            {
                "type": "response.completed",
                "response": {
                    "id": "r",
                    "status": "completed",
                    "output": [],
                    "usage": {"input_tokens": 10, "output_tokens": 1, "total_tokens": 11},
                },
            },
        ]
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content="".join(f"data: {json.dumps(e)}\n\n" for e in events),
        )

    original = httpx.AsyncClient

    class MockClient(original):
        def __init__(self, *a, **kw):
            super().__init__(*a, **kw, transport=httpx.MockTransport(handle))

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)
    client = AutoLLMClient(model=model, client_type="chatgpt-codex", chatgpt_credentials=credentials)
    events = [
        event
        async for event in client.streaming_response(
            messages=[{"role": "user", "content_items": [{"type": "text", "text": "hello"}]}], config={"max_tokens": 5}
        )
    ]
    assert any(item.get("text") == "OK" for event in events for item in event.get("content_items", []))
    assert len(seen) == 1


@pytest.mark.asyncio
async def test_device_and_refresh_wire(monkeypatch):
    seen = []

    def handle(request):
        seen.append(request)
        body = json.loads(request.content)
        if request.url.path.endswith("usercode"):
            return httpx.Response(200, json={"device_auth_id": "device", "user_code": "AAAA-BBBB", "interval": "5"})
        assert body["grant_type"] == "refresh_token"
        assert body["refresh_token"] == "refresh-secret"
        return httpx.Response(
            200, json={"access_token": "new-access", "refresh_token": "new-refresh", "expires_in": 3600}
        )

    original = httpx.AsyncClient

    class MockClient(original):
        def __init__(self, *a, **kw):
            super().__init__(*a, **kw, transport=httpx.MockTransport(handle))

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)
    flow = await start_chatgpt_device_authorization()
    assert flow.interval == 5
    assert flow.authorize_url == "https://auth.openai.com/codex/device"
    rotated = await refresh_chatgpt_credentials(AUTH)
    assert rotated.refresh_token == "new-refresh"
    assert rotated.account_id == "account"
    assert len(seen) == 2


def test_destination_and_auth_isolation():
    with pytest.raises(ValueError, match="endpoint"):
        ChatGPTCodexClient("model", base_url="https://example.com", chatgpt_credentials=credentials)
    with pytest.raises(ValueError, match="Connect"):
        AutoLLMClient("model", client_type="chatgpt-codex", api_key="not-subscription-auth")
