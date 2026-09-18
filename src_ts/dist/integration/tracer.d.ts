import { Express } from "express";
import { UniConfig, UniMessage } from "../types";
/**
 * Tracer for saving conversation history to local files.
 *
 * This class handles saving conversation history to files in a cache directory.
 */
export declare class Tracer {
    private cacheDir;
    /**
     * Initialize the tracer.
     *
     * @param cacheDir - Directory to store conversation history files
     */
    constructor(cacheDir?: string);
    /**
     * Ensure directory exists, create if it doesn't.
     *
     * @param dirPath - Directory path to create
     */
    private _ensureDirectoryExists;
    /**
     * Recursively serialize objects for JSON, converting Buffer to base64.
     *
     * @param obj - Object to serialize
     * @returns JSON-serializable object
     */
    private _serializeForJson;
    /**
     * Return whether browsers can usually play this MIME type directly.
     *
     * @param mimeType - MIME type to inspect
     * @returns Whether the browser can typically play the audio type
     */
    private _isBrowserPlayableAudioMimeType;
    /**
     * Decode an inline_data payload to raw bytes.
     *
     * @param item - inline_data content item
     * @returns Raw payload bytes
     */
    private _decodeInlineData;
    /**
     * Wrap raw PCM bytes in a WAV header using Gemini TTS defaults.
     *
     * @param item - inline_data content item
     * @returns WAV bytes
     */
    private _buildWaveBytesFromPcm;
    /**
     * Format inline_data metadata without emitting raw payloads.
     *
     * @param item - inline_data content item
     * @returns Human-readable summary of the inline payload
     */
    private _formatInlineDataSummary;
    private _formatEmbeddingPreview;
    /**
     * Build a data URL for inline_data content.
     *
     * @param item - inline_data content item
     * @returns Data URL string
     */
    private _inlineDataUrl;
    /**
     * Return whether inline_data should be rendered as audio.
     *
     * @param item - inline_data content item
     * @returns Whether the payload is audio
     */
    private _inlineDataIsAudio;
    /**
     * Return the browser-facing audio MIME type after any WAV fallback.
     *
     * @param item - inline_data content item
     * @returns Playable audio MIME type
     */
    private _inlineDataAudioType;
    /**
     * Save conversation history to files.
     *
     * @param history - List of UniMessage objects representing the conversation
     * @param fileId - File identifier without extension (e.g., "agent1/00001")
     * @param config - The UniConfig used for this conversation
     */
    saveHistory(model: string, history: UniMessage[], fileId: string, config: UniConfig): void;
    /**
     * Format conversation history in a readable text format.
     *
     * @param history - List of UniMessage objects
     * @param config - The UniConfig used for this conversation
     * @returns Formatted string representation of the conversation
     */
    private _formatHistory;
    /**
     * Create an Express web application for browsing conversation files.
     *
     * @returns Express application instance
     */
    createWebApp(options?: {
        basePath?: string;
    }): Express;
    /**
     * Normalize the base path used when tracer is mounted inside another app.
     *
     * @param basePath - Optional URL prefix for tracer routes
     * @returns Normalized URL prefix without a trailing slash
     */
    private _normalizeBasePath;
    /**
     * Prefix an internal tracer URL with the mount path.
     *
     * @param basePath - Normalized tracer mount path
     * @param url - Internal URL beginning with /
     * @returns URL safe to render into tracer links
     */
    private _prefixUrl;
    /**
     * Format a Unix timestamp in milliseconds as YYYY-MM-DD HH:MM:SS.
     *
     * @param ms - Unix timestamp in milliseconds
     * @returns Formatted date string
     */
    private _formatTimestamp;
    /**
     * Build the round navigation sidebar HTML.
     *
     * @param totalRounds - Total number of rounds
     * @param history - Full message history array
     * @returns HTML string for the sidebar
     */
    private _buildSidebarHtml;
    /**
     * Escape HTML special characters.
     *
     * @param text - Text to escape
     * @returns Escaped text
     */
    private _escapeHtml;
    /**
     * Start the web server for browsing conversation files.
     *
     * @param host - Host address to bind to
     * @param port - Port number to listen on
     */
    startWebServer(host?: string, port?: number): void;
}
//# sourceMappingURL=tracer.d.ts.map