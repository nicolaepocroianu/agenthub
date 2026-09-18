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
exports.MiniMaxM3Client = void 0;
const openai_1 = __importDefault(require("openai"));
const baseClient_1 = require("../baseClient");
const errors_1 = require("../errors");
const types_1 = require("../types");
const utils_1 = require("../utils");
const DEFAULT_BASE_URL = "https://api.minimax.io/v1";
/** MiniMax M3 client using MiniMax's Responses API. */
class MiniMaxM3Client extends baseClient_1.LLMClient {
    constructor(options) {
        super();
        this._model = options.model;
        // The wrapped OpenAI SDK falls back to OPENAI_API_KEY when handed undefined, which would send
        // an OpenAI credential to the MiniMax host, so resolve the key here and fail loudly instead.
        const apiKey = options.apiKey || process.env.MINIMAX_API_KEY;
        if (!apiKey) {
            throw new Error("MINIMAX_API_KEY is required for MiniMaxM3Client.");
        }
        this._client = new openai_1.default({
            apiKey,
            baseURL: options.baseUrl || process.env.MINIMAX_BASE_URL || DEFAULT_BASE_URL,
            defaultHeaders: options.defaultHeaders,
        });
    }
    _convertThinkingLevelToEffort(thinkingLevel) {
        const mapping = {
            [types_1.ThinkingLevel.NONE]: "none",
            [types_1.ThinkingLevel.LOW]: "low",
            [types_1.ThinkingLevel.MEDIUM]: "medium",
            [types_1.ThinkingLevel.HIGH]: "high",
            [types_1.ThinkingLevel.XHIGH]: "high",
            // MiniMax stops at "high"
            [types_1.ThinkingLevel.MAX]: "high",
        };
        return mapping[thinkingLevel];
    }
    _convertToolChoice(toolChoice) {
        if (toolChoice === "auto" || toolChoice === "none") {
            return toolChoice;
        }
        throw new errors_1.UnsupportedParameterError({
            client: this.constructor.name,
            parameter: "tool_choice",
            message: "MiniMax Responses API does not support required or named tool selection.",
        });
    }
    /**
     * Transform universal configuration to MiniMax's Responses API payload.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformUniConfigToModelConfig(config) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const minimaxConfig = { model: this._model, store: false };
        if (config.system_prompt !== undefined) {
            minimaxConfig.instructions = config.system_prompt;
        }
        if (config.max_tokens !== undefined) {
            minimaxConfig.max_output_tokens = config.max_tokens;
        }
        if (config.temperature !== undefined) {
            // Written as a positive range test so NaN is rejected too: every `<`/`>` comparison against
            // NaN is false, which would let it through to the provider as a null temperature.
            if (!(config.temperature >= 0 && config.temperature <= 1)) {
                throw new errors_1.UnsupportedParameterError({
                    client: this.constructor.name,
                    parameter: "temperature",
                    message: "MiniMax Responses API does not support temperatures outside the range 0 to 1.",
                });
            }
            minimaxConfig.temperature = config.temperature;
        }
        if (config.thinking_level !== undefined) {
            minimaxConfig.reasoning = {
                effort: this._convertThinkingLevelToEffort(config.thinking_level),
            };
        }
        if (config.tools !== undefined) {
            minimaxConfig.tools = config.tools.map((tool) => ({
                type: "function",
                ...tool,
            }));
        }
        if (config.tool_choice !== undefined) {
            minimaxConfig.tool_choice = this._convertToolChoice(config.tool_choice);
        }
        if (config.fast_mode) {
            minimaxConfig.service_tier = "priority";
        }
        if (config.prompt_caching === types_1.PromptCaching.DISABLE) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "prompt_caching",
                message: "MiniMax Responses API does not support disabling its automatic prompt cache.",
            });
        }
        if (config.prompt_caching === types_1.PromptCaching.ENHANCE) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "prompt_caching",
                message: "MiniMax Responses API does not support enhancing its automatic prompt cache.",
            });
        }
        return minimaxConfig;
    }
    /**
     * Transform universal messages to MiniMax Responses input items.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformUniMessageToModelInput(messages) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inputList = [];
        for (const message of messages) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let contentItems = [];
            for (const item of message.content_items) {
                // anything that is not message content becomes an input item of its own, so the
                // text collected so far is flushed first to keep the order the model produced
                if (item.type !== "text" &&
                    item.type !== "image_url" &&
                    contentItems.length > 0) {
                    inputList.push({ role: message.role, content: contentItems });
                    contentItems = [];
                }
                if (item.type === "text") {
                    contentItems.push({
                        type: message.role === "user" ? "input_text" : "output_text",
                        text: item.text,
                    });
                }
                else if (item.type === "image_url") {
                    contentItems.push({ type: "input_image", image_url: item.image_url });
                }
                else if (item.type === "thinking") {
                    // MiniMax accepts a reasoning item rebuilt from the thinking text alone, so no fidelity
                    // is recorded for it.
                    inputList.push({
                        type: "reasoning",
                        content: item.thinking
                            ? [{ type: "reasoning_text", text: item.thinking }]
                            : [],
                    });
                }
                else if (item.type === "tool_call") {
                    inputList.push({
                        type: "function_call",
                        call_id: item.tool_call_id,
                        name: item.name,
                        arguments: JSON.stringify(item.arguments),
                    });
                }
                else if (item.type === "tool_result") {
                    if (item.tool_call_id === undefined) {
                        throw new Error("tool_call_id is required for tool result.");
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let output = item.text;
                    if (item.images?.length) {
                        output = [{ type: "input_text", text: item.text }];
                        for (const imageUrl of item.images) {
                            output.push({ type: "input_image", image_url: imageUrl });
                        }
                    }
                    inputList.push({
                        type: "function_call_output",
                        call_id: item.tool_call_id,
                        output,
                    });
                }
                else {
                    throw new Error(`Unknown item: ${JSON.stringify(item)}`);
                }
            }
            if (contentItems.length > 0) {
                inputList.push({ role: message.role, content: contentItems });
            }
        }
        return inputList;
    }
    /**
     * Transform a MiniMax streaming event to AgentHub's universal event format.
     */
    transformModelOutputToUniEvent(modelOutput) {
        let eventType = "unused";
        const contentItems = [];
        let usageMetadata = null;
        let finishReason = null;
        const minimaxEventType = modelOutput.type;
        if (minimaxEventType === "response.output_text.delta") {
            eventType = "delta";
            contentItems.push({ type: "text", text: modelOutput.delta });
        }
        else if (minimaxEventType === "response.reasoning_text.delta") {
            eventType = "delta";
            contentItems.push({ type: "thinking", thinking: modelOutput.delta });
        }
        else if (minimaxEventType === "response.output_item.added") {
            if (modelOutput.item.type === "function_call") {
                eventType = "start";
                contentItems.push({
                    type: "partial_tool_call",
                    name: modelOutput.item.name,
                    arguments: "",
                    tool_call_id: modelOutput.item.call_id,
                    item_id: modelOutput.item.id,
                });
            }
        }
        else if (minimaxEventType === "response.function_call_arguments.delta") {
            eventType = "delta";
            contentItems.push({
                type: "partial_tool_call",
                name: "",
                arguments: modelOutput.delta,
                tool_call_id: "",
                item_id: modelOutput.item_id,
            });
        }
        else if (minimaxEventType === "response.function_call_arguments.done") {
            // a stop naming the item closes that call
            eventType = "stop";
            contentItems.push({
                type: "partial_tool_call",
                name: "",
                arguments: "",
                tool_call_id: "",
                item_id: modelOutput.item_id,
            });
        }
        else if (minimaxEventType === "response.completed" ||
            minimaxEventType === "response.incomplete") {
            eventType = "stop";
            const response = modelOutput.response;
            const finishReasonMapping = {
                completed: "stop",
                incomplete: "length",
            };
            finishReason = finishReasonMapping[response.status ?? ""] ?? "unknown";
            if (response.usage) {
                // MiniMax drops the detail blocks on truncated responses, so default them to zero.
                const cachedTokens = response.usage.input_tokens_details?.cached_tokens ?? 0;
                const reasoningTokens = response.usage.output_tokens_details?.reasoning_tokens ?? 0;
                usageMetadata = {
                    cached_tokens: cachedTokens,
                    prompt_tokens: response.usage.input_tokens - cachedTokens,
                    thoughts_tokens: reasoningTokens,
                    response_tokens: response.usage.output_tokens - reasoningTokens,
                };
            }
        }
        else if (![
            "response.created",
            "response.in_progress",
            "response.output_text.done",
            "response.reasoning_text.done",
            "response.output_item.done",
            "response.content_part.added",
            "response.content_part.done",
            // gateway heartbeat on long generations; carries no content
            "keepalive",
        ].includes(minimaxEventType) &&
            (0, utils_1.isDebugEnabled)()) {
            throw new Error(`Unknown output: ${JSON.stringify(modelOutput)}`);
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
     * Stream MiniMax Responses events with unified conversion methods.
     */
    async *_streamingResponseInternal(options) {
        const minimaxConfig = this.transformUniConfigToModelConfig(options.config);
        const inputList = this.transformUniMessageToModelInput(options.messages);
        // Calls still streaming, keyed by the item id their fragments carry (the call id when a
        // server sends none): a gateway may open several before closing any of them.
        const openToolCalls = new Map();
        let lastOpened = "";
        const keyOf = (itemId) => itemId && openToolCalls.has(itemId) ? itemId : lastOpened;
        // MiniMax accepts output_text assistant inputs and function tools without OpenAI's required
        // strict field, so narrow the compatibility cast to this boundary.
        const params = {
            ...minimaxConfig,
            input: inputList,
            stream: true,
        };
        const stream = await this._client.responses.create(params, {
            signal: options.signal,
        });
        for await (const event of stream) {
            const uniEvent = this.transformModelOutputToUniEvent(event);
            const fragments = uniEvent.content_items.filter((item) => item.type === "partial_tool_call");
            if (uniEvent.event_type === "start") {
                for (const item of fragments) {
                    lastOpened = item.item_id || item.tool_call_id;
                    openToolCalls.set(lastOpened, {
                        name: item.name,
                        tool_call_id: item.tool_call_id,
                        arguments: "",
                    });
                }
                yield uniEvent;
            }
            else if (uniEvent.event_type === "delta") {
                for (const item of fragments) {
                    const toolCall = openToolCalls.get(keyOf(item.item_id));
                    if (toolCall) {
                        toolCall.arguments += item.arguments;
                    }
                }
                yield uniEvent;
            }
            else if (uniEvent.event_type === "stop") {
                // a stop that names calls closes them; the end of the response closes whatever a
                // gateway never closed on its own
                const closing = fragments.length > 0
                    ? fragments.map((item) => keyOf(item.item_id))
                    : [...openToolCalls.keys()];
                for (const key of closing) {
                    const toolCall = openToolCalls.get(key);
                    if (!toolCall) {
                        continue;
                    }
                    openToolCalls.delete(key);
                    yield {
                        role: "assistant",
                        event_type: "delta",
                        content_items: [
                            {
                                type: "tool_call",
                                name: toolCall.name,
                                arguments: (0, errors_1.parseToolCallArguments)(toolCall.arguments, this.constructor.name, toolCall.name, toolCall.tool_call_id),
                                tool_call_id: toolCall.tool_call_id,
                            },
                        ],
                        usage_metadata: null,
                        finish_reason: null,
                    };
                }
                if (uniEvent.finish_reason || uniEvent.usage_metadata) {
                    yield uniEvent;
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
exports.MiniMaxM3Client = MiniMaxM3Client;
