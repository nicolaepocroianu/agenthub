import asyncio
import json
import time
from email.utils import formatdate
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from openai import AsyncOpenAI

from agenthub import (
    AutoLLMClient,
    ChatGPTAuthorizationError,
    ChatGPTCodexClient,
    ChatGPTCredentials,
    ResponseStreamError,
    UnsupportedOperationError,
)
from agenthub.chatgpt_codex import (
    ChatGPTDeviceAuthorization,
    poll_chatgpt_device_authorization,
    refresh_chatgpt_credentials,
    start_chatgpt_device_authorization,
)


AUTH = ChatGPTCredentials("access-secret", "refresh-secret", "account", time.time() + 3600)


async def credentials():
    return AUTH


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "retry_after", "initial", "expected"),
    [
        (429, None, 5, 10),
        (429, "30", 5, 30),
        (429, formatdate(1767225600 + 45, usegmt=True), 5, 45),
        (429, formatdate(1767225600 - 45, usegmt=True), 5, 10),
        (429, "invalid", 5, 10),
        (429, "-1", 5, 10),
        (429, "999999", 5, 900),
        (429, None, 40, 60),
        (429, None, 120, 120),
        (400, None, 5, 10),
        (400, "30", 5, 30),
        (400, None, 120, 120),
        (200, None, 5, 10),
        (403, None, 5, 5),
        (404, None, 5, 5),
    ],
)
async def test_device_poll_backoff(monkeypatch, status, retry_after, initial, expected):
    monkeypatch.setattr(time, "time", lambda: 1767225600)
    flow = ChatGPTDeviceAuthorization("device", "ABCD-EFGH", initial, time.time() + 900)
    request = AsyncMock(
        return_value=httpx.Response(
            status, json={"error": "slow_down"}, headers={"Retry-After": retry_after} if retry_after else {}
        )
    )
    monkeypatch.setattr("agenthub.chatgpt_codex.auth._request", request)
    assert await poll_chatgpt_device_authorization(flow) is None
    assert flow.interval == expected
    request.assert_awaited_once()


@pytest.mark.asyncio
async def test_device_poll_backoff_caps_and_preserves_flow(monkeypatch):
    monkeypatch.setattr(time, "time", lambda: 1767225600)
    flow = ChatGPTDeviceAuthorization("device", "ABCD-EFGH", 5, time.time() + 900)
    request = AsyncMock(return_value=httpx.Response(429))
    monkeypatch.setattr("agenthub.chatgpt_codex.auth._request", request)
    for _ in range(8):
        assert await poll_chatgpt_device_authorization(flow) is None
    assert flow.interval == 60
    request.side_effect = [
        httpx.Response(404),
        httpx.Response(200, json={"authorization_code": "code", "code_verifier": "verifier"}),
        httpx.Response(200),
    ]
    monkeypatch.setattr("agenthub.chatgpt_codex.auth._credentials", lambda response: AUTH)
    assert await poll_chatgpt_device_authorization(flow) is None
    assert flow.interval == 60
    assert await poll_chatgpt_device_authorization(flow) is AUTH


@pytest.mark.asyncio
@pytest.mark.parametrize("during", [False, True])
async def test_device_poll_expiry(monkeypatch, during):
    current = [1767225600]
    monkeypatch.setattr(time, "time", lambda: current[0])
    flow = ChatGPTDeviceAuthorization("device", "ABCD-EFGH", 5, current[0] + (1 if during else 0))

    async def respond(*args):
        current[0] += 1
        return httpx.Response(429)

    request = AsyncMock(side_effect=respond)
    monkeypatch.setattr("agenthub.chatgpt_codex.auth._request", request)
    with pytest.raises(ValueError, match="expired"):
        await poll_chatgpt_device_authorization(flow)
    assert request.await_count == (1 if during else 0)
    assert flow.interval == 5


@pytest.mark.asyncio
async def test_device_poll_cancellation(monkeypatch):
    flow = ChatGPTDeviceAuthorization("device", "ABCD-EFGH", 5, time.time() + 900)
    request = AsyncMock(side_effect=asyncio.CancelledError())
    monkeypatch.setattr("agenthub.chatgpt_codex.auth._request", request)
    with pytest.raises(asyncio.CancelledError):
        await poll_chatgpt_device_authorization(flow)
    assert flow.interval == 5


