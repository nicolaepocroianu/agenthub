export type Modality = "Text" | "Image" | "Video" | "Audio" | "Embed";
export type Currency = "USD" | "CNY";
/**
 * List prices per million tokens for AgentHub's usage buckets.
 *
 * Keys mirror `usage_metadata`: `cached_tokens` (cache-hit price, absent when
 * the platform publishes none), `prompt_tokens` (non-cached input), and
 * `thoughts_tokens`/`response_tokens`, which both carry the vendor's output
 * price. Values are in the currency requested from listSupportedModels.
 */
export interface ModelPricing {
    currency: Currency;
    prompt_tokens: number;
    thoughts_tokens: number;
    response_tokens: number;
    cached_tokens?: number;
}
/**
 * One supported model entry.
 *
 * (model, base_url, client) maps directly onto the AutoLLMClient constructor:
 * `new AutoLLMClient({ model, baseUrl: base_url, clientType: client })`.
 * Modalities describe what is usable through that client; `context_window` and
 * `pricing` are omitted where the platform publishes no authoritative value.
 *
 * `pricing` is always the LIST price. A running promotion is deliberately not recorded: the
 * registry's job is the catalog price, and applying a promotion is the consumer's.
 */
export interface SupportedModel {
    model: string;
    base_url: string;
    client: string;
    input_modalities: Modality[];
    output_modalities: Modality[];
    context_window?: number;
    pricing?: ModelPricing;
}
/**
 * List supported models with base URL, client, modalities, context window, and
 * pricing.
 *
 * Covers the official vendor endpoints plus the OpenRouter and SiliconFlow
 * platforms; `client` is the `clientType` token that routes the model to its
 * protocol client. Prices are per million tokens for AgentHub's usage buckets
 * (cached_tokens, prompt_tokens, thoughts_tokens, response_tokens), stored in
 * USD and converted to `currency` at 7 CNY/USD on request.
 */
export declare function listSupportedModels(currency?: Currency): SupportedModel[];
//# sourceMappingURL=registry.d.ts.map