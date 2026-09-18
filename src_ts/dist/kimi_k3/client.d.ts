import type { ChatCompletionChunk, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * Kimi K3-specific LLM client implementation using OpenAI-compatible API (also serves K2.5 and K2.6).
 */
export declare class KimiK3Client extends LLMClient {
    protected _model: string;
    private _client;
    /**
     * Initialize Kimi K3 client with model and API key.
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
     * Convert ThinkingLevel enum to the K2-generation thinking configuration.
     */
    private _convertThinkingLevelToThinkingConfig;
    /**
     * Convert ThinkingLevel enum to Kimi K3's reasoning_effort.
     *
     * K3 cannot disable reasoning, so NONE degrades to the lowest effort
     * instead of throwing.
     */
    private _convertThinkingLevelToReasoningEffort;
    /**
     * Convert ToolChoice to OpenAI's tool_choice format.
     */
    private _convertToolChoice;
    /**
     * Transform universal configuration to Kimi K3-specific configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal message format to OpenAI's message format.
     */
    transformUniMessageToModelInput(messages: UniMessage[], signal?: AbortSignal): Promise<ChatCompletionMessageParam[]>;
    /**
     * Transform Kimi K3 model output to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: ChatCompletionChunk): UniEvent;
    /**
     * Stream generate using Kimi SDK with unified conversion methods.
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