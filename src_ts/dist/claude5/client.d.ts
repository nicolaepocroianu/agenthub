import { BetaMessageParam, BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * Claude 5-specific LLM client implementation (also serves Claude 4.6 through 4.8).
 */
export declare class Claude5Client extends LLMClient {
    protected _model: string;
    private _client;
    private _use_bedrock;
    /**
     * Initialize Claude 5 client with model and API key.
     */
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    /**
     * Convert image URL to image source.
     *
     * Bedrock does not support image url sources, so we need to fetch the image bytes and encode them.
     */
    private _convertImageUrlToSource;
    /**
     * Convert ThinkingLevel enum to Claude's adaptive thinking config.
     */
    private _convertThinkingLevelToThinkingConfig;
    /**
     * Convert ToolChoice to Claude's tool_choice format.
     */
    private _convertToolChoice;
    /**
     * Transform universal configuration to Claude-specific configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal message format to Claude's MessageParam format.
     */
    transformUniMessageToModelInput(messages: UniMessage[], signal?: AbortSignal): Promise<BetaMessageParam[]>;
    /**
     * Transform Claude model output to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: BetaRawMessageStreamEvent): UniEvent;
    /**
     * Stream generate using Claude SDK with unified conversion methods.
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