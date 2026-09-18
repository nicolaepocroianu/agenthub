import type { ResponseInputItem, ResponseStreamEvent } from "openai/resources/responses/responses";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * OpenAI Responses-compatible client implementation.
 */
export declare class OpenaiResponsesClient extends LLMClient {
    protected _model: string;
    private _client;
    /**
     * Initialize OpenAI Responses-compatible client with model, API key, and base URL.
     */
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    /**
     * Convert ThinkingLevel enum to the Responses API reasoning effort.
     */
    private _convertThinkingLevelToEffort;
    /**
     * Convert ToolChoice to the Responses API tool_choice format with allowed tools support.
     */
    private _convertToolChoice;
    /**
     * Convert an image URL to an input_image item, at the detail the API needs
     * to read it.
     */
    private _convertImageUrl;
    /**
     * Transform universal configuration to OpenAI Responses-compatible configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal message format to OpenAI Responses-compatible input format.
     */
    transformUniMessageToModelInput(messages: UniMessage[], _signal?: AbortSignal): ResponseInputItem[];
    /**
     * Transform OpenAI Responses-compatible streaming event to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: ResponseStreamEvent): UniEvent;
    /**
     * Stream generate using an OpenAI Responses-compatible API with unified conversion methods.
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