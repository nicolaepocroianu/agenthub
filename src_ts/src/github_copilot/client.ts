import OpenAI from "openai";
import { OpenaiChatClient } from "../openai_chat";
import { OpenaiResponsesClient } from "../openai_responses";
import { UniConfig, UniMessage, UniEvent } from "../types";

const BASE_URL = "https://api.githubcopilot.com";
type Options = ConstructorParameters<typeof OpenaiChatClient>[0];
type Message = { role?: string; type?: string; content?: string | { type?: string }[] };
type Protocol = "chat" | "responses";

class CopilotResponsesClient extends OpenaiResponsesClient {
  constructor(options: Options, client: OpenAI) {
    super(options);
    this._client = client;
  }
}

/** Experimental transport; the caller owns authorization, tools and the agent loop. */
export class GitHubCopilotClient extends OpenaiChatClient {
  private readonly responses: CopilotResponsesClient;
  private readonly protocols = new Map<string, Protocol>();
  private protocol?: Protocol;
  constructor(options: Options) {
    const apiKey = options.apiKey || process.env.GITHUB_COPILOT_API_KEY;
    if (!apiKey) throw new Error("Connect a GitHub Copilot account first.");
    const baseUrl = options.baseUrl || BASE_URL;
    if (baseUrl.replace(/\/$/, "") !== BASE_URL) {
      throw new Error("GitHub Copilot requires https://api.githubcopilot.com.");
    }
    super({ ...options, apiKey, baseUrl });
    this._client = new OpenAI({
      apiKey,
      baseURL: BASE_URL,
      maxRetries: 0,
      defaultHeaders: {
        ...options.defaultHeaders,
        "User-Agent": "PenguinHarness",
        "X-GitHub-Api-Version": "2026-07-01",
        "Copilot-Integration-Id": "agentic-workflows",
        "Openai-Intent": "conversation-edits",
      },
      fetch: async (url, init) => {
        if (new URL(String(url)).origin !== BASE_URL) throw new Error("Invalid Copilot endpoint.");
        const headers = new Headers(init?.headers);
        if (typeof init?.body === "string") {
          const body = JSON.parse(init.body) as { messages?: Message[]; input?: Message[] };
          const messages = body.messages || (Array.isArray(body.input) ? body.input : []);
          const last = messages[messages.length - 1];
          // Image-only synthetic user messages can carry a preceding tool result.
          const toolImage = last?.role === "user" && Array.isArray(last.content) &&
            last.content.every((part) => part.type === "image_url" || part.type === "input_image") &&
            (messages[messages.length - 2]?.role === "tool" ||
             messages[messages.length - 2]?.type === "function_call_output");
          headers.set("X-Initiator", last?.role === "user" && !toolImage ? "user" : "agent");
          if (messages.some((message) => Array.isArray(message.content) &&
            message.content.some((part) => part.type === "image_url" || part.type === "input_image"))) {
            headers.set("Copilot-Vision-Request", "true");
          }
        }
        return fetch(url, { ...init, headers, redirect: "error" });
      },
    });
    this.responses = new CopilotResponsesClient({ ...options, apiKey, baseUrl }, this._client);
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const ids: string[] = [];
    this.protocols.clear();
    for await (const entry of this._client.models.list({ timeout: 15_000, signal })) {
      const model = entry as typeof entry & {
        supported_endpoints?: string[];
        capabilities?: { type?: string; supports?: { tool_calls?: boolean } };
        policy?: { state?: string };
      };
      // Older catalogs omit endpoint metadata. Treat explicitly chat-capable
      // entries as candidates, while honoring any advertised endpoint restrictions.
      const chat = model.supported_endpoints === undefined
        ? model.capabilities?.type === "chat"
        : Array.isArray(model.supported_endpoints) &&
          model.supported_endpoints.includes("/chat/completions");
      const responses = Array.isArray(model.supported_endpoints) &&
        model.supported_endpoints.includes("/responses");
      if ((chat || responses) && model.capabilities?.supports?.tool_calls === true &&
          model.policy?.state !== "disabled") {
        ids.push(model.id);
        this.protocols.set(model.id, responses ? "responses" : "chat");
      }
    }
    return ids;
  }

  async *_streamingResponseInternal(options: {
    messages: UniMessage[];
    config: UniConfig;
    signal?: AbortSignal;
  }): AsyncGenerator<UniEvent> {
    // Pin the wire protocol for this client so a catalog refresh cannot change
    // how an existing conversation's reasoning and tool history are replayed.
    if (!this.protocol) {
      if (!this.protocols.has(this._model)) await this.listModels(options.signal);
      const protocol = this.protocols.get(this._model);
      if (!protocol) throw new Error("This Copilot model does not advertise a supported tool-capable endpoint.");
      this.protocol = protocol;
    }
    if (this.protocol === "responses") {
      yield* this.responses._streamingResponseInternal(options);
    } else {
      yield* super._streamingResponseInternal(options);
    }
  }
}
