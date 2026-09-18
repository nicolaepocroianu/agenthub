import { UsageMetadata } from "./types";
/**
 * Fix the usage metadata for OpenRouter.
 *
 * OpenRouter occasionally does not include the reasoning tokens to the completion tokens.
 *
 * @param usageMetadata - The usage metadata.
 * @param baseUrl - The API URL.
 * @returns The fixed usage metadata.
 */
export declare function fixOpenrouterUsageMetadata(usageMetadata: UsageMetadata, baseUrl: string): UsageMetadata;
/**
 * Whether AGENTHUB_DEBUG asks the clients to fail loudly on output they do not recognize.
 *
 * Streaming clients skip an unrecognized event so that a gateway's own frames cannot
 * kill a long generation. The same silence hides a genuinely new provider event, so the
 * guards stay one environment variable away.
 *
 * @returns Whether debug mode is on.
 */
export declare function isDebugEnabled(): boolean;
/** Pixel dimensions read from an image header. */
export interface ImageDimensions {
    width: number;
    height: number;
}
/**
 * Read the pixel dimensions from the header of a PNG, JPEG, GIF or WebP image.
 *
 * Only the header is inspected, so the bytes may be a prefix of the file; a
 * prefix that ends before the dimensions are reached reads as unrecognized.
 *
 * @param bytes - The image bytes, or a prefix of them.
 * @returns The dimensions, or null when the bytes are not a recognized image.
 */
export declare function imageDimensions(bytes: Buffer): ImageDimensions | null;
/**
 * Whether the OpenAI vision API would reject an image at `original` detail.
 *
 * The API covers an image with 32-pixel patches and rejects one that needs
 * more than 30,000 of them after its own resizing; at `original` detail the
 * only resizing is the 65,535-pixel cap on either side. Only a base64 data URL
 * can be measured here: an HTTP(S) URL answers false. The Responses clients
 * pass such a URL through for the API to fetch; the Chat client fetches it
 * into a data URL first, so it measures the fetched bytes.
 *
 * @param imageUrl - The image URL.
 * @returns Whether the API would reject the image.
 */
export declare function exceedsOpenaiPatchLimit(imageUrl: string): boolean;
/**
 * The `detail` an OpenAI image part needs so that the API reads the image.
 *
 * GPT-5.6 reads the default `auto` detail as `original`, which keeps the
 * image's own dimensions and rejects one over 30,000 patches instead of
 * resizing it; `high` has the API fit it into 2,500 patches, so the image is
 * read instead of refused. Every other model keeps a patch budget at every
 * detail level, so no other model gets the field.
 *
 * @param model - The model id the request is sent with.
 * @param imageUrl - The image URL as it goes on the wire.
 * @returns `"high"` when the image needs it, otherwise undefined.
 */
export declare function openaiImageDetail(model: string, imageUrl: string): "high" | undefined;
//# sourceMappingURL=utils.d.ts.map