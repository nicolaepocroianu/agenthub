import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  AutoLLMClient,
  ChatGPTCodexClient,
  ChatGPTAuthorizationError,
  ResponseStreamError,
  startChatGPTDeviceAuthorization,
  pollChatGPTDeviceAuthorization,
  refreshChatGPTCredentials,
  UniEvent,
} from "../src";

const auth = {
  accessToken: "access-secret",
  refreshToken: "refresh-secret",
  accountId: "account-private",
  expiresAt: Date.now() + 3600000,
};
const jwt = (payload: object) =>
  `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.x`;
afterEach(() => {
  jest.restoreAllMocks();
});

describe("experimental ChatGPT transport", () => {
  describe("device polling backoff", () => {
    const now = Date.UTC(2026, 0, 1);
    const makeFlow = () => ({
      deviceAuthId: "device",
      userCode: "ABCD-EFGH",
      intervalMs: 5000,
      expiresAt: now + 900_000,
      authorizeUrl: "https://auth.openai.com/codex/device",
    });

    test.each([
      [429, undefined, 5, 10],
      [429, "30", 5, 30],
      [429, new Date(now + 45_000).toUTCString(), 5, 45],
      [429, new Date(now - 45_000).toUTCString(), 5, 10],
      [429, "invalid", 5, 10],
      [429, "-1", 5, 10],
      [429, "999999", 5, 900],
      [429, undefined, 40, 60],
      [429, undefined, 120, 120],
      [400, undefined, 5, 10],
      [400, "30", 5, 30],
      [400, undefined, 120, 120],
      [200, undefined, 5, 10],
      [403, undefined, 5, 5],
      [404, undefined, 5, 5],
    ] as const)(
      "keeps %s pending (Retry-After %s, interval %s → %s seconds)",
      async (status, retryAfter, initial, expected) => {
        jest.spyOn(Date, "now").mockReturnValue(now);
        const flow = { ...makeFlow(), intervalMs: initial * 1000 };
        const fetcher = jest.spyOn(globalThis, "fetch").mockResolvedValue(
          Response.json(
            { error: "slow_down" },
            {
              status,
              headers: retryAfter ? { "Retry-After": retryAfter } : {},
            },
          ),
        );
        expect(await pollChatGPTDeviceAuthorization(flow)).toBeNull();
        expect(flow.intervalMs).toBe(expected * 1000);
        expect(fetcher).toHaveBeenCalledTimes(1);
      },
    );

    test("discards throttled response bodies before returning pending", async () => {
      jest.spyOn(Date, "now").mockReturnValue(now);
      const response = new Response("discarded", { status: 429 });
      const cancel = jest.spyOn(response.body!, "cancel");
      jest.spyOn(globalThis, "fetch").mockResolvedValue(response);
      expect(await pollChatGPTDeviceAuthorization(makeFlow())).toBeNull();
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    test("caps repeated fallback backoff and can complete after throttling", async () => {
      jest.spyOn(Date, "now").mockReturnValue(now);
      const flow = makeFlow();
      const fetcher = jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(async () => new Response(null, { status: 429 }));
      for (let i = 0; i < 8; i++)
        expect(await pollChatGPTDeviceAuthorization(flow)).toBeNull();
      expect(flow.intervalMs).toBe(60_000);
      fetcher
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(
          Response.json({
            authorization_code: "code",
            code_verifier: "verifier",
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 3600,
            id_token: jwt({
              "https://api.openai.com/auth": { chatgpt_account_id: "account" },
            }),
          }),
        );
      expect(await pollChatGPTDeviceAuthorization(flow)).toBeNull();
      expect(flow.intervalMs).toBe(60_000);
      await expect(pollChatGPTDeviceAuthorization(flow)).resolves.toMatchObject(
        { accountId: "account" },
      );
    });

    test.each([false, true])(
      "rejects expiry before or during polling (during=%s)",
      async (during) => {
        let current = now;
        jest.spyOn(Date, "now").mockImplementation(() => current);
        const flow = { ...makeFlow(), expiresAt: during ? now + 1000 : now };
        const fetcher = jest
          .spyOn(globalThis, "fetch")
          .mockImplementation(async () => {
            current += 1000;
            return new Response(null, { status: 429 });
          });
        await expect(pollChatGPTDeviceAuthorization(flow)).rejects.toThrow(
          "expired",
        );
        expect(fetcher).toHaveBeenCalledTimes(during ? 1 : 0);
        expect(flow.intervalMs).toBe(5000);
      },
    );

    test("preserves cancellation when a throttled response arrives", async () => {
      jest.spyOn(Date, "now").mockReturnValue(now);
      const abort = new AbortController();
      const reason = new Error("cancelled");
      const flow = makeFlow();
      jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
        abort.abort(reason);
        return new Response(null, { status: 429 });
      });
      await expect(
        pollChatGPTDeviceAuthorization(flow, abort.signal),
      ).rejects.toBe(reason);
      expect(flow.intervalMs).toBe(5000);
    });
  });

  test.each(["AbortError", "TimeoutError", "TypeError"])(
    "does not invalidate credentials on a body read %s",
    async (name) => {
      const error = Object.assign(new Error("refresh-secret"), { name });
      jest.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"access_token":'));
              controller.error(error);
            },
          }),
        ),
      );
      const result = refreshChatGPTCredentials(auth);
      await expect(result).rejects.not.toBeInstanceOf(
        ChatGPTAuthorizationError,
      );
      await expect(result).rejects.not.toHaveProperty("status");
      await expect(result).rejects.not.toThrow("refresh-secret");
      await expect(result).rejects.toHaveProperty(
        "name",
        name === "TypeError" ? "Error" : name,
      );
    },
  );

  test("preserves caller cancellation after refresh headers arrive", async () => {
    const abort = new AbortController();
    const reason = new Error("cancelled by caller");
    jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const response = new Response(
        new ReadableStream({
          pull(controller) {
            abort.abort(reason);
            controller.error(new DOMException("aborted", "AbortError"));
          },
        }),
      );
      return response;
    });
    await expect(refreshChatGPTCredentials(auth, abort.signal)).rejects.toBe(
      reason,
    );
  });

  test.each([
    '{"access_token":"refresh-secret",',
    JSON.stringify({ access_token: "refresh-secret", expires_in: -1 }),
  ])("keeps malformed credentials sanitized", async (body) => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body));
    await expect(refreshChatGPTCredentials(auth)).rejects.toMatchObject({
      name: "ChatGPTAuthorizationError",
      status: 401,
      message:
        "ChatGPT returned invalid credentials. Reconnect your subscription.",
    });
  });

  describe.each(["chatgpt-codex", "openai-responses"])(
    "%s failures",
    (clientType) => {
      test.each([
        [
          "context_length_exceeded",
          "Your input exceeds the context window.",
          false,
        ],
        ["rate_limit_exceeded", "Please retry later.", true],
        [null, null, false],
      ])(
        "preserves %s errors: %s (partial output: %s)",
        async (code, message, partial) => {
          const events = [
            ...(partial
              ? [{ type: "response.output_text.delta", delta: "partial" }]
              : []),
            {
              type: "response.failed",
              response: {
                status: "failed",
                error: code ? { code, message } : null,
                output: [{ text: "private-output" }],
              },
            },
          ];
          jest.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
              events
                .map((event) => `data: ${JSON.stringify(event)}\n\n`)
                .join(""),
              {
                headers: { "Content-Type": "text/event-stream" },
              },
            ),
          );
          const client = new AutoLLMClient({
            model: "subscription-a",
            clientType,
            apiKey: "test-key",
            chatgptCredentials: async () => auth,
          });
          const seen: UniEvent[] = [];
          const collect = async () => {
            for await (const event of client.streamingResponse({
              messages: [
                {
                  role: "user",
                  content_items: [{ type: "text", text: "hello" }],
                },
              ],
              config: {},
            }))
              seen.push(event);
          };
          const result = collect();
          await expect(result).rejects.toBeInstanceOf(ResponseStreamError);
          await expect(result).rejects.toMatchObject({
            code,
            message: message ?? "The Responses stream failed.",
          });
          await expect(result).rejects.not.toHaveProperty("response");
          await expect(result).rejects.not.toThrow("private-output");
          expect(seen.some((event) => event.finish_reason)).toBe(false);
          expect(seen.length).toBe(partial ? 1 : 0);
        },
      );
    },
  );

  test("keeps transient refresh failures distinguishable from revoked authorization", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response("private-provider-body", { status: 503 }),
      );
    await expect(refreshChatGPTCredentials(auth)).rejects.toMatchObject({
      status: 503,
      message: "ChatGPT authorization is temporarily unavailable. Try again.",
    });
  });
  test.each(["subscription-a", "subscription-b"])(
    "streams output-item tool calls with empty final output for %s",
    async (model) => {
      const events = [
        {
          type: "response.output_item.added",
          item: {
            id: "fc",
            type: "function_call",
            call_id: "call",
            name: "ping",
          },
        },
        {
          type: "response.function_call_arguments.delta",
          item_id: "fc",
          delta: "{}",
        },
        { type: "response.function_call_arguments.done", item_id: "fc" },
        {
          type: "response.output_item.done",
          item: {
            id: "fc",
            type: "function_call",
            call_id: "call",
            name: "ping",
            arguments: "{}",
          },
        },
        {
          type: "response.completed",
          response: {
            status: "completed",
            output: [],
            usage: { input_tokens: 10, output_tokens: 4 },
          },
        },
      ];
      const fetcher = jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (url, init) => {
          expect(String(url)).toBe(
            "https://chatgpt.com/backend-api/codex/responses",
          );
          const headers = new Headers(init?.headers);
          expect(headers.get("Authorization")).toBe("Bearer access-secret");
          expect(headers.get("ChatGPT-Account-Id")).toBe("account-private");
          expect(init?.redirect).toBe("error");
          const body = JSON.parse(String(init?.body));
          expect(body).toMatchObject({
            stream: true,
            store: false,
            instructions: "",
            include: ["reasoning.encrypted_content"],
          });
          expect(body.max_output_tokens).toBeUndefined();
          return new Response(
            events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""),
            { headers: { "Content-Type": "text/event-stream" } },
          );
        });
      const client = new AutoLLMClient({
        model,
        clientType: "chatgpt-codex",
        chatgptCredentials: async () => auth,
      });
      const result: UniEvent[] = [];
      for await (const e of client.streamingResponse({
        messages: [
          { role: "user", content_items: [{ type: "text", text: "ping" }] },
        ],
        config: { max_tokens: 10 },
      }))
        result.push(e);
      expect(
        result
          .flatMap((e) => e.content_items ?? [])
          .filter((item) => item.type === "tool_call"),
      ).toEqual([
        {
          type: "tool_call",
          name: "ping",
          arguments: {},
          tool_call_id: "call",
        },
      ]);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  test("imports visible catalog entries and rejects alternate credential destinations", async () => {
    const fetcher = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({
          models: [
            {
              slug: "visible",
              visibility: "list",
              context_window: 200000,
              input_modalities: ["text", "image"],
            },
            { slug: "internal", visibility: "hide" },
          ],
        }),
      );
    const client = new ChatGPTCodexClient({
      model: "",
      chatgptCredentials: async () => auth,
    });
    expect(await client.listModelDetails()).toEqual([
      {
        id: "visible",
        displayName: "visible",
        contextWindow: 200000,
        vision: true,
      },
    ]);
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "/models?client_version=0.154.0",
    );
    const routed = new AutoLLMClient({
      model: "",
      clientType: "chatgpt-codex",
      chatgptCredentials: async () => auth,
    });
    expect(await routed.listModels()).toEqual(["visible"]);
    expect(
      () =>
        new ChatGPTCodexClient({
          model: "",
          baseUrl: "https://example.com",
          chatgptCredentials: async () => auth,
        }),
    ).toThrow("endpoint");
    expect(
      () =>
        new AutoLLMClient({
          model: "",
          clientType: "chatgpt-codex",
          apiKey: "not-a-subscription",
        }),
    ).toThrow("Connect");
    expect(() =>
      client.transformUniConfigToModelConfig({ temperature: 0 }),
    ).toThrow("temperature");
  });

  test("polls pending device authorization and exchanges with PKCE, then rotates refresh credentials", async () => {
    const fetcher = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          device_auth_id: "device-secret",
          user_code: "ABCD-EFGH",
          interval: "5",
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 403 }))
      .mockResolvedValueOnce(
        Response.json({
          authorization_code: "code-secret",
          code_verifier: "verifier-secret",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          access_token: jwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
          refresh_token: "initial",
          id_token: jwt({
            "https://api.openai.com/auth": { chatgpt_account_id: "account" },
          }),
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          access_token: "rotated-access",
          refresh_token: "rotated-refresh",
          expires_in: 3600,
        }),
      );
    const flow = await startChatGPTDeviceAuthorization();
    expect(flow.intervalMs).toBe(5000);
    expect(await pollChatGPTDeviceAuthorization(flow)).toBeNull();
    const original = (await pollChatGPTDeviceAuthorization(flow))!;
    expect(original.accountId).toBe("account");
    const rotated = await refreshChatGPTCredentials(original);
    expect(rotated).toMatchObject({
      accountId: "account",
      accessToken: "rotated-access",
      refreshToken: "rotated-refresh",
    });
    expect(fetcher.mock.calls[3][1]?.body).toBeInstanceOf(URLSearchParams);
    expect(JSON.parse(String(fetcher.mock.calls[4][1]?.body))).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "initial",
    });
    expect(
      fetcher.mock.calls.every(([, init]) => init?.redirect === "error"),
    ).toBe(true);
  });

  test.each([400, 401, 403])(
    "does not expose refresh error bodies (%s)",
    async (status) => {
      jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          Response.json({ error: "refresh-secret" }, { status }),
        );
      await expect(refreshChatGPTCredentials(auth)).rejects.toThrow(
        "Reconnect",
      );
    },
  );
});
