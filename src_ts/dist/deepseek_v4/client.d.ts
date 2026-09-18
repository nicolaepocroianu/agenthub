import type { ResponseInputItem, ResponseStreamEvent } from "openai/resources/responses/responses";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * DeepSeek V4-specific LLM client implementation using the OpenAI-compatible Responses API.
 */
export declare class DeepSeekV4Client extends LLMClient {
    protected _model: string;
    private _client;
    /**
     * Initialize DeepSeek client with model, API key, and base URL.
     */
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    /**
     * Convert ThinkingLevel enum to DeepSeek's reasoning effort.
     *
     * DeepSeek accepts low/high/max and maps medium and xhigh onto high server-side
     * (llmsdk_docs/deepseek_v4/docs/thinking-mode.md), so this sends the value the server
     * would settle on anyway. Effort "none" is what turns thinking off on this endpoint:
     * the Chat Completions `thinking` toggle is ignored here (verified live 2026-08-21).
     */
    private _convertThinkingLevelToEffort;
    /**
     * Convert ToolChoice to DeepSeek's Responses-compatible tool_choice format.
     */
    private _convertToolChoice;
    /**
     * Transform universal configuration to DeepSeek-specific configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal message format to DeepSeek's Responses-compatible input format.
     */
    transformUniMessageToModelInput(messages: UniMessage[], _signal?: AbortSignal): ResponseInputItem[];
    /**
     * Transform DeepSeek streaming event to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: ResponseStreamEvent): UniEvent;
    /**
     * Stream generate using DeepSeek's OpenAI-compatible Responses API.
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