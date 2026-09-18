import { LLMClient } from "./baseClient";
import { UniConfig, UniEvent, UniMessage } from "./types";
/**
 * Auto-routing LLM client that dispatches to appropriate model-specific client.
 *
 * This client is stateful - it knows the model name at initialization and maintains
 * conversation history for that specific model.
 */
export declare class AutoLLMClient extends LLMClient {
    private _client;
    private _clientType;
    /**
     * Initialize AutoLLMClient with a specific model.
     *
     * @param options - Configuration object with model, apiKey, baseUrl, and clientType
     */
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    /**
     * Create the appropriate client for the given model.
     *
     * @param model - Model identifier
     * @param apiKey - API key to be passed to the client implementation (unused until clients are implemented)
     * @param baseUrl - Base URL to be passed to the client implementation (unused until clients are implemented)
     * @param clientType - Optional client type override
     * @returns Instance of the appropriate client
     * @throws Error when the requested client is not yet implemented
     */
    private _clientClassForModel;
    private _createClientForModel;
    /**
     * Delegate to underlying client's transformUniConfigToModelConfig.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Delegate to underlying client's transformUniMessageToModelInput.
     */
    transformUniMessageToModelInput(messages: UniMessage[], signal?: AbortSignal): any;
    /**
     * Delegate to underlying client's transformModelOutputToUniEvent.
     */
    transformModelOutputToUniEvent(modelOutput: any): UniEvent;
    /**
     * Not implemented - use streamingResponse instead.
     */
    _streamingResponseInternal(_options: any): AsyncGenerator<UniEvent>;
    /**
     * Route to underlying client's streamingResponse.
     */
    streamingResponse(options: {
        messages: UniMessage[];
        config: UniConfig;
        signal?: AbortSignal;
    }): AsyncGenerator<UniEvent>;
    /**
     * Route to underlying client's streamingResponseStateful.
     */
    streamingResponseStateful(options: {
        message: UniMessage;
        config: UniConfig;
        signal?: AbortSignal;
    }): AsyncGenerator<UniEvent>;
    /**
     * Clear history in the underlying client.
     */
    clearHistory(): void;
    /**
     * Get history from the underlying client.
     */
    getHistory(): UniMessage[];
    /**
     * Set history in the underlying client.
     */
    setHistory(history: UniMessage[]): void;
    /**
     * List the model ids the endpoint serves that the routed client can be used for.
     *
     * A protocol client is chosen explicitly and speaks for whatever the endpoint serves, so
     * its listing is returned whole. A client deduced from a model id serves only the ids that
     * deduce back to it, so a gateway fronting many vendors is filtered down to that client's
     * own models.
     *
     * @returns The model ids, in the order the endpoint returned them.
     */
    listModels(): Promise<string[]>;
}
//# sourceMappingURL=autoClient.d.ts.map