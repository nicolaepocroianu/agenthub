from typing import Any

import httpx
from openai import AsyncOpenAI

from ..abort_signal import AbortSignal, run_with_abort
from ..errors import UnsupportedParameterError
from ..openai_responses import OpenaiResponsesClient
from ..types import UniConfig
from .auth import BASE_URL, ChatGPTCredentialProvider


class ChatGPTCodexClient(OpenaiResponsesClient):
    """Experimental model transport, with no agent loop or tool execution."""

    def __init__(
        self,
        model: str,
        api_key: str | None = None,
        base_url: str | None = None,
        default_headers: dict[str, str] | None = None,
        chatgpt_credentials: ChatGPTCredentialProvider | None = None,
    ):
        if base_url and base_url.rstrip("/") != BASE_URL:
            raise ValueError("ChatGPT subscriptions require the Codex backend endpoint.")
        if chatgpt_credentials is None:
            raise ValueError("Connect a ChatGPT subscription first.")
        super().__init__(model, api_key="subscription", base_url=BASE_URL)

        async def authorize(request: httpx.Request) -> None:
            if str(request.url.copy_with(path="/", query=None)) != "https://chatgpt.com/" or request.url.path not in (
                "/backend-api/codex/responses",
                "/backend-api/codex/models",
            ):
                raise ValueError("Invalid ChatGPT subscription endpoint.")
            auth = await chatgpt_credentials()
            request.headers["Authorization"] = f"Bearer {auth.access_token}"
            request.headers["ChatGPT-Account-Id"] = auth.account_id
            request.headers["User-Agent"] = "PenguinHarness-Experimental-Transport/0.1"
            request.headers["originator"] = "penguin_harness"
            if request.url.path.endswith("/models"):
                request.url = request.url.copy_set_param("client_version", "0.154.0")

        self._client = AsyncOpenAI(
            api_key="subscription",
            base_url=BASE_URL,
            max_retries=0,
            http_client=httpx.AsyncClient(follow_redirects=False, event_hooks={"request": [authorize]}),
        )

    def transform_uni_config_to_model_config(self, config: UniConfig) -> dict[str, Any]:
        if config.get("temperature") is not None:
            raise UnsupportedParameterError(
                client="ChatGPTCodexClient",
                parameter="temperature",
                message="ChatGPT subscriptions do not support temperature.",
            )
        result = super().transform_uni_config_to_model_config(config)
        # The backend chooses its output limit; this cap cannot be enforced by the transport.
        result.pop("max_output_tokens", None)
        result.setdefault("instructions", "")
        result["include"] = ["reasoning.encrypted_content"]
        return result

    async def list_model_details(self, signal: AbortSignal | None = None) -> list[dict[str, Any]]:
        if signal:
            signal.throw_if_aborted()
        request = self._client.get("/models", cast_to=dict, options={"timeout": 15})
        response = await run_with_abort(request, signal) if signal else await request
        if not isinstance(response.get("models"), list):
            raise ValueError("ChatGPT returned an invalid model catalog.")
        return [
            {
                "id": m["slug"],
                "display_name": m.get("display_name", m["slug"]),
                "context_window": m.get("context_window"),
                "vision": "image" in m.get("input_modalities", []),
            }
            for m in response["models"]
            if m.get("visibility") == "list" and isinstance(m.get("slug"), str) and m["slug"]
        ]

    async def list_models(self, signal: AbortSignal | None = None) -> list[str]:
        return [m["id"] for m in await self.list_model_details(signal)]
