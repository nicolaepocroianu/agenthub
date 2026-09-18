/**
 * Playground for interacting with LLMs.
 *
 * This module provides a web interface for chatting with language models,
 * with support for config editing, streaming responses, and message cards
 * showing token usage and stop reasons.
 */
import { Express } from "express";
/**
 * Create an Express web application for chatting with LLMs.
 *
 * @returns Express application instance
 */
export declare function createChatApp(): Express;
/**
 * Start the playground web server.
 *
 * @param host - Host address to bind to
 * @param port - Port number to listen on
 */
export declare function startPlaygroundServer(host?: string, port?: number): void;
//# sourceMappingURL=playground.d.ts.map