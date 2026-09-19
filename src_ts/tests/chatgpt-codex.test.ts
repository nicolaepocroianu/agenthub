import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  AutoLLMClient,
  ChatGPTCodexClient,
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
