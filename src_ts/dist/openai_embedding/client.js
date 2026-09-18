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
exports.OpenaiEmbeddingClient = void 0;
const openai_1 = __importDefault(require("openai"));
const baseClient_1 = require("../baseClient");
const errors_1 = require("../errors");
/**
 * OpenAI Embeddings-compatible client implementation.
 */
class OpenaiEmbeddingClient extends baseClient_1.LLMClient {
    /**
     * Initialize OpenAI-compatible embedding client with model, API key, and base URL.
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
     * Transform universal configuration to OpenAI Embeddings configuration.
     */
    transformUniConfigToModelConfig(config) {
        if (config.fast_mode) {
            throw new errors_1.UnsupportedParameterError({
                client: this.constructor.name,
                parameter: "fast_mode",
                message: "OpenAI embeddings do not support fast mode.",
            });
        }
        const params = {
            model: this._model,
        };
        const dimensions = config.embedding_config?.dimensions;
        if (dimensions !== undefined) {
            params.dimensions = dimensions;
        }
        return params;
    }
    /**
     * Transform universal messages to OpenAI Embeddings input strings.
     */
    transformUniMessageToModelInput(messages) {
        const texts = [];
        for (const msg of messages) {
            let msgText = "";
            for (const item of msg.content_items) {
                if (item.type !== "text") {
                    throw new Error("OpenAI embeddings only support text content items.");
                }
                msgText += item.text;
            }
            texts.push(msgText || " ");
        }
        return texts;
    }
    /**
     * Transform OpenAI Embeddings response to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput) {
        return {
            role: "assistant",
            event_type: "stop",
            content_items: modelOutput.data.map((item) => ({
                type: "embedding",
                embedding: item.embedding,
            })),
            usage_metadata: {
                cached_tokens: null,
                prompt_tokens: modelOutput.usage?.prompt_tokens ?? null,
                thoughts_tokens: null,
                response_tokens: null,
            },
            finish_reason: "stop",
        };
    }
    /**
     * Generate embeddings using OpenAI Embeddings-compatible API.
     */
    async *_streamingResponseInternal(options) {
        const params = {
            ...this.transformUniConfigToModelConfig(options.config),
            input: this.transformUniMessageToModelInput(options.messages),
        };
        const result = await this._client.embeddings.create(params, {
            signal: options.signal,
        });
        yield this.transformModelOutputToUniEvent(result);
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
exports.OpenaiEmbeddingClient = OpenaiEmbeddingClient;
