"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubCopilotClient = void 0;
const openai_1 = __importDefault(require("openai"));
const openai_chat_1 = require("../openai_chat");
const BASE_URL = "https://api.githubcopilot.com";
/** Experimental transport; the caller owns authorization, tools and the agent loop. */
class GitHubCopilotClient extends openai_chat_1.OpenaiChatClient {
    constructor(options) {
        const apiKey = options.apiKey || process.env.GITHUB_COPILOT_API_KEY;
        if (!apiKey)
            throw new Error("Connect a GitHub Copilot account first.");
        const baseUrl = options.baseUrl || BASE_URL;
        if (baseUrl.replace(/\/$/, "") !== BASE_URL) {
            throw new Error("GitHub Copilot requires https://api.githubcopilot.com.");
        }
        super({ ...options, apiKey, baseUrl });
        this._client = new openai_1.default({
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
                if (new URL(String(url)).origin !== BASE_URL)
                    throw new Error("Invalid Copilot endpoint.");
                const headers = new Headers(init?.headers);
                if (typeof init?.body === "string") {
                    const body = JSON.parse(init.body);
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
    async listModels() {
        const ids = [];
        for await (const entry of this._client.models.list({ timeout: 15000 })) {
            const model = entry;
            if (model.supported_endpoints?.includes("/chat/completions") &&
                model.capabilities?.supports?.tool_calls === true)
                ids.push(model.id);
        }
        return ids;
    }
}
exports.GitHubCopilotClient = GitHubCopilotClient;
