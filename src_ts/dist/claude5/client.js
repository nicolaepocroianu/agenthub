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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Claude5Client = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const bedrock_sdk_1 = __importDefault(require("@anthropic-ai/bedrock-sdk"));
const baseClient_1 = require("../baseClient");
const errors_1 = require("../errors");
const types_1 = require("../types");
const utils_1 = require("../utils");
const REDACTED_THINKING = "_REDACTED_THINKING";
/**
 * Claude 5-specific LLM client implementation (also serves Claude 4.6 through 4.8).
 */
class Claude5Client extends baseClient_1.LLMClient {
    /**
     * Initialize Claude 5 client with model and API key.
     */
    constructor(options) {
        super();
        this._model = options.model;
        const key = options.apiKey || process.env.ANTHROPIC_API_KEY || undefined;
        const url = options.baseUrl || process.env.ANTHROPIC_BASE_URL || undefined;
        if (url && url.startsWith("bedrock://")) {
            // example: bedrock://us-east-1
            const region = url.replace("bedrock://", "");
            const [accessKey, secretKey] = (key || "").split(",");
            this._client = new bedrock_sdk_1.default({
                awsSecretKey: secretKey,
                awsAccessKey: accessKey,
                awsRegion: region,
                defaultHeaders: options.defaultHeaders,
            });
            this._use_bedrock = true;
        }
        else {
            this._client = new sdk_1.default({
                apiKey: key,
                baseURL: url,
                defaultHeaders: options.defaultHeaders,
            });
            this._use_bedrock = false;
        }
    }
    /**
     * Convert image URL to image source.
     *
     * Bedrock does not support image url sources, so we need to fetch the image bytes and encode them.
     */
    async _convertImageUrlToSource(url, signal) {
        if (url.startsWith("data:")) {
            const match = url.match(/data:([^;]+);base64,(.+)/);
            if (match) {
                const mediaType = match[1];
                const base64Data = match[2];
                return {
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: mediaType,
                        data: base64Data,
                    },
                };
            }
            else {
                throw new Error(`Invalid base64 image: ${url}`);
            }
        }
        else if (this._use_bedrock) {
            const response = await fetch(url, { signal });
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mime_type = response.headers.get("content-type") || "image/jpeg";
            return {
                type: "image",
                source: {
                    type: "base64",
                    media_type: mime_type,
                    data: buffer.toString("base64"),
                },
            };
        }
        else {
            return { type: "image", source: { type: "url", url } };
        }
    }
    /**
     * Convert ThinkingLevel enum to Claude's adaptive thinking config.
     */
    _convertThinkingLevelToThinkingConfig(thinkingLevel) {
        const mapping = {
            [types_1.ThinkingLevel.NONE]: {}, // omit thinking config
            [types_1.ThinkingLevel.LOW]: {
                thinking: { type: "adaptive" },
                output_config: { effort: "low" },
            },
            [types_1.ThinkingLevel.MEDIUM]: {
                thinking: { type: "adaptive" },
                output_config: { effort: "medium" },
            },
            [types_1.ThinkingLevel.HIGH]: {
                thinking: { type: "adaptive" },
                output_config: { effort: "high" },
            },
            // Claude 4.6 has no xhigh effort, so XHIGH degrades to the closest supported level
            [types_1.ThinkingLevel.XHIGH]: {
                thinking: { type: "adaptive" },
                output_config: {
                    effort: this._model.includes("4-6") ? "high" : "xhigh",
                },
            },
            // every model this client serves is 4.6 or later, and max spans that whole range
            [types_1.ThinkingLevel.MAX]: {
                thinking: { type: "adaptive" },
                output_config: { effort: "max" },
            },
        };
        return mapping[thinkingLevel];
    }
    /**
     * Convert ToolChoice to Claude's tool_choice format.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _convertToolChoice(toolChoice) {
        if (Array.isArray(toolChoice)) {
            if (toolChoice.length > 1) {
                throw new errors_1.UnsupportedParameterError({
                    client: this.constructor.name,
                    parameter: "tool_choice",
                    message: "Claude supports only one tool choice.",
                });
            }
            return { type: "any", name: toolChoice[0] };
        }
        else if (toolChoice === "none") {
            return { type: "none" };
        }
        else if (toolChoice === "auto") {
            return { type: "auto" };
        }
        else if (toolChoice === "required") {
            return { type: "any" };
        }
    }
    /**
     * Transform universal configuration to Claude-specific configuration.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformUniConfigToModelConfig(config) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const claudeConfig = {
            model: this._model,
            stream: true,
        };
        if (config.system_prompt !== undefined) {
            claudeConfig.system = config.system_prompt;
        }
        if (config.max_tokens !== undefined) {
            claudeConfig.max_tokens = config.max_tokens;
        }
        else {
            claudeConfig.max_tokens = 64000;
        }
        if (config.temperature !== undefined && config.temperature !== 1.0) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "temperature",
                message: "Claude models do not support setting temperature; the API dropped it " +
                    "starting with the 4.7 generation and the unified client rejects it for the whole family.",
            });
        }
        if (config.thinking_level !== undefined) {
            Object.assign(claudeConfig, this._convertThinkingLevelToThinkingConfig(config.thinking_level));
        }
        if (config.thinking_summary !== undefined) {
            // display lives on the thinking block, so a summary asked for on its own selects
            // adaptive thinking, which is what this family runs by default anyway; a block
            // carrying display but no output_config is accepted on 4.6 through 5 (verified
            // live 2026-09-03). NONE omits the block, so the request lands on that default.
            claudeConfig.thinking = claudeConfig.thinking ?? { type: "adaptive" };
            claudeConfig.thinking.display = config.thinking_summary
                ? "summarized"
                : "omitted";
        }
        if (config.tools !== undefined) {
            const claudeTools = [];
            for (const tool of config.tools) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const claudeTool = {};
                for (const [key, value] of Object.entries(tool)) {
                    claudeTool[key.replace("parameters", "input_schema")] = value;
                }
                claudeTools.push(claudeTool);
            }
            claudeConfig.tools = claudeTools;
        }
        if (config.tool_choice !== undefined) {
            claudeConfig.tool_choice = this._convertToolChoice(config.tool_choice);
        }
        if (config.fast_mode) {
            if (this._use_bedrock) {
                throw new errors_1.UnsupportedParameterError({
                    client: this.constructor.name,
                    parameter: "fast_mode",
                    message: "Bedrock does not support fast mode.",
                });
            }
            if (this._model.includes("4-6")) {
                throw new errors_1.UnsupportedParameterError({
                    client: this.constructor.name,
                    parameter: "fast_mode",
                    message: "Claude 4.6 does not support fast mode.",
                });
            }
            claudeConfig.speed = "fast";
            claudeConfig.betas = ["fast-mode-2026-02-01"];
        }
        // Add cache_control if prompt caching is enabled
        // TODO: wait for bedrock to support cache_control in config
        if (!this._use_bedrock) {
            const promptCaching = config.prompt_caching || types_1.PromptCaching.ENABLE;
            if (promptCaching === types_1.PromptCaching.ENABLE) {
                claudeConfig.cache_control = { type: "ephemeral" };
            }
            else if (promptCaching === types_1.PromptCaching.ENHANCE) {
                claudeConfig.cache_control = { type: "ephemeral", ttl: "1h" };
            }
        }
        return claudeConfig;
    }
    /**
     * Transform universal message format to Claude's MessageParam format.
     */
    async transformUniMessageToModelInput(messages, signal) {
        const claudeMessages = [];
        for (const msg of messages) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const contentBlocks = [];
            for (const item of msg.content_items) {
                if (item.type === "text") {
                    contentBlocks.push({ type: "text", text: item.text });
                }
                else if (item.type === "image_url") {
                    const imageUrl = item.image_url;
                    contentBlocks.push(await this._convertImageUrlToSource(imageUrl, signal));
                }
                else if (item.type === "thinking") {
                    if (item.thinking === REDACTED_THINKING) {
                        contentBlocks.push({
                            type: "redacted_thinking",
                            data: item.fidelity?.signature,
                        });
                    }
                    else {
                        contentBlocks.push({
                            type: "thinking",
                            thinking: item.thinking,
                            signature: item.fidelity?.signature,
                        });
                    }
                }
                else if (item.type === "tool_call") {
                    contentBlocks.push({
                        type: "tool_use",
                        id: item.tool_call_id,
                        name: item.name,
                        input: item.arguments,
                    });
                }
                else if (item.type === "tool_result") {
                    if (!item.tool_call_id) {
                        throw new Error("tool_call_id is required for tool result.");
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const toolResult = [{ type: "text", text: item.text }];
                    if (item.images) {
                        for (const imageUrl of item.images) {
                            toolResult.push(await this._convertImageUrlToSource(imageUrl, signal));
                        }
                    }
                    contentBlocks.push({
                        type: "tool_result",
                        content: toolResult,
                        tool_use_id: item.tool_call_id,
                    });
                }
                else {
                    throw new Error(`Unknown item: ${JSON.stringify(item)}`);
                }
            }
            claudeMessages.push({
                role: msg.role,
                content: contentBlocks,
            });
        }
        return claudeMessages;
    }
    /**
     * Transform Claude model output to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput) {
        let eventType = null;
        const contentItems = [];
        let usageMetadata = null;
        let finishReason = null;
        const claudeEventType = modelOutput.type;
        if (claudeEventType === "content_block_start") {
            eventType = "start";
            const block = modelOutput.content_block;
            if (block.type === "tool_use") {
                contentItems.push({
                    type: "partial_tool_call",
                    name: block.name,
                    arguments: "",
                    tool_call_id: block.id,
                });
            }
            else if (block.type === "redacted_thinking") {
                contentItems.push({
                    type: "thinking",
                    thinking: REDACTED_THINKING,
                    fidelity: { signature: block.data },
                });
            }
        }
        else if (claudeEventType === "content_block_delta") {
            eventType = "delta";
            const delta = modelOutput.delta;
            if (delta.type === "thinking_delta") {
                contentItems.push({ type: "thinking", thinking: delta.thinking });
            }
            else if (delta.type === "text_delta") {
                contentItems.push({ type: "text", text: delta.text });
            }
            else if (delta.type === "input_json_delta") {
                contentItems.push({
                    type: "partial_tool_call",
                    name: "",
                    arguments: delta.partial_json,
                    tool_call_id: "",
                });
            }
            else if (delta.type === "signature_delta") {
                contentItems.push({
                    type: "thinking",
                    thinking: "",
                    fidelity: { signature: delta.signature },
                });
            }
        }
        else if (claudeEventType === "content_block_stop") {
            eventType = "stop";
        }
        else if (claudeEventType === "message_start") {
            eventType = "start";
            const message = modelOutput.message;
            if (message.usage) {
                const cacheCreationTokens = message.usage.cache_creation_input_tokens || 0;
                usageMetadata = {
                    cached_tokens: message.usage.cache_read_input_tokens,
                    prompt_tokens: message.usage.input_tokens + cacheCreationTokens,
                    thoughts_tokens: null,
                    response_tokens: null,
                };
            }
        }
        else if (claudeEventType === "message_delta") {
            eventType = "stop";
            const delta = modelOutput.delta;
            if (delta.stop_reason) {
                const stopReasonMapping = {
                    end_turn: "stop",
                    max_tokens: "length",
                    stop_sequence: "stop",
                    tool_use: "tool_call",
                };
                finishReason = stopReasonMapping[delta.stop_reason] || "unknown";
            }
            const usage = modelOutput.usage;
            if (usage) {
                // In message_delta, we only update response_tokens
                usageMetadata = {
                    cached_tokens: null,
                    prompt_tokens: null,
                    thoughts_tokens: null,
                    response_tokens: usage.output_tokens,
                };
            }
        }
        else if (claudeEventType === "message_stop") {
            eventType = "stop";
        }
        else if (["text", "thinking", "signature", "input_json", "ping"].includes(claudeEventType)) {
            // the SDK drops the "ping" heartbeat at the SSE layer; it reaches here only
            // from gateways that relabel it onto another event
            eventType = "unused";
        }
        else if ((0, utils_1.isDebugEnabled)()) {
            throw new Error(`Unknown output: ${JSON.stringify(modelOutput)}`);
        }
        else {
            // a gateway injects its own events (heartbeats, cost tickers) into the stream, and
            // killing a long generation over one costs more than dropping it
            eventType = "unused";
        }
        return {
            role: "assistant",
            event_type: eventType,
            content_items: contentItems,
            usage_metadata: usageMetadata,
            finish_reason: finishReason,
        };
    }
    /**
     * Stream generate using Claude SDK with unified conversion methods.
     */
    async *_streamingResponseInternal(options) {
        const claudeConfig = this.transformUniConfigToModelConfig(options.config);
        const claudeMessages = await this.transformUniMessageToModelInput(options.messages, options.signal);
        // Add cache_control to last user message's last item if enabled
        // TODO: remove after bedrock supports cache_control in config
        if (this._use_bedrock) {
            const promptCaching = options.config.prompt_caching || types_1.PromptCaching.ENABLE;
            if (promptCaching !== types_1.PromptCaching.DISABLE &&
                claudeMessages.length > 0) {
                try {
                    const reversedMessages = [...claudeMessages].reverse();
                    const lastUserMessage = reversedMessages.find((x) => x.role === "user");
                    if (lastUserMessage && Array.isArray(lastUserMessage.content)) {
                        const lastContentItem = lastUserMessage.content[lastUserMessage.content.length - 1];
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        lastContentItem.cache_control = {
                            type: "ephemeral",
                            ttl: promptCaching === types_1.PromptCaching.ENHANCE ? "1h" : "5m",
                        };
                    }
                }
                catch {
                    // Ignore errors in cache_control setup
                }
            }
        }
        // Stream generate
        const partialToolCall = {};
        const partialUsage = {};
        const stream = (await this._client.beta.messages.create({
            ...claudeConfig,
            messages: claudeMessages,
        }, {
            signal: options.signal,
        }));
        for await (const event of stream) {
            const uniEvent = this.transformModelOutputToUniEvent(event);
            if (uniEvent.event_type === "start") {
                for (const item of uniEvent.content_items) {
                    if (item.type === "partial_tool_call") {
                        partialToolCall.name = item.name;
                        partialToolCall.arguments = "";
                        partialToolCall.tool_call_id = item.tool_call_id;
                    }
                }
                if (uniEvent.content_items.length > 0) {
                    yield uniEvent;
                }
                if (uniEvent.usage_metadata !== null) {
                    partialUsage.prompt_tokens = uniEvent.usage_metadata.prompt_tokens;
                    partialUsage.cached_tokens = uniEvent.usage_metadata.cached_tokens;
                }
            }
            else if (uniEvent.event_type === "delta") {
                for (const item of uniEvent.content_items) {
                    if (item.type === "partial_tool_call") {
                        partialToolCall.arguments =
                            (partialToolCall.arguments || "") + item.arguments;
                    }
                }
                yield uniEvent;
            }
            else if (uniEvent.event_type === "stop") {
                if (partialToolCall.name && partialToolCall.arguments !== undefined) {
                    yield {
                        role: "assistant",
                        event_type: "delta",
                        content_items: [
                            {
                                type: "tool_call",
                                name: partialToolCall.name,
                                arguments: (0, errors_1.parseToolCallArguments)(partialToolCall.arguments, this.constructor.name, partialToolCall.name || "", partialToolCall.tool_call_id || ""),
                                tool_call_id: partialToolCall.tool_call_id || "",
                            },
                        ],
                        usage_metadata: null,
                        finish_reason: null,
                    };
                    partialToolCall.name = undefined;
                    partialToolCall.arguments = undefined;
                    partialToolCall.tool_call_id = undefined;
                }
                if (partialUsage.prompt_tokens !== undefined &&
                    partialUsage.prompt_tokens !== null &&
                    uniEvent.usage_metadata !== null) {
                    yield {
                        role: "assistant",
                        event_type: "stop",
                        content_items: [],
                        usage_metadata: {
                            prompt_tokens: partialUsage.prompt_tokens,
                            thoughts_tokens: null,
                            response_tokens: uniEvent.usage_metadata.response_tokens,
                            cached_tokens: partialUsage.cached_tokens || null,
                        },
                        finish_reason: uniEvent.finish_reason,
                    };
                    partialUsage.prompt_tokens = undefined;
                    partialUsage.cached_tokens = undefined;
                }
            }
        }
    }
    /**
     * List the model ids the configured endpoint serves.
     *
     * @returns The model ids, in the order the endpoint returned them.
     */
    async listModels() {
        if (this._use_bedrock) {
            throw new errors_1.UnsupportedOperationError({
                client: this.constructor.name,
                operation: "list_models",
                message: "Bedrock does not support listing models.",
            });
        }
        const models = [];
        for await (const model of this._client.models.list()) {
            models.push(model.id);
        }
        return models;
    }
}
exports.Claude5Client = Claude5Client;
