"""Experimental subscription authorization; the caller owns storage and refresh serialization."""

import base64
import json
import math
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

import httpx


BASE_URL = "https://chatgpt.com/backend-api/codex"
ISSUER = "https://auth.openai.com"
CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"


class ChatGPTAuthorizationError(ValueError):
    code = "authentication_error"
    status_code = 401


@dataclass(frozen=True)
class ChatGPTCredentials:
    access_token: str
    refresh_token: str
    account_id: str
    expires_at: float


ChatGPTCredentialProvider = Callable[[], Awaitable[ChatGPTCredentials]]


@dataclass(frozen=True)
class ChatGPTDeviceAuthorization:
    device_auth_id: str
    user_code: str
    interval: float
    expires_at: float
    authorize_url: str = f"{ISSUER}/codex/device"


async def _request(path: str, body: dict[str, str], *, form: bool = False) -> httpx.Response:
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            if form:
                return await client.post(f"{ISSUER}{path}", data=body)
            return await client.post(
                f"{ISSUER}{path}",
                content=json.dumps(body, ensure_ascii=False),
                headers={"Content-Type": "application/json"},
            )
    except httpx.HTTPError:
        raise ValueError("ChatGPT authorization could not be reached. Try again.") from None


def _claims(token: str) -> dict[str, Any]:
    part = token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))


def _credentials(response: httpx.Response, previous: ChatGPTCredentials | None = None) -> ChatGPTCredentials:
    if not response.is_success and response.status_code not in (400, 401, 403):
        error = ValueError("ChatGPT authorization is temporarily unavailable. Try again.")
        error.status_code = response.status_code
        raise error
    if not response.is_success:
        raise ChatGPTAuthorizationError("ChatGPT authorization was rejected. Reconnect your subscription.")
    try:
        body = response.json()
        access = body["access_token"]
        refresh = body.get("refresh_token") or (previous.refresh_token if previous else None)
        account = previous.account_id if previous else None
        if body.get("id_token"):
            account = _claims(body["id_token"])["https://api.openai.com/auth"]["chatgpt_account_id"]
        expires = time.time() + float(body["expires_in"]) if "expires_in" in body else float(_claims(access)["exp"])
        if (
            not all(isinstance(v, str) and v for v in (access, refresh, account))
            or not math.isfinite(expires)
            or expires <= time.time()
            or (previous and account != previous.account_id)
        ):
            raise ValueError()
        return ChatGPTCredentials(access, refresh, account, expires)
    except (ValueError, TypeError, KeyError, IndexError):
        raise ChatGPTAuthorizationError("ChatGPT returned invalid credentials. Reconnect your subscription.") from None


async def start_chatgpt_device_authorization() -> ChatGPTDeviceAuthorization:
    response = await _request("/api/accounts/deviceauth/usercode", {"client_id": CLIENT_ID})
    if not response.is_success:
        raise ValueError("ChatGPT device authorization is unavailable. Try again.")
    body = response.json()
    code = body.get("user_code", body.get("usercode"))
    interval = float(body.get("interval", 5))
    device_id = body.get("device_auth_id")
    if (
        not isinstance(device_id, str)
        or not device_id
        or not isinstance(code, str)
        or not code
        or not math.isfinite(interval)
        or interval < 0
    ):
        raise ValueError("ChatGPT returned an invalid device authorization.")
    return ChatGPTDeviceAuthorization(device_id, code, max(5, interval), time.time() + 900)


async def poll_chatgpt_device_authorization(flow: ChatGPTDeviceAuthorization) -> ChatGPTCredentials | None:
    if time.time() >= flow.expires_at:
        raise ValueError("ChatGPT device authorization expired. Start again.")
    response = await _request(
        "/api/accounts/deviceauth/token", {"device_auth_id": flow.device_auth_id, "user_code": flow.user_code}
    )
    if response.status_code in (403, 404):
        return None
    if not response.is_success:
        raise ValueError("ChatGPT device authorization failed. Start again.")
    body = response.json()
    if not all(isinstance(body.get(k), str) and body[k] for k in ("authorization_code", "code_verifier")):
        raise ValueError("ChatGPT returned an invalid authorization response.")
    return _credentials(
        await _request(
            "/oauth/token",
            {
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "code": body["authorization_code"],
                "code_verifier": body["code_verifier"],
                "redirect_uri": f"{ISSUER}/deviceauth/callback",
            },
            form=True,
        )
    )


async def refresh_chatgpt_credentials(previous: ChatGPTCredentials) -> ChatGPTCredentials:
    return _credentials(
        await _request(
            "/oauth/token",
            {
                "grant_type": "refresh_token",
                "client_id": CLIENT_ID,
                "refresh_token": previous.refresh_token,
            },
        ),
        previous,
    )
