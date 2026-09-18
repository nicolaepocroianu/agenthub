"use strict";
// Copyright 2025 Prism Shadow. and/or its affiliates
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoLLMClient = void 0;
const baseClient_1 = require("./baseClient");
const client_1 = require("./github_copilot/client");
const gemini3_8_1 = require("./gemini3_8");
const claude5_1 = require("./claude5");
const gpt6_1 = require("./gpt6");
const glm5_3_1 = require("./glm5_3");
const kimi_k3_1 = require("./kimi_k3");
const openai_chat_1 = require("./openai_chat");
const openai_responses_1 = require("./openai_responses");
const ant_messages_1 = require("./ant_messages");
const openai_embedding_1 = require("./openai_embedding");
const deepseek_v4_1 = require("./deepseek_v4");
const minimax_m3_1 = require("./minimax_m3");
const openai_chat_vllm_adapter_1 = require("./openai_chat_vllm_adapter");
// The generic protocol clients are named explicitly rather than deduced from a model id.
const PROTOCOL_CLIENT_TYPES = [
    "github-copilot",
    "openai-chat",
    "openai-chat-vllm-adapter",
    "openai-responses",
    "ant-messages",
    "openai-embedding",
];
/**
 * Auto-routing LLM client that dispatches to appropriate model-specific client.
 *
 * This client is stateful - it knows the model name at initialization and maintains
 * conversation history for that specific model.
 */
