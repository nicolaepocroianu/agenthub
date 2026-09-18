import { OpenaiChatClient } from "../openai_chat";
import { UniConfig } from "../types";
/** Models served through vLLM's OpenAI-compatible Chat Completions API. */
export declare class OpenaiChatVllmAdapterClient extends OpenaiChatClient {
    /**
     * Return the chat_template_kwargs this model's template reads for the level.
     *
     * A model outside the table falls back to Qwen3's enable_thinking, the most widespread
     * of the conventions and inert on a template that ignores the key.
     */
    private _thinkingChatTemplateKwargs;
    /** Map AgentHub's level onto the thinking switch this model's chat template reads. */
    transformUniConfigToModelConfig(config: UniConfig): any;
}
//# sourceMappingURL=client.d.ts.map