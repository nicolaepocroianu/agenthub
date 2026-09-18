import { Content, GenerateContentConfig, GenerateContentResponse } from "@google/genai";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * Unified client for the Gemini family, named for the newest generation it
 * serves (3.8). It serves every generateContent model generation (3.8 back
 * through 3.x text, image, TTS, and embedding models), and applies the
 * 3.6-generation parameter contract to the whole family: temperature is
 * rejected everywhere.
 *
 * Starting with the 3.6 generation the API deprecates the temperature/top_p/top_k
 * sampling parameters (silently ignored today, HTTP 400 in future
 * generations), so this client rejects them instead of sending a no-op.
 */
export declare class Gemini3_8Client extends LLMClient {
    protected _model: string;
    private _client;
    /**
     * Initialize Gemini 3.8 client with model and API key.
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
     * Get image bytes and MIME type from URL.
     */
    private _getImageBytesAndMimeType;
    private static readonly GEMINI_LEVEL_ORDER;
    /**
     * Thinking levels the target model accepts (llmsdk_docs/gemini3_8/docs/thinking.md).
     *
     * An empty array means the model rejects the thinking_level parameter
     * entirely, so it must be omitted from the request.
     */
    private _supportedThinkingLevels;
    /**
     * Convert ThinkingLevel enum to the closest Gemini ThinkingLevel the model supports.
     */
    private _convertThinkingLevel;
    /**
     * Convert ToolChoice to Gemini's tool config.
     */
    private _convertToolChoice;
    private _withAbortSignal;
    /**
     * Transform universal configuration to Gemini-specific configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): GenerateContentConfig | undefined;
    /**
     * Transform universal message format to Gemini's Content format.
     */
    transformUniMessageToModelInput(messages: UniMessage[], signal?: AbortSignal): Promise<Content[]>;
    /**
     * Transform Gemini model output to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: GenerateContentResponse): UniEvent;
    private _embedMessagesInternal;
    /**
     * Stream generate using Gemini SDK with unified conversion methods.
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