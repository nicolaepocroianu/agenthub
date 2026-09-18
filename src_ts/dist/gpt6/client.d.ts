import type { ResponseInputItem, ResponseStreamEvent } from "openai/resources/responses/responses";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * GPT-6-specific LLM client implementation (also serves GPT-5.6, GPT-5.5 and GPT-5.4).
 */
export declare class GPT6Client extends LLMClient {
    protected _model: string;
    private _client;
    /**
     * Initialize GPT-6 client with model and API key.
     */
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    /**
     * Convert ThinkingLevel enum to OpenAI's reasoning effort.
     */
    private _convertThinkingLevelToEffort;
    /**
     * Convert ToolChoice to OpenAI's tool_choice format with allowed tools support.
     */
    private _convertToolChoice;
    /**
     * Convert an image URL to an input_image item, at the detail the API needs
     * to read it.
     */
    private _convertImageUrl;
    /**
     * Transform universal configuration to OpenAI Responses API configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal message format to OpenAI Responses API input format.
     */
    transformUniMessageToModelInput(messages: UniMessage[], _signal?: AbortSignal): ResponseInputItem[];
    /**
     * Transform OpenAI Responses API streaming event to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: ResponseStreamEvent): UniEvent;
    /**
     * Stream generate using OpenAI Responses API with unified conversion methods.
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