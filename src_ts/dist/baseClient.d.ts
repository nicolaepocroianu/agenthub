import { UniConfig, UniEvent, UniMessage } from "./types";
/**
 * Abstract base class for LLM clients.
 *
 * All model-specific clients must inherit from this class and implement
 * the required abstract methods for complete SDK abstraction.
 */
export declare abstract class LLMClient {
    protected _model: string;
    private _history;
    constructor();
    /**
     * Transform universal configuration to model-specific configuration.
     *
     * @param config - Universal configuration object
     * @returns Model-specific configuration object
     */
    abstract transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal message format to model-specific input format.
     *
     * @param messages - List of universal message objects
     * @returns Model-specific input format (e.g., Gemini's Content list, OpenAI's messages array)
     */
    abstract transformUniMessageToModelInput(messages: UniMessage[], signal?: AbortSignal): any;
    /**
     * Transform model output to universal event format.
     *
     * @param modelOutput - Model-specific output object (streaming chunk)
     * @returns Universal event object
     */
    abstract transformModelOutputToUniEvent(modelOutput: any): UniEvent;
    /**
     * Concatenate a stream of universal events into a single universal message.
     *
     * This is a concrete method implemented in the base class that can be reused
     * by all model clients. It accumulates events and builds a complete message.
     *
     * @param events - List of universal events from streaming response
     * @returns Complete universal message object
     */
    concatUniEventsToUniMessage(events: UniEvent[]): UniMessage;
    /**
     * Internal method to handle streaming response.
     *
     * This method should be implemented by each model client to handle
     * the actual streaming request and yield model-specific events.
     *
     * @param options - Object containing messages and config
     * @yields Model-specific events from the streaming response
     */
    abstract _streamingResponseInternal(options: {
        messages: UniMessage[];
        config: UniConfig;
        signal?: AbortSignal;
    }): AsyncGenerator<UniEvent>;
    /**
     * List the model ids the configured endpoint serves.
     *
     * @returns The model ids, in the order the endpoint returned them.
     */
    abstract listModels(): Promise<string[]>;
    /**
     * Generate content in streaming mode (stateless).
     *
     * This method should use transformUniConfigToModelConfig and
     * transformUniMessageToModelInput to prepare the request, then
     * transformModelOutputToUniEvent to convert each chunk.
     *
     * @param options - Object containing messages and config
     * @yields Universal events from the streaming response
     */
    streamingResponse(options: {
        messages: UniMessage[];
        config: UniConfig;
        signal?: AbortSignal;
    }): AsyncGenerator<UniEvent>;
    /**
     * Generate content in streaming mode (stateful).
     *
     * This method should use transformUniConfigToModelConfig,
     * transformUniMessageToModelInput, transformModelOutputToUniEvent,
     * and concatUniEventsToUniMessage to manage the conversation flow.
     *
     * @param message - Latest universal message object to add to conversation
     * @param config - Universal configuration object
     * @yields Universal events from the streaming response
     */
    streamingResponseStateful(options: {
        message: UniMessage;
        config: UniConfig;
        signal?: AbortSignal;
    }): AsyncGenerator<UniEvent>;
    /**
     * Validate that the last event has usage_metadata and finish_reason.
     *
     * This validation guards against servers that silently terminate streaming
     * output partway through without sending a proper final event.
     *
     * @param lastEvent - The last event yielded by streamingResponse
     * @throws Error if lastEvent is null or missing usage_metadata/finish_reason
     */
    protected static _validateLastEvent(lastEvent: UniEvent | null): void;
    /**
     * Validate that the completed response carries content other than thinking.
     *
     * Replaying a thinking-only assistant message on the next turn fails with a 400
     * error, so the response is rejected as soon as the stream completes.
     *
     * @param events - All events yielded by streamingResponse
     * @throws EmptyResponseError if every content item in the response is thinking
     */
    protected _validateNonThinkingOutput(events: UniEvent[]): void;
    /**
     * Clear the message history.
     */
    clearHistory(): void;
    /**
     * Get the current message history.
     *
     * @returns Copy of the current message history
     */
    getHistory(): UniMessage[];
    /**
     * Replace the message history with a copy of the provided history.
     *
     * @param history - List of universal message objects to set as the new history
     */
    setHistory(history: UniMessage[]): void;
}
//# sourceMappingURL=baseClient.d.ts.map