class AutoLLMClient extends baseClient_1.LLMClient {
    /**
     * Initialize AutoLLMClient with a specific model.
     *
     * @param options - Configuration object with model, apiKey, baseUrl, and clientType
     */
    constructor(options) {
        super();
        this._clientType = (options.clientType ||
            process.env.CLIENT_TYPE ||
            options.model).toLowerCase();
        this._client = this._createClientForModel(options.model, options.apiKey, options.baseUrl, this._clientType, options.defaultHeaders);
    }
    /**
     * Create the appropriate client for the given model.
     *
     * @param model - Model identifier
     * @param apiKey - API key to be passed to the client implementation (unused until clients are implemented)
     * @param baseUrl - Base URL to be passed to the client implementation (unused until clients are implemented)
     * @param clientType - Optional client type override
     * @returns Instance of the appropriate client
     * @throws Error when the requested client is not yet implemented
     */
    _clientClassForModel(clientType) {
        if (clientType === "github-copilot")
            return client_1.GitHubCopilotClient;
        // every Gemini generation shares the unified client ("gemini-3" also matches the
        // gemini-3.8/gemini-3.7/gemini-3.6/gemini-3.5-flash-lite client types)
        if (clientType.includes("gemini-3") ||
            clientType.includes("gemini-embedding")) {
            return gemini3_8_1.Gemini3_8Client;
        }
        else if (clientType.includes("claude") &&
            (clientType.includes("4-6") ||
                clientType.includes("4-7") ||
                clientType.includes("4-8") ||
                clientType.includes("-5"))) {
            // the whole Claude 4.6+ series shares the unified client
            return claude5_1.Claude5Client;
        }
        else if (clientType.includes("gpt-5.4") ||
            clientType.includes("gpt-5.5") ||
            clientType.includes("gpt-5.6") ||
            clientType.includes("gpt-6")) {
            return gpt6_1.GPT6Client;
        }
        else if (clientType.includes("glm-5")) {
            // the whole GLM series shares the unified client
            return glm5_3_1.GLM5_3Client;
        }
        else if (clientType.includes("kimi-k3") ||
            clientType.includes("kimi-k2.5") ||
            clientType.includes("kimi-k2.6")) {
            // the whole Kimi K2.5+ series shares the unified client
            return kimi_k3_1.KimiK3Client;
        }
        else if (clientType === "minimax-m3") {
            return minimax_m3_1.MiniMaxM3Client;
        }
        else if (clientType.includes("deepseek-v4")) {
            return deepseek_v4_1.DeepSeekV4Client;
        }
        else if (clientType === "openai-chat-vllm-adapter") {
            // exact match: "openai-chat-vllm-adapter" contains "openai", so the substring
            // branches below would otherwise claim it
            return openai_chat_vllm_adapter_1.OpenaiChatVllmAdapterClient;
        }
        else if (clientType.includes("ant-messages")) {
            return ant_messages_1.AntMessagesClient;
        }
        else if (clientType.includes("openai-responses")) {
            return openai_responses_1.OpenaiResponsesClient;
        }
        else if (clientType.includes("openai") &&
            clientType.includes("embedding")) {
            return openai_embedding_1.OpenaiEmbeddingClient;
        }
        else if (clientType.includes("openai") &&
            !clientType.includes("embedding")) {
            // openai-chat, plus bare "openai" as alias
            return openai_chat_1.OpenaiChatClient;
        }
        else {
            return null;
        }
    }
    _createClientForModel(model, apiKey, baseUrl, clientType, defaultHeaders) {
        const ClientClass = this._clientClassForModel(clientType || model.toLowerCase());
        if (ClientClass === null) {
            throw new Error(`${clientType} is not supported. ` +
                "Supported client types: minimax-m3, gemini-3.8, gemini-3.7, gemini-3.6, gemini-3, " +
                "claude-5, claude-4-8, claude-4-7, " +
                "claude-4-6, gpt-6, gpt-5.6, gpt-5.5, gpt-5.4, glm-5.3, glm-5.2, glm-5.1, kimi-k3, kimi-k2.6, kimi-k2.5, " +
                "deepseek-v4, openai-chat-vllm-adapter, openai-embedding, ant-messages, openai-responses, openai-chat.");
        }
        return new ClientClass({ model, apiKey, baseUrl, defaultHeaders });
    }
    /**
     * Delegate to underlying client's transformUniConfigToModelConfig.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformUniConfigToModelConfig(config) {
        return this._client.transformUniConfigToModelConfig(config);
    }
    /**
     * Delegate to underlying client's transformUniMessageToModelInput.
     */
    /* eslint-disable @typescript-eslint/no-explicit-any */
    transformUniMessageToModelInput(messages, signal) {
        return this._client.transformUniMessageToModelInput(messages, signal);
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
    /**
     * Delegate to underlying client's transformModelOutputToUniEvent.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformModelOutputToUniEvent(modelOutput) {
        return this._client.transformModelOutputToUniEvent(modelOutput);
    }
    /**
     * Not implemented - use streamingResponse instead.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async *_streamingResponseInternal(_options) {
        yield {
            role: "assistant",
            event_type: "delta",
            content_items: [],
            usage_metadata: null,
            finish_reason: null,
        };
        throw new Error("Please use streamingResponse instead.");
    }
    /**
     * Route to underlying client's streamingResponse.
     */
    async *streamingResponse(options) {
        for await (const event of this._client.streamingResponse({
            messages: options.messages,
            config: options.config,
            signal: options.signal,
        })) {
            yield event;
        }
    }
    /**
     * Route to underlying client's streamingResponseStateful.
     */
    async *streamingResponseStateful(options) {
        for await (const event of this._client.streamingResponseStateful({
            message: options.message,
            config: options.config,
            signal: options.signal,
        })) {
            yield event;
        }
    }
    /**
     * Clear history in the underlying client.
     */
    clearHistory() {
        this._client.clearHistory();
    }
    /**
     * Get history from the underlying client.
     */
    getHistory() {
        return this._client.getHistory();
    }
    /**
     * Set history in the underlying client.
     */
    setHistory(history) {
        this._client.setHistory(history);
    }
    /**
     * List the model ids the endpoint serves that the routed client can be used for.
     *
     * A protocol client is chosen explicitly and speaks for whatever the endpoint serves, so
     * its listing is returned whole. A client deduced from a model id serves only the ids that
     * deduce back to it, so a gateway fronting many vendors is filtered down to that client's
     * own models.
     *
     * @returns The model ids, in the order the endpoint returned them.
     */
    async listModels() {
        const modelIds = await this._client.listModels();
        const protocolClasses = PROTOCOL_CLIENT_TYPES.map((clientType) => this._clientClassForModel(clientType));
        const clientClass = this._client.constructor;
        if (protocolClasses.includes(clientClass)) {
            return modelIds;
        }
        return modelIds.filter((modelId) => this._clientClassForModel(modelId.toLowerCase()) === clientClass);
    }
}
exports.AutoLLMClient = AutoLLMClient;
