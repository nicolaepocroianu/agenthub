import OpenAI from "openai";
import type { ChatCompletionChunk, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * OpenAI Chat Completions-compatible client implementation.
 */
export declare class OpenaiChatClient extends LLMClient {
    protected _model: string;
    protected _client: OpenAI;
    /**
     * Initialize OpenAI-compatible chat client with model, API key, and base URL.
     */
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    /**
     * Detect MIME type from URL extension for image.
     */
    private _detectImageMimeType;
    /**
     * Convert image URL to base64-encoded data URL.
     */
    private _convertImageUrlToBase64;
    /**
     * Convert ToolChoice to OpenAI Chat Completions tool_choice format.
     */
    private _convertToolChoice;
    /**
     * Convert a fetched image to an image_url part, at the detail the API needs
     * to read it.
     */
    private _convertImageUrl;
    /**
     * Transform universal configuration to OpenAI Chat Completions configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal message format to OpenAI Chat Completions message format.
     */
    transformUniMessageToModelInput(messages: UniMessage[], signal?: AbortSignal): Promise<ChatCompletionMessageParam[]>;
    /**
     * Transform OpenAI Chat Completions streaming chunk to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: ChatCompletionChunk): UniEvent;
    /**
     * Stream generate using OpenAI Chat Completions-compatible API.
     */
    _streamingResponseInternal(options: {
        messages: UniMessage[];
        config: UniConfig;
        signal?: AbortSignal;
    }): AsyncGenerator<UniEvent>;
    /**
     * List the model ids the configured endpoint serves.
     *
     * @returns The model ids, in the order the endpoint returned them.
     */
    listModels(): Promise<string[]>;
}
//# sourceMappingURL=client.d.ts.map