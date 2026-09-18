import { BetaMessageParam, BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * Anthropic Messages-compatible client implementation.
 */
export declare class AntMessagesClient extends LLMClient {
    protected _model: string;
    private _client;
    /**
     * Initialize Anthropic Messages-compatible client with model, API key, and base URL.
     */
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    /**
     * Convert image URL to an Anthropic image source block.
     */
    private _convertImageUrlToSource;
    /**
     * Convert ThinkingLevel enum to the Messages API thinking config.
     */
    private _convertThinkingLevelToThinkingConfig;
    /**
     * Convert ToolChoice to the Messages API tool_choice format.
     */
    private _convertToolChoice;
    /**
     * Transform universal configuration to Anthropic Messages-compatible configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal message format to the Messages API BetaMessageParam format.
     */
    transformUniMessageToModelInput(messages: UniMessage[], _signal?: AbortSignal): BetaMessageParam[];
    /**
     * Transform a Messages API streaming event to universal event format.
     *
     * NOTE: the Messages API always has only one content item per event.
     */
    transformModelOutputToUniEvent(modelOutput: BetaRawMessageStreamEvent): UniEvent;
    /**
     * Stream generate using an Anthropic Messages-compatible API with unified conversion methods.
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