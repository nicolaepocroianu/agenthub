import OpenAI from "openai";
import { OpenaiResponsesClient } from "../openai_responses";
import { UniConfig } from "../types";
import { UnsupportedParameterError } from "../errors";
import { CHATGPT_CODEX_BASE_URL, ChatGPTCredentialProvider } from "./auth";

export interface ChatGPTModel {
  id: string;
  displayName: string;
  contextWindow?: number;
  vision: boolean;
}

/** Undocumented subscription endpoint; Penguin/other callers keep their own agent loop. */
export class ChatGPTCodexClient extends OpenaiResponsesClient {
  constructor(
    options: ConstructorParameters<typeof OpenaiResponsesClient>[0] & {
      chatgptCredentials?: ChatGPTCredentialProvider;
    },
  ) {
    if (
      options.baseUrl &&
      options.baseUrl.replace(/\/$/, "") !== CHATGPT_CODEX_BASE_URL
    )
      throw new Error(
        "ChatGPT subscriptions require the Codex backend endpoint.",
      );
    if (!options.chatgptCredentials)
      throw new Error("Connect a ChatGPT subscription first.");
    super({
      ...options,
      apiKey: "subscription",
      baseUrl: CHATGPT_CODEX_BASE_URL,
    });
    const getCredentials = options.chatgptCredentials;
    this._client = new OpenAI({
      apiKey: "subscription",
      baseURL: CHATGPT_CODEX_BASE_URL,
      maxRetries: 0,
      fetch: async (url, init) => {
        const endpoint = new URL(String(url));
        if (
          endpoint.origin !== "https://chatgpt.com" ||
          ![
            "/backend-api/codex/responses",
            "/backend-api/codex/models",
          ].includes(endpoint.pathname)
        )
          throw new Error("Invalid ChatGPT subscription endpoint.");
        const auth = await getCredentials(init?.signal ?? undefined);
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${auth.accessToken}`);
        headers.set("ChatGPT-Account-Id", auth.accountId);
        headers.set("User-Agent", "PenguinHarness-Experimental-Transport/0.1");
        headers.set("originator", "penguin_harness");
        if (endpoint.pathname.endsWith("/models"))
          endpoint.searchParams.set("client_version", "0.154.0");
        return fetch(endpoint, { ...init, headers, redirect: "error" });
      },
    });
  }

  transformUniConfigToModelConfig(
    config: UniConfig,
  ): ReturnType<OpenaiResponsesClient["transformUniConfigToModelConfig"]> {
    if (config.temperature !== undefined)
      throw new UnsupportedParameterError({
        client: "ChatGPTCodexClient",
        parameter: "temperature",
        message: "ChatGPT subscriptions do not support temperature.",
      });
    const result = super.transformUniConfigToModelConfig(config);
    // The Codex backend chooses the output limit; the harness must not present its cap as enforced.
    delete result.max_output_tokens;
    result.instructions ??= "";
    result.include = ["reasoning.encrypted_content"];
    return result;
  }

  async listModelDetails(signal?: AbortSignal): Promise<ChatGPTModel[]> {
    const response = await this._client.get<{
      models: Record<string, unknown>[];
    }>("/models", { signal, timeout: 15_000 });
    if (!Array.isArray(response.models))
      throw new Error("ChatGPT returned an invalid model catalog.");
    return response.models
      .filter(
        (m) =>
          m.visibility === "list" &&
          typeof m.slug === "string" &&
          m.slug.length > 0,
      )
      .map((m) => ({
        id: m.slug as string,
        displayName:
          typeof m.display_name === "string"
            ? m.display_name
            : (m.slug as string),
        ...(typeof m.context_window === "number" && m.context_window > 0
          ? { contextWindow: m.context_window }
          : {}),
        vision:
          Array.isArray(m.input_modalities) &&
          m.input_modalities.includes("image"),
      }));
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    return (await this.listModelDetails(signal)).map((m) => m.id);
  }
}
