import type { CreateEmbeddingResponse, EmbeddingCreateParams } from "openai/resources/embeddings";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * OpenAI Embeddings-compatible client implementation.
 */
export declare class OpenaiEmbeddingClient extends LLMClient {
    protected _model: string;
    private _client;
    /**
     * Initialize OpenAI-compatible embedding client with model, API key, and base URL.
     */
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    /**
     * Transform universal configuration to OpenAI Embeddings configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): Omit<EmbeddingCreateParams, "input">;
    /**
     * Transform universal messages to OpenAI Embeddings input strings.
     */
    transformUniMessageToModelInput(messages: UniMessage[]): string[];
    /**
     * Transform OpenAI Embeddings response to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: CreateEmbeddingResponse): UniEvent;
    /**
     * Generate embeddings using OpenAI Embeddings-compatible API.
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