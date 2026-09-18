import type { ChatCompletionChunk, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { LLMClient } from "../baseClient";
import { UniConfig, UniEvent, UniMessage } from "../types";
/**
 * Unified client for the GLM series, named for the newest generation it serves (5.3).
 *
 * The wire format is shared across GLM-5.1 through 5.3; only the thinking
 * parameter contract differs per generation, handled model-by-model.
 */
export declare class GLM5_3Client extends LLMClient {
    protected _model: string;
    private _client;
    /**
     * Initialize GLM client with model and API key.
     */
    constructor(options: {
        model: string;
        apiKey?: string;
        baseUrl?: string | null;
        clientType?: string | null;
        defaultHeaders?: Record<string, string>;
    });
    /**
     * Convert ThinkingLevel enum to GLM's thinking configuration.
     *
     * GLM-5.3 uses forced thinking and errors on {"type": "disabled"}, so NONE
     * stays enabled there and degrades through the lightest reasoning effort
     * instead (llmsdk_docs/glm5_3/docs/thinking.md).
     */
    private _convertThinkingLevelToConfig;
    /**
     * Convert ThinkingLevel enum to the reasoning_effort the model accepts.
     *
     * GLM-5.3 accepts only low/high/max and errors on anything else, so the
     * client clamps to the closest value; NONE rides on low because 5.3 cannot
     * disable thinking. Every earlier generation takes the vocabulary unchanged:
     * 5.2 maps it server-side (low/medium to high, xhigh to max), and 5.1 and
     * below accept the parameter and ignore it (verified live 2026-09-03 on
     * Z.AI, OpenRouter and SiliconFlow), so the level is forwarded there rather
     * than dropped. Outside 5.3 NONE disables thinking outright, which leaves no
     * effort to send.
     */
    private _convertThinkingLevelToReasoningEffort;
    /**
     * Convert ToolChoice to OpenAI's tool_choice format.
     */
    private _convertToolChoice;
    /**
     * Transform universal configuration to GLM-specific configuration.
     */
    transformUniConfigToModelConfig(config: UniConfig): any;
    /**
     * Transform universal message format to OpenAI's message format.
     */
    transformUniMessageToModelInput(messages: UniMessage[], _signal?: AbortSignal): ChatCompletionMessageParam[];
    /**
     * Transform GLM model output to universal event format.
     */
    transformModelOutputToUniEvent(modelOutput: ChatCompletionChunk): UniEvent;
    /**
     * Stream generate using GLM SDK with unified conversion methods.
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