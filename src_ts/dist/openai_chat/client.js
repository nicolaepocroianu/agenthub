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
exports.OpenaiChatClient = void 0;
const openai_1 = __importDefault(require("openai"));
const path = __importStar(require("path"));
const baseClient_1 = require("../baseClient");
const errors_1 = require("../errors");
const types_1 = require("../types");
const utils_1 = require("../utils");
/**
 * OpenAI Chat Completions-compatible client implementation.
 */
class OpenaiChatClient extends baseClient_1.LLMClient {
    /**
     * Initialize OpenAI-compatible chat client with model, API key, and base URL.
     */
    constructor(options) {
        super();
        this._model = options.model;
        const key = options.apiKey || process.env.OPENAI_API_KEY || undefined;
        const url = options.baseUrl || process.env.OPENAI_BASE_URL || undefined;
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
     * Convert ToolChoice to OpenAI Chat Completions tool_choice format.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _convertToolChoice(toolChoice) {
        if (Array.isArray(toolChoice)) {
            return {
                type: "allowed_tools",
                allowed_tools: {
                    mode: "auto",
                    tools: toolChoice.map((name) => ({
                        type: "function",
                        function: { name },
                    })),
                },
            };
        }
        return toolChoice;
    }
    /**
     * Convert a fetched image to an image_url part, at the detail the API needs
     * to read it.
     */
    _convertImageUrl(dataUrl) {
        const detail = (0, utils_1.openaiImageDetail)(this._model, dataUrl);
        return detail
            ? { type: "image_url", image_url: { url: dataUrl, detail } }
            : { type: "image_url", image_url: { url: dataUrl } };
    }
    /**
     * Transform universal configuration to OpenAI Chat Completions configuration.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformUniConfigToModelConfig(config) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const openaiConfig = {
            model: this._model,
            stream: true,
            stream_options: { include_usage: true },
        };
        if (config.max_tokens !== undefined) {
            openaiConfig.max_completion_tokens = config.max_tokens;
        }
        if (config.temperature !== undefined) {
            openaiConfig.temperature = config.temperature;
        }
        if (config.tools !== undefined) {
            openaiConfig.tools = config.tools.map((tool) => ({
                type: "function",
                function: tool,
            }));
        }
        if (config.tool_choice !== undefined) {
            openaiConfig.tool_choice = this._convertToolChoice(config.tool_choice);
        }
        if (config.fast_mode) {
            openaiConfig.service_tier = "priority";
        }
        if (config.prompt_caching !== undefined &&
            config.prompt_caching !== types_1.PromptCaching.ENABLE) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "prompt_caching",
                message: "prompt_caching must be ENABLE for OpenAI.",
            });
        }
        return openaiConfig;
    }
    /**
     * Transform universal message format to OpenAI Chat Completions message format.
     */
    async transformUniMessageToModelInput(messages, signal) {
        const openaiMessages = [];
        // The reasoning field this upstream has produced so far, if any. A turn the model answered
        // without thinking still has to carry that field, empty, when it made tool calls: DeepSeek
        // stops thinking part-way through a long tool chain, and then rejects the replay of that
        // turn with "the reasoning_content in the thinking mode must be passed back to the API".
        // It waives that only for tool_call ids it issued itself, which a relay that reissues ids
        // takes away. A conversation that never produced a reasoning field never receives one.
        const replayFields = new Set();
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
                    contentParts.push(this._convertImageUrl(base64Image));
                }
                else if (item.type === "thinking") {
                    thinking += item.thinking;
                    thinkingFields.add(item.fidelity?.reasoning_field);
                    if (item.thinking)
                        replayFields.add(item.fidelity?.reasoning_field);
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
                            contentParts.push(this._convertImageUrl(base64Image));
                        }
                    }
                    // the plain string is the form every OpenAI-compatible server accepts
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
            // This turn's own fidelity when it thought; otherwise the field the upstream has
            // produced, with `thinking` still "" — the empty value is what keeps the turn replayable.
            const fields = thinking ? thinkingFields : replayFields;
            if (thinking || (toolCalls.length > 0 && replayFields.size > 0)) {
                // send thinking back through the exact field the upstream produced (recorded
                // in the item fidelity); servers may reject the spelling they did not emit
                if (fields.size === 1 && fields.has("reasoning_content")) {
                    message.reasoning_content = thinking;
                }
                else if (fields.size === 1 && fields.has("reasoning")) {
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
     * Transform OpenAI Chat Completions streaming chunk to universal event format.
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
                for (const toolCall of delta.tool_calls) {
                    eventType = "delta";
                    contentItems.push({
                        type: "partial_tool_call",
                        name: toolCall.function?.name || "",
                        arguments: toolCall.function?.arguments || "",
                        tool_call_id: toolCall.id || toolCall.function?.name || "",
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
     * Stream generate using OpenAI Chat Completions-compatible API.
     */
    async *_streamingResponseInternal(options) {
        const openaiConfig = this.transformUniConfigToModelConfig(options.config);
        const openaiMessages = await this.transformUniMessageToModelInput(options.messages, options.signal);
        if (options.config.system_prompt) {
            openaiMessages.unshift({
                role: "system",
                content: options.config.system_prompt,
            });
        }
        const params = {
            ...openaiConfig,
            messages: openaiMessages,
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
                            // start new partial tool call for tool call object
                            partialToolCall.name = item.name;
                            partialToolCall.arguments = item.arguments;
                            partialToolCall.tool_call_id = item.tool_call_id;
                        }
                        else if (item.name) {
                            // finish previous partial tool call for tool call object
                            yield {
                                role: "assistant",
                                event_type: "delta",
                                content_items: [
                                    {
                                        type: "tool_call",
                                        name: partialToolCall.name,
                                        arguments: (0, errors_1.parseToolCallArguments)(partialToolCall.arguments, this.constructor.name, partialToolCall.name || "", partialToolCall.tool_call_id || ""),
                                        tool_call_id: partialToolCall.tool_call_id,
                                    },
                                ],
                                usage_metadata: null,
                                finish_reason: null,
                            };
                            // start new partial tool call for tool call object
                            partialToolCall.name = item.name;
                            partialToolCall.arguments = item.arguments;
                            partialToolCall.tool_call_id = item.tool_call_id;
                        }
                        else {
                            // update partial tool call for tool call object
                            partialToolCall.arguments =
                                (partialToolCall.arguments || "") + item.arguments;
                        }
                    }
                }
                yield event;
            }
            else if (event.event_type === "stop") {
                if (partialToolCall.name) {
                    // finish partial tool call for tool call object
                    yield {
                        role: "assistant",
                        event_type: "delta",
                        content_items: [
                            {
                                type: "tool_call",
                                name: partialToolCall.name,
                                arguments: (0, errors_1.parseToolCallArguments)(partialToolCall.arguments, this.constructor.name, partialToolCall.name || "", partialToolCall.tool_call_id || ""),
                                tool_call_id: partialToolCall.tool_call_id,
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
exports.OpenaiChatClient = OpenaiChatClient;
