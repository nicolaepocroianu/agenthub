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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gemini3_8Client = void 0;
const genai_1 = require("@google/genai");
const path = __importStar(require("path"));
const baseClient_1 = require("../baseClient");
const errors_1 = require("../errors");
const types_1 = require("../types");
const utils_1 = require("../utils");
/**
 * Wrap a part's thought signature as a fidelity payload, or nothing when absent.
 */
function partFidelity(part) {
    if (part.thoughtSignature == null) {
        return {};
    }
    return { fidelity: { signature: part.thoughtSignature } };
}
/**
 * Read the thought signature recorded in an item's fidelity payload.
 */
function itemThoughtSignature(item) {
    return item.fidelity?.signature;
}
/**
 * Split a message's parts into consecutive runs of functionResponse and
 * non-functionResponse parts, preserving order. Vertex AI requires function
 * responses to sit in a content of their own (see the call site); a message
 * without function responses — or with nothing else — comes back as one run.
 */
function splitFunctionResponseRuns(parts) {
    const runs = [];
    let lastIsResponse = null;
    for (const part of parts) {
        const isResponse = part.functionResponse !== undefined;
        if (isResponse !== lastIsResponse) {
            runs.push([]);
            lastIsResponse = isResponse;
        }
        runs[runs.length - 1].push(part);
    }
    return runs.length > 0 ? runs : [parts];
}
/**
 * Unified client for the Gemini family, named for the newest generation it
 * serves (3.8). It serves every generateContent model generation (3.8 back
 * through 3.x text, image, TTS, and embedding models), and applies the
 * 3.6-generation parameter contract to the whole family: temperature is
 * rejected everywhere.
 *
 * Starting with the 3.6 generation the API deprecates the temperature/top_p/top_k
 * sampling parameters (silently ignored today, HTTP 400 in future
 * generations), so this client rejects them instead of sending a no-op.
 */
