import OpenAI from "openai";
import { OpenaiChatClient } from "../openai_chat";

const BASE_URL = "https://api.githubcopilot.com";
type Options = ConstructorParameters<typeof OpenaiChatClient>[0];
type Message = { role?: string; content?: string | { type?: string }[] };

/** Experimental transport; the caller owns authorization, tools and the agent loop. */
export class GitHubCopilotClient extends OpenaiChatClient {
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
        "X-GitHub-Api-Version": "2026-06-01",
        "Openai-Intent": "conversation-edits",
      },
      fetch: async (url, init) => {
        if (new URL(String(url)).origin !== BASE_URL) throw new Error("Invalid Copilot endpoint.");
        const headers = new Headers(init?.headers);
        if (typeof init?.body === "string") {
          const body = JSON.parse(init.body) as { messages?: Message[] };
          const messages = body.messages || [];
          const last = messages[messages.length - 1];
          // Image-only synthetic user messages can carry a preceding tool result.
          const toolImage = last?.role === "user" && Array.isArray(last.content) &&
            last.content.every((part) => part.type === "image_url") &&
            messages.slice(0, -1).some((message) => message.role === "tool");
          headers.set("X-Initiator", last?.role === "user" && !toolImage ? "user" : "agent");
          if (messages.some((message) => Array.isArray(message.content) &&
            message.content.some((part) => part.type === "image_url"))) {
            headers.set("Copilot-Vision-Request", "true");
          }
        }
        return fetch(url, { ...init, headers, redirect: "error" });
      },
    });
  }

  async listModels(): Promise<string[]> {
    const ids: string[] = [];
    for await (const entry of this._client.models.list({ timeout: 15_000 })) {
      const model = entry as typeof entry & {
        supported_endpoints?: string[];
        capabilities?: { supports?: { tool_calls?: boolean } };
      };
      if (model.supported_endpoints?.includes("/chat/completions") &&
          model.capabilities?.supports?.tool_calls === true) ids.push(model.id);
    }
    return ids;
  }
}