@pytest.mark.asyncio
@pytest.mark.parametrize("routed", [False, True])
@pytest.mark.parametrize("exceptional", [False, True])
async def test_subscription_owns_one_pool_and_closes_it(monkeypatch, routed, exceptional):
    pools = []
    sdks = []
    original = httpx.AsyncClient

    class MockClient(original):
        def __init__(self, *args, **kwargs):
            super().__init__(
                *args,
                **kwargs,
                transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"models": []})),
            )
            pools.append(self)

    def sdk(**kwargs):
        result = AsyncOpenAI(**kwargs)
        sdks.append(result)
        return result

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)
    monkeypatch.setattr("agenthub.chatgpt_codex.client.AsyncOpenAI", sdk)
    monkeypatch.setattr("agenthub.openai_responses.client.AsyncOpenAI", sdk)
    client = (
        AutoLLMClient("subscription-a", client_type="chatgpt-codex", chatgpt_credentials=credentials)
        if routed
        else ChatGPTCodexClient("subscription-a", chatgpt_credentials=credentials)
    )
    assert len(sdks) == len(pools) == 1
    error = ValueError("caller failed")
    try:
        async with client as entered:
            assert entered is client
            assert await client.list_models() == []
            assert not pools[0].is_closed
            if exceptional:
                raise error
    except ValueError as caught:
        assert exceptional and caught is error
    assert pools[0].is_closed
    assert sdks[0].is_closed()
    await client.aclose()


@pytest.mark.asyncio
async def test_routed_cleanup_delegates_and_rejects_unsupported_clients():
    client = object.__new__(AutoLLMClient)
    closer = AsyncMock()
    client._client = SimpleNamespace(aclose=closer)
    await client.aclose()
    closer.assert_awaited_once()
    client._client = SimpleNamespace()
    with pytest.raises(UnsupportedOperationError, match="cleanup"):
        await client.aclose()
    with pytest.raises(UnsupportedOperationError, match="cleanup"):
        async with client:
            pytest.fail("unsupported cleanup must fail before entering")


@pytest.mark.asyncio
@pytest.mark.parametrize("client_type", ["chatgpt-codex", "openai-responses"])
@pytest.mark.parametrize(
    ("code", "message", "partial"),
    [
        ("context_length_exceeded", "Your input exceeds the context window.", False),
        ("rate_limit_exceeded", "Please retry later.", True),
        (None, None, False),
    ],
)
async def test_response_stream_failure(monkeypatch, client_type, code, message, partial):
    events = [{"type": "response.output_text.delta", "delta": "partial"}] if partial else []
    events.append(
        {
            "type": "response.failed",
            "response": {
                "status": "failed",
                "error": {"code": code, "message": message} if code else None,
                "output": [{"text": "private-output"}],
            },
        }
    )

    def handle(request):
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content="".join(f"data: {json.dumps(event, ensure_ascii=False)}\n\n" for event in events),
        )

    original = httpx.AsyncClient

    class MockClient(original):
        def __init__(self, *a, **kw):
            super().__init__(*a, **kw, transport=httpx.MockTransport(handle))

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)
    monkeypatch.setattr(
        "agenthub.openai_responses.client.AsyncOpenAI",
        lambda **kwargs: AsyncOpenAI(**kwargs, http_client=MockClient()),
    )
    client = AutoLLMClient(
        model="subscription-a", client_type=client_type, api_key="test-key", chatgpt_credentials=credentials
    )
    seen = []
    with pytest.raises(ResponseStreamError) as caught:
        async for event in client.streaming_response(
            messages=[{"role": "user", "content_items": [{"type": "text", "text": "hello"}]}], config={}
        ):
            seen.append(event)
    assert caught.value.code == code
    assert str(caught.value) == (message or "The Responses stream failed.")
    assert not hasattr(caught.value, "response")
    assert "private-output" not in str(caught.value)
    assert not any(event.get("finish_reason") for event in seen)
    assert len(seen) == (1 if partial else 0)


@pytest.mark.asyncio
@pytest.mark.parametrize("cancelled", [False, True])
async def test_interrupted_refresh_body(monkeypatch, cancelled):
    class BrokenBody(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'{"access_token":'
            if cancelled:
                raise asyncio.CancelledError()
            raise httpx.ReadError("refresh-secret")

    def handle(request):
        return httpx.Response(200, stream=BrokenBody())

    original = httpx.AsyncClient

    class MockClient(original):
        def __init__(self, *a, **kw):
            super().__init__(*a, **kw, transport=httpx.MockTransport(handle))

    monkeypatch.setattr(httpx, "AsyncClient", MockClient)
    with pytest.raises(asyncio.CancelledError if cancelled else ValueError) as caught:
        await refresh_chatgpt_credentials(AUTH)
    assert not isinstance(caught.value, ChatGPTAuthorizationError)
    assert not hasattr(caught.value, "status_code")
    assert "refresh-secret" not in str(caught.value)


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