class Gemini3_8Client extends baseClient_1.LLMClient {
    /**
     * Initialize Gemini 3.8 client with model and API key.
     */
    constructor(options) {
        super();
        this._model = options.model;
        const key = options.apiKey || process.env.GEMINI_API_KEY || undefined;
        const url = options.baseUrl || process.env.GEMINI_BASE_URL || undefined;
        // the Gemini SDK carries connection headers inside httpOptions rather than its own argument
        const httpOptions = {};
        if (url) {
            httpOptions.baseUrl = url;
        }
        if (options.defaultHeaders) {
            httpOptions.headers = options.defaultHeaders;
        }
        if (key && key.startsWith("{")) {
            const credentials = JSON.parse(key);
            const googleAuthOptions = {
                credentials,
                scopes: ["https://www.googleapis.com/auth/cloud-platform"],
            };
            this._client = new genai_1.GoogleGenAI({
                vertexai: true,
                location: "global",
                project: credentials.project_id,
                googleAuthOptions,
                httpOptions,
            });
        }
        else {
            this._client = new genai_1.GoogleGenAI({
                apiKey: key,
                httpOptions,
            });
        }
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
     * Get image bytes and MIME type from URL.
     */
    async _getImageBytesAndMimeType(url, signal) {
        if (url.startsWith("data:")) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                const mimeType = match[1];
                const base64Data = match[2];
                const data = Buffer.from(base64Data, "base64");
                return { data, mimeType };
            }
            else {
                throw new Error(`Invalid base64 image: ${url}`);
            }
        }
        else {
            const response = await fetch(url, { signal });
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${url}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const data = Buffer.from(arrayBuffer);
            const mimeType = this._detectImageMimeType(url);
            return { data, mimeType };
        }
    }
    /**
     * Thinking levels the target model accepts (llmsdk_docs/gemini3_8/docs/thinking.md).
     *
     * An empty array means the model rejects the thinking_level parameter
     * entirely, so it must be omitted from the request.
     */
    _supportedThinkingLevels() {
        if (this._model.includes("-image")) {
            return [genai_1.ThinkingLevel.MINIMAL, genai_1.ThinkingLevel.HIGH];
        }
        if (this._model.includes("gemini-3-pro")) {
            // The only pro generation without "medium".
            return [genai_1.ThinkingLevel.LOW, genai_1.ThinkingLevel.HIGH];
        }
        if (this._model.includes("-pro")) {
            // Every pro generation rejects "minimal"; matching broadly keeps
            // future pro models on the safe side (clamping a level the model
            // would have accepted costs a little accuracy, forwarding an
            // unsupported one is a 400).
            return [
                genai_1.ThinkingLevel.LOW,
                genai_1.ThinkingLevel.MEDIUM,
                genai_1.ThinkingLevel.HIGH,
            ];
        }
        if (this._model.includes("gemini-3.7") ||
            this._model.includes("gemini-3.8")) {
            // Both generations reject "minimal" with a 400 (3.7 verified live 2026-08-13;
            // 3.8 documented at ai.google.dev/gemini-api/docs/latest-model).
            return [
                genai_1.ThinkingLevel.LOW,
                genai_1.ThinkingLevel.MEDIUM,
                genai_1.ThinkingLevel.HIGH,
            ];
        }
        return Gemini3_8Client.GEMINI_LEVEL_ORDER;
    }
    /**
     * Convert ThinkingLevel enum to the closest Gemini ThinkingLevel the model supports.
     */
    _convertThinkingLevel(thinkingLevel) {
        if (!thinkingLevel)
            return undefined;
        const mapping = {
            [types_1.ThinkingLevel.NONE]: genai_1.ThinkingLevel.MINIMAL,
            [types_1.ThinkingLevel.LOW]: genai_1.ThinkingLevel.LOW,
            [types_1.ThinkingLevel.MEDIUM]: genai_1.ThinkingLevel.MEDIUM,
            [types_1.ThinkingLevel.HIGH]: genai_1.ThinkingLevel.HIGH,
            [types_1.ThinkingLevel.XHIGH]: genai_1.ThinkingLevel.HIGH,
            // Gemini stops at "high", so both top levels land there before per-model clamping
            [types_1.ThinkingLevel.MAX]: genai_1.ThinkingLevel.HIGH,
        };
        const level = mapping[thinkingLevel];
        if (level === undefined) {
            return undefined;
        }
        const supported = this._supportedThinkingLevels();
        if (supported.length === 0) {
            // A model that takes no thinking_level at all has nothing to clamp onto, so the
            // parameter is omitted rather than turned into a failed request. thinking_summary
            // is unaffected -- includeThoughts still rides along.
            return undefined;
        }
        if (supported.includes(level)) {
            return level;
        }
        // Degrade silently to the nearest supported level; ties round up,
        // e.g. MEDIUM becomes HIGH on gemini-3-pro and NONE maps to LOW on
        // gemini-3.7-flash. `supported` is non-empty here, so the
        // initial-value-less reduce cannot throw.
        const order = Gemini3_8Client.GEMINI_LEVEL_ORDER;
        const index = order.indexOf(level);
        return supported.reduce((best, candidate) => {
            const bestDistance = Math.abs(order.indexOf(best) - index);
            const candidateDistance = Math.abs(order.indexOf(candidate) - index);
            if (candidateDistance !== bestDistance) {
                return candidateDistance < bestDistance ? candidate : best;
            }
            return order.indexOf(candidate) > order.indexOf(best) ? candidate : best;
        });
    }
    /**
     * Convert ToolChoice to Gemini's tool config.
     */
    _convertToolChoice(toolChoice) {
        if (Array.isArray(toolChoice)) {
            return {
                mode: "ANY",
                allowedFunctionNames: toolChoice,
            };
        }
        else if (toolChoice === "none") {
            return { mode: "NONE" };
        }
        else if (toolChoice === "auto") {
            return { mode: "AUTO" };
        }
        else if (toolChoice === "required") {
            return { mode: "ANY" };
        }
        return undefined;
    }
    _withAbortSignal(config, signal) {
        if (!signal) {
            return config;
        }
        return { ...(config ?? {}), abortSignal: signal };
    }
    /**
     * Transform universal configuration to Gemini-specific configuration.
     */
    transformUniConfigToModelConfig(config) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const configParams = {};
        if (config.temperature !== undefined) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "temperature",
                message: "Gemini models do not support setting temperature; the API deprecated " +
                    "sampling parameters starting with the 3.6 generation.",
            });
        }
        if (config.fast_mode) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "fast_mode",
                message: "Gemini does not support fast mode.",
            });
        }
        if (config.prompt_caching !== undefined &&
            config.prompt_caching !== types_1.PromptCaching.ENABLE) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "prompt_caching",
                message: "prompt_caching must be ENABLE for Gemini.",
            });
        }
        if (config.max_tokens !== undefined) {
            configParams.maxOutputTokens = config.max_tokens;
        }
        // A TTS model takes the speech settings and nothing else: a system instruction, a
        // thinking config, or a tool declaration each comes back as a 400 (verified live
        // 2026-08-20), so the rest of the universal config never reaches the request.
        if (this._model.toLowerCase().includes("tts")) {
            configParams.responseModalities = ["AUDIO"];
            const ttsConfig = config.tts_config ?? [{ voice: "Kore" }];
            if (![1, 2].includes(ttsConfig.length)) {
                throw new Error("tts_config must contain 1 or 2 entries.");
            }
            if (ttsConfig.length === 1) {
                configParams.speechConfig = {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: ttsConfig[0].voice,
                        },
                    },
                };
            }
            else {
                const speakerVoiceConfigs = ttsConfig.map((speakerConfig) => {
                    if (!speakerConfig.speaker) {
                        throw new Error("speaker is required when tts_config has 2 entries.");
                    }
                    return {
                        speaker: speakerConfig.speaker,
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: speakerConfig.voice,
                            },
                        },
                    };
                });
                configParams.speechConfig = {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs,
                    },
                };
            }
            return configParams;
        }
        if (config.system_prompt !== undefined) {
            configParams.systemInstruction = config.system_prompt;
        }
        // includeThoughts asks for thought summaries, but whether generateContent returns any
        // is model-dependent (llmsdk_docs/gemini3_8/docs/thinking.md)
        const thinkingSummary = config.thinking_summary;
        const thinkingLevel = config.thinking_level;
        if (thinkingSummary !== undefined || thinkingLevel !== undefined) {
            configParams.thinkingConfig = {
                includeThoughts: thinkingSummary,
                thinkingLevel: this._convertThinkingLevel(thinkingLevel),
            };
        }
        if (config.tools !== undefined) {
            configParams.tools = [{ functionDeclarations: config.tools }];
            const toolChoice = config.tool_choice;
            if (toolChoice !== undefined) {
                const toolConfig = this._convertToolChoice(toolChoice);
                if (toolConfig) {
                    configParams.toolConfig = {
                        functionCallingConfig: toolConfig,
                    };
                }
            }
        }
        if (config.image_config !== undefined) {
            configParams.imageConfig = {
                aspectRatio: config.image_config.aspect_ratio,
                imageSize: config.image_config.image_size,
            };
        }
        return Object.keys(configParams).length > 0
            ? configParams
            : undefined;
    }
    /**
     * Transform universal message format to Gemini's Content format.
     */
    async transformUniMessageToModelInput(messages, signal) {
        const mapping = {
            user: "user",
            assistant: "model",
        };
        const contents = [];
        // The generateContent API wants both the call id and the function name on a function
        // response, but a universal tool_result carries only the id, so remember each call's name.
        const callNames = new Map();
        for (const msg of messages) {
            const parts = [];
            for (const item of msg.content_items) {
                if (item.type === "text") {
                    parts.push({
                        text: item.text,
                        thoughtSignature: itemThoughtSignature(item),
                    });
                }
                else if (item.type === "image_url") {
                    const urlValue = item.image_url;
                    const imageData = await this._getImageBytesAndMimeType(urlValue, signal);
                    parts.push({
                        inlineData: {
                            mimeType: imageData.mimeType,
                            data: imageData.data.toString("base64"),
                        },
                    });
                }
                else if (item.type === "inline_data") {
                    parts.push({
                        inlineData: {
                            mimeType: item.mime_type,
                            data: item.data.toString("base64"),
                        },
                        thoughtSignature: itemThoughtSignature(item),
                    });
                }
                else if (item.type === "thinking") {
                    parts.push({
                        text: item.thinking,
                        thought: true,
                        thoughtSignature: itemThoughtSignature(item),
                    });
                }
                else if (item.type === "inline_thinking") {
                    parts.push({
                        inlineData: {
                            mimeType: item.mime_type,
                            data: item.data.toString("base64"),
                        },
                        thought: true,
                        thoughtSignature: itemThoughtSignature(item),
                    });
                }
                else if (item.type === "tool_call") {
                    callNames.set(item.tool_call_id, item.name);
                    // Histories from before ids were stored carry the name as the tool_call_id;
                    // replay those without an id, exactly as they arrived.
                    const functionCall = {
                        ...(item.tool_call_id !== item.name
                            ? { id: item.tool_call_id }
                            : {}),
                        name: item.name,
                        args: item.arguments,
                    };
                    parts.push({
                        functionCall: functionCall,
                        thoughtSignature: itemThoughtSignature(item),
                    });
                }
                else if (item.type === "tool_result") {
                    if (!item.tool_call_id) {
                        throw new Error("tool_call_id is required for tool result.");
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const toolResult = { result: item.text };
                    const multimodalParts = [];
                    if (item.images) {
                        for (const imageUrl of item.images) {
                            const imageData = await this._getImageBytesAndMimeType(imageUrl, signal);
                            multimodalParts.push({
                                inlineData: {
                                    mimeType: imageData.mimeType,
                                    data: imageData.data.toString("base64"),
                                },
                            });
                        }
                    }
                    const functionName = callNames.get(item.tool_call_id) ?? item.tool_call_id;
                    parts.push({
                        functionResponse: {
                            ...(item.tool_call_id !== functionName
                                ? { id: item.tool_call_id }
                                : {}),
                            name: functionName,
                            response: toolResult,
                            parts: multimodalParts.length > 0 ? multimodalParts : undefined,
                        },
                    });
                }
                else {
                    throw new Error(`Unknown item: ${JSON.stringify(item)}`);
                }
            }
            // Vertex AI rejects a content that mixes functionResponse parts with any other
            // part kind — the request fails with a misleading 400, "Requests ending with a
            // model turn are not supported" (the Gemini API endpoint accepts the mix). Split
            // such a message into consecutive same-role contents: each run of function
            // responses becomes its own content, the surrounding parts keep theirs, and the
            // part order is preserved. Homogeneous messages stay a single content.
            for (const runParts of splitFunctionResponseRuns(parts)) {
                contents.push({
                    role: mapping[msg.role],
                    parts: runParts,
                });
            }
        }
        return contents;
    }
    /**
     * Transform Gemini model output to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput) {
        let eventType = "delta";
        const contentItems = [];
        let usageMetadata = null;
        let finishReason = null;
        if (modelOutput.candidates?.length !== undefined &&
            modelOutput.candidates?.length > 0) {
            const candidate = modelOutput.candidates?.[0];
            for (const part of candidate.content?.parts || []) {
                if (part.functionCall) {
                    contentItems.push({
                        type: "tool_call",
                        name: part.functionCall.name || "",
                        arguments: part.functionCall.args || {},
                        tool_call_id: part.functionCall.id || part.functionCall.name || "",
                        ...partFidelity(part),
                    });
                }
                else if (part.thought) {
                    if (part.text !== undefined) {
                        contentItems.push({
                            type: "thinking",
                            thinking: part.text,
                            ...partFidelity(part),
                        });
                    }
                    else if (part.inlineData) {
                        contentItems.push({
                            type: "inline_thinking",
                            data: Buffer.from(part.inlineData.data || "", "base64"),
                            mime_type: part.inlineData.mimeType || "application/octet-stream",
                            ...partFidelity(part),
                        });
                    }
                }
                else if (part.inlineData) {
                    contentItems.push({
                        type: "inline_data",
                        data: Buffer.from(part.inlineData.data || "", "base64"),
                        mime_type: part.inlineData.mimeType || "application/octet-stream",
                        ...partFidelity(part),
                    });
                }
                else if (part.text !== undefined) {
                    contentItems.push({
                        type: "text",
                        text: part.text,
                        ...partFidelity(part),
                    });
                }
                else if ((0, utils_1.isDebugEnabled)()) {
                    throw new Error(`Unknown output: ${JSON.stringify(part)}`);
                }
            }
            if (candidate.finishReason) {
                eventType = "stop";
                const stopReasonMapping = {
                    [genai_1.FinishReason.STOP]: "stop",
                    [genai_1.FinishReason.MAX_TOKENS]: "length",
                };
                finishReason = stopReasonMapping[candidate.finishReason] || "unknown";
            }
        }
        if (modelOutput.usageMetadata) {
            eventType = eventType || "delta"; // deal with separate usage data
            const promptTokens = modelOutput.usageMetadata.promptTokenCount || 0;
            const cachedTokens = modelOutput.usageMetadata.cachedContentTokenCount || 0;
            usageMetadata = {
                cached_tokens: modelOutput.usageMetadata.cachedContentTokenCount || null,
                prompt_tokens: promptTokens - cachedTokens,
                thoughts_tokens: modelOutput.usageMetadata.thoughtsTokenCount || null,
                response_tokens: modelOutput.usageMetadata.candidatesTokenCount || null,
            };
        }
        if (contentItems.length === 0 &&
            usageMetadata === null &&
            finishReason === null) {
            // nothing was read out of the chunk, so there is nothing to emit: a gateway
            // heartbeat looks like this, and so does any other chunk we take no value from
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
    async *_embedMessagesInternal(options) {
        // Embed transformed messages and return them as a streaming event.
        const contents = await this.transformUniMessageToModelInput(options.messages, options.signal);
        const geminiConfig = this._withAbortSignal(options.config.embedding_config?.dimensions != null
            ? {
                outputDimensionality: options.config.embedding_config.dimensions,
            }
            : undefined, options.signal);
        const result = await this._client.models.embedContent({
            model: this._model,
            contents,
            config: geminiConfig,
        });
        yield {
            role: "assistant",
            event_type: "stop",
            content_items: result.embeddings?.map((embedding) => ({
                type: "embedding",
                embedding: embedding.values ?? [],
            })) ?? [],
            usage_metadata: {
                cached_tokens: null,
                prompt_tokens: result.metadata?.billableCharacterCount ?? null,
                thoughts_tokens: null,
                response_tokens: null,
            },
            finish_reason: "stop",
        };
    }
    /**
     * Stream generate using Gemini SDK with unified conversion methods.
     */
    async *_streamingResponseInternal(options) {
        if (this._model.toLowerCase().includes("embedding")) {
            for await (const event of this._embedMessagesInternal(options)) {
                yield event;
            }
            return;
        }
        // A TTS model synthesizes a single text turn: a conversation comes back as "Multiturn chat
        // is not enabled for this model" and an audio part as "Audio input modality is not enabled
        // for this model" (verified live 2026-08-20), so only the newest message is sent and the
        // audio a stateful session records stays out of the request.
        let messages = options.messages;
        if (this._model.toLowerCase().includes("tts")) {
            messages = messages.slice(-1);
            const invalidItem = messages
                .flatMap((message) => message.content_items)
                .find((item) => item.type !== "text");
            if (invalidItem) {
                throw new Error(`Gemini TTS only supports text input, got content item type=${JSON.stringify(invalidItem.type)}.`);
            }
        }
        const geminiConfig = this._withAbortSignal(this.transformUniConfigToModelConfig(options.config), options.signal);
        const contents = await this.transformUniMessageToModelInput(messages, options.signal);
        const responseStream = await this._client.models.generateContentStream({
            model: this._model,
            contents: contents,
            config: geminiConfig,
        });
        for await (const chunk of responseStream) {
            const event = this.transformModelOutputToUniEvent(chunk);
            if (event.event_type === "unused") {
                continue;
            }
            for (const item of event.content_items) {
                if (item.type === "tool_call") {
                    // the Gemini API does not stream partial tool calls, mock a partial tool call event
                    yield {
                        role: "assistant",
                        event_type: "delta",
                        content_items: [
                            {
                                type: "partial_tool_call",
                                name: item.name,
                                arguments: JSON.stringify(item.arguments),
                                tool_call_id: item.tool_call_id,
                                fidelity: item.fidelity,
                            },
                        ],
                        usage_metadata: null,
                        finish_reason: null,
                    };
                }
            }
            yield event;
        }
    }
    /**
     * List the model ids the configured endpoint serves.
     *
     * @returns The model ids, in the order the endpoint returned them.
     */
    async listModels() {
        const models = [];
        for await (const model of await this._client.models.list()) {
            // the API returns path-qualified names: models/gemini-3.7-flash,
            // publishers/google/models/gemini-3.7-flash
            const id = model.name?.split("/").pop();
            if (id) {
                models.push(id);
            }
        }
        return models;
    }
}
exports.Gemini3_8Client = Gemini3_8Client;
// Gemini thinking levels from weakest to strongest, used to pick the
// closest supported level when a model rejects the requested one.
Gemini3_8Client.GEMINI_LEVEL_ORDER = [
    genai_1.ThinkingLevel.MINIMAL,
    genai_1.ThinkingLevel.LOW,
    genai_1.ThinkingLevel.MEDIUM,
    genai_1.ThinkingLevel.HIGH,
];
