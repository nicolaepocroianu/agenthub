import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/** MiniMax M3 client using MiniMax's Responses API. */
export declare class MiniMaxM3Client extends LLMClient {
    protected _model: string;
    private _client;
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    private _convertThinkingLevelToEffort;
    private _convertToolChoice;
    /**
     * Transform universal configuration to MiniMax's Responses API payload.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal messages to MiniMax Responses input items.
     */
    transformUniMessageToModelInput(messages: UniMessage[]): any[];
    /**
     * Transform a MiniMax streaming event to AgentHub's universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: ResponseStreamEvent): UniEvent;
    /**
     * Stream MiniMax Responses events with unified conversion methods.
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