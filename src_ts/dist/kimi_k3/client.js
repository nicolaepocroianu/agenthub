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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KimiK3Client = void 0;
const path = __importStar(require("path"));
const openai_1 = __importDefault(require("openai"));
const baseClient_1 = require("../baseClient");
const errors_1 = require("../errors");
const types_1 = require("../types");
const utils_1 = require("../utils");
/**
 * Kimi K3-specific LLM client implementation using OpenAI-compatible API (also serves K2.5 and K2.6).
 */
class KimiK3Client extends baseClient_1.LLMClient {
    /**
     * Initialize Kimi K3 client with model and API key.
     */
    constructor(options) {
        super();
        this._model = options.model;
        const key = options.apiKey || process.env.MOONSHOT_API_KEY || undefined;
        const url = options.baseUrl ||
            process.env.MOONSHOT_BASE_URL ||
            "https://api.moonshot.cn/v1";
        this._client = new openai_1.default({
            apiKey: key,
            baseURL: url,
            defaultHeaders: options.defaultHeaders,
        });
    }
    /**
     * Detect MIME type from URL extension for image.
     */
    _detectImageMimeType(url) {
        const ext = path.extname(url).toLowerCase();
        const mimeTypes = {
            ".bmp": "image/bmp",
            ".gif": "image/gif",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".svg": "image/svg+xml",
            ".tiff": "image/tiff",
            ".webp": "image/webp",
        };
        return mimeTypes[ext] || "image/jpeg";
    }
    /**
     * Convert image URL to base64-encoded data URL.
     */
    async _convertImageUrlToBase64(url, signal) {
        if (url.startsWith("data:")) {
            return url;
        }
        const response = await fetch(url, { signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = this._detectImageMimeType(url);
        const base64String = buffer.toString("base64");
        return `data:${mimeType};base64,${base64String}`;
    }
    /**
     * Convert ThinkingLevel enum to the K2-generation thinking configuration.
     */
    _convertThinkingLevelToThinkingConfig(thinkingLevel) {
        const mapping = {
            [types_1.ThinkingLevel.NONE]: { type: "disabled" },
            [types_1.ThinkingLevel.LOW]: { type: "enabled", keep: "all" },
            [types_1.ThinkingLevel.MEDIUM]: { type: "enabled", keep: "all" },
            [types_1.ThinkingLevel.HIGH]: { type: "enabled", keep: "all" },
            [types_1.ThinkingLevel.XHIGH]: { type: "enabled", keep: "all" },
            [types_1.ThinkingLevel.MAX]: { type: "enabled", keep: "all" },
        };
        return mapping[thinkingLevel];
    }
    /**
     * Convert ThinkingLevel enum to Kimi K3's reasoning_effort.
     *
     * K3 cannot disable reasoning, so NONE degrades to the lowest effort
     * instead of throwing.
     */
    _convertThinkingLevelToReasoningEffort(thinkingLevel) {
        const mapping = {
            [types_1.ThinkingLevel.NONE]: "low",
            [types_1.ThinkingLevel.LOW]: "low",
            [types_1.ThinkingLevel.MEDIUM]: "high",
            [types_1.ThinkingLevel.HIGH]: "high",
            [types_1.ThinkingLevel.XHIGH]: "max",
            [types_1.ThinkingLevel.MAX]: "max",
        };
        return mapping[thinkingLevel];
    }
    /**
     * Convert ToolChoice to OpenAI's tool_choice format.
     */
    _convertToolChoice(toolChoice) {
        if (toolChoice === "auto") {
            return "auto";
        }
        else if (toolChoice === "none") {
            return "none";
        }
        else if (toolChoice === "required" &&
            !this._model.toLowerCase().includes("k2.")) {
            return "required";
        }
        else {
            // the K2 generation rejects "required"; forcing a specific tool is
            // unsupported family-wide
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "tool_choice",
                message: "Kimi does not support this tool_choice ('required' needs Kimi K3).",
            });
        }
    }
    /**
     * Transform universal configuration to Kimi K3-specific configuration.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformUniConfigToModelConfig(config) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kimiConfig = {
            model: this._model,
            stream: true,
            stream_options: { include_usage: true },
        };
        if (config.max_tokens !== undefined) {
            kimiConfig.max_completion_tokens = config.max_tokens;
        }
        if (config.temperature !== undefined && config.temperature !== 1.0) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "temperature",
                message: "Kimi does not support setting temperature.",
            });
        }
        if (config.thinking_level !== undefined) {
            // the K2 generation configures thinking through extra_body and can disable
            // it; K3 uses reasoning_effort and cannot
            if (this._model.toLowerCase().includes("k2.")) {
                kimiConfig.extra_body = kimiConfig.extra_body || {};
                kimiConfig.extra_body.thinking =
                    this._convertThinkingLevelToThinkingConfig(config.thinking_level);
            }
            else {
                kimiConfig.reasoning_effort =
                    this._convertThinkingLevelToReasoningEffort(config.thinking_level);
            }
        }
        if (config.tools !== undefined) {
            kimiConfig.tools = config.tools.map((tool) => ({
                type: "function",
                function: tool,
            }));
        }
        if (config.tool_choice !== undefined) {
            kimiConfig.tool_choice = this._convertToolChoice(config.tool_choice);
        }
        if (config.fast_mode) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "fast_mode",
                message: "Kimi does not support fast mode.",
            });
        }
        if (config.prompt_caching !== undefined &&
            config.prompt_caching !== types_1.PromptCaching.ENABLE) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "prompt_caching",
                message: "prompt_caching must be ENABLE for Kimi.",
            });
        }
        // K3 context caching is automatic; the K2 generation keys its prompt
        // cache on trace_id
        if (config.trace_id !== undefined &&
            this._model.toLowerCase().includes("k2.")) {
            kimiConfig.prompt_cache_key = config.trace_id;
        }
        return kimiConfig;
    }
    /**
     * Transform universal message format to OpenAI's message format.
     */
    async transformUniMessageToModelInput(messages, signal) {
        const openaiMessages = [];
        for (const msg of messages) {
            const contentParts = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolCalls = [];
            let thinking = "";
            const thinkingFields = new Set();
            for (const item of msg.content_items) {
                if (item.type === "text") {
                    contentParts.push({ type: "text", text: item.text });
                }
                else if (item.type === "image_url") {
                    const base64Image = await this._convertImageUrlToBase64(item.image_url, signal);
                    contentParts.push({
                        type: "image_url",
                        image_url: { url: base64Image },
                    });
                }
                else if (item.type === "thinking") {
                    thinking += item.thinking;
                    thinkingFields.add(item.fidelity?.reasoning_field);
                }
                else if (item.type === "tool_call") {
                    toolCalls.push({
                        id: item.tool_call_id,
                        type: "function",
                        function: {
                            name: item.name,
                            arguments: JSON.stringify(item.arguments, null, 0),
                        },
                    });
                }
                else if (item.type === "tool_result") {
                    if (!item.tool_call_id) {
                        throw new Error("tool_call_id is required for tool result.");
                    }
                    // Chat Completions lets a tool message carry text only, and a server that
                    // validates the schema rejects the whole request over an image part in one.
                    // The images ride in the user message that follows the turn's tool messages,
                    // the one place every OpenAI-compatible server reads them.
                    if (item.images && item.images.length > 0) {
                        for (const imageUrl of item.images) {
                            const base64Image = await this._convertImageUrlToBase64(imageUrl, signal);
                            contentParts.push({
                                type: "image_url",
                                image_url: { url: base64Image },
                            });
                        }
                    }
                    // the plain string is the form Moonshot's own tool-call examples send and every
                    // OpenAI-compatible server accepts
                    openaiMessages.push({
                        role: "tool",
                        tool_call_id: item.tool_call_id,
                        content: item.text,
                    });
                }
                else {
                    throw new Error(`Unknown item type: ${item.type}`);
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const message = { role: msg.role };
            if (contentParts.length > 0) {
                message.content = contentParts;
            }
            if (toolCalls.length > 0) {
                message.tool_calls = toolCalls;
            }
            if (thinking) {
                // send thinking back through the exact field the upstream produced (recorded
                // in the item fidelity); servers may reject the spelling they did not emit
                if (thinkingFields.size === 1 &&
                    thinkingFields.has("reasoning_content")) {
                    message.reasoning_content = thinking;
                }
                else if (thinkingFields.size === 1 &&
                    thinkingFields.has("reasoning")) {
                    message.reasoning = thinking;
                }
                else {
                    message.reasoning_content = thinking; // vLLM & siliconflow compatibility
                    message.reasoning = thinking; // openrouter compatibility
                }
            }
            if (Object.keys(message).length > 1) {
                openaiMessages.push(message);
            }
        }
        return openaiMessages;
    }
    /**
     * Transform Kimi K3 model output to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput) {
        let eventType = null;
        const contentItems = [];
        let usageMetadata = null;
        let finishReason = null;
        // gateways inject content-free heartbeat chunks on long generations, whose
        // choices arrive as undefined rather than an empty list
        if (modelOutput.choices?.length) {
            const choice = modelOutput.choices[0];
            const delta = choice?.delta;
            if (delta?.content) {
                eventType = "delta";
                contentItems.push({ type: "text", text: delta.content });
            }
            // the thinking field name differs by server: vLLM & siliconflow use
            // reasoning_content while openrouter uses reasoning; record the wire
            // field that carried each delta so a replay can reproduce exactly the
            // field the upstream produced
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reasoningContent = delta?.reasoning_content;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reasoning = delta?.reasoning;
            if (reasoningContent && reasoning) {
                eventType = "delta";
                // ambiguous origin: record no fidelity so a replay sends both fields back
                contentItems.push({ type: "thinking", thinking: reasoningContent });
            }
            else if (reasoningContent) {
                eventType = "delta";
                contentItems.push({
                    type: "thinking",
                    thinking: reasoningContent,
                    fidelity: { reasoning_field: "reasoning_content" },
                });
            }
            else if (reasoning) {
                eventType = "delta";
                contentItems.push({
                    type: "thinking",
                    thinking: reasoning,
                    fidelity: { reasoning_field: "reasoning" },
                });
            }
            if (delta?.tool_calls) {
                eventType = "delta";
                for (const toolCall of delta.tool_calls) {
                    contentItems.push({
                        type: "partial_tool_call",
                        name: toolCall.function?.name || "",
                        arguments: toolCall.function?.arguments || "",
                        tool_call_id: toolCall.id || "",
                    });
                }
            }
            if (choice?.finish_reason) {
                eventType = eventType || "stop";
                const finishReasonMapping = {
                    stop: "stop",
                    length: "length",
                    tool_calls: "tool_call",
                    content_filter: "stop",
                };
                finishReason = finishReasonMapping[choice.finish_reason] || "unknown";
            }
        }
        if (modelOutput.usage) {
            eventType = eventType || "stop";
            const cachedTokens = modelOutput.usage.prompt_tokens_details?.cached_tokens || null;
            const reasoningTokens = modelOutput.usage.completion_tokens_details?.reasoning_tokens || null;
            const promptTokens = cachedTokens !== null
                ? modelOutput.usage.prompt_tokens - cachedTokens
                : modelOutput.usage.prompt_tokens;
            const responseTokens = reasoningTokens !== null
                ? modelOutput.usage.completion_tokens - reasoningTokens
                : modelOutput.usage.completion_tokens;
            usageMetadata = {
                cached_tokens: cachedTokens,
                prompt_tokens: promptTokens,
                thoughts_tokens: reasoningTokens,
                response_tokens: responseTokens,
            };
            usageMetadata = (0, utils_1.fixOpenrouterUsageMetadata)(usageMetadata, this._client.baseURL);
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
     * Stream generate using Kimi SDK with unified conversion methods.
     */
    async *_streamingResponseInternal(options) {
        const kimiConfig = this.transformUniConfigToModelConfig(options.config);
        const kimiMessages = await this.transformUniMessageToModelInput(options.messages, options.signal);
        if (options.config.system_prompt) {
            kimiMessages.unshift({
                role: "system",
                content: options.config.system_prompt,
            });
        }
        const params = {
            ...kimiConfig,
            messages: kimiMessages,
            stream: true,
        };
        const stream = await this._client.chat.completions.create(params, {
            signal: options.signal,
        });
        const partialToolCall = {};
        let partialUsage = {};
        for await (const chunk of stream) {
            const event = this.transformModelOutputToUniEvent(chunk);
            // the finish reason and usage metadata should be accumulated
            partialUsage.finish_reason =
                event.finish_reason || partialUsage.finish_reason;
            partialUsage.usage_metadata =
                event.usage_metadata || partialUsage.usage_metadata;
            if (event.event_type === "delta") {
                for (const item of event.content_items) {
                    if (item.type === "partial_tool_call") {
                        if (!partialToolCall.name) {
                            // start a new partial tool call
                            partialToolCall.name = item.name;
                            partialToolCall.arguments = item.arguments;
                            partialToolCall.tool_call_id = item.tool_call_id;
                        }
                        else if (item.name) {
                            // finish the previous partial tool call
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
                            // start a new partial tool call
                            partialToolCall.name = item.name;
                            partialToolCall.arguments = item.arguments;
                            partialToolCall.tool_call_id = item.tool_call_id;
                        }
                        else {
                            // update partial tool call
                            partialToolCall.arguments =
                                (partialToolCall.arguments || "") + item.arguments;
                        }
                    }
                }
                yield event;
            }
            else if (event.event_type === "stop") {
                if (partialToolCall.name) {
                    // finish the partial tool call
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
                if (partialUsage.finish_reason && partialUsage.usage_metadata) {
                    yield {
                        role: "assistant",
                        event_type: "stop",
                        content_items: [],
                        usage_metadata: partialUsage.usage_metadata,
                        finish_reason: partialUsage.finish_reason,
                    };
                    partialUsage.finish_reason = null;
                    partialUsage.usage_metadata = null;
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
        const models = [];
        for await (const model of this._client.models.list()) {
            models.push(model.id);
        }
        return models;
    }
}
exports.KimiK3Client = KimiK3Client;
