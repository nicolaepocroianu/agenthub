"use strict";
// Copyright 2025 Prism Shadow. and/or its affiliates
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolCallArgumentParseError = exports.EmptyResponseError = exports.UnsupportedOperationError = exports.UnsupportedParameterError = exports.AgentHubError = void 0;
exports.parseToolCallArguments = parseToolCallArguments;
function previewToolCallArguments(raw) {
    const maxLength = 160;
    if (raw.length <= maxLength) {
        return raw;
    }
    const edgeLength = 72;
    return `${raw.slice(0, edgeLength)}...[truncated]...${raw.slice(-edgeLength)}`;
}
class AgentHubError extends Error {
    constructor(message) {
        super(message);
        this.name = "AgentHubError";
    }
}
exports.AgentHubError = AgentHubError;
/**
 * Raised when a UniConfig parameter value is not supported by the target model client.
 *
 * Thinking levels never raise this by design: every client maps each ThinkingLevel
 * onto the closest level the model supports. Parameters such as temperature and
 * tool_choice may reject unsupported values with this error.
 */
class UnsupportedParameterError extends AgentHubError {
    constructor(args) {
        super(args.message);
        this.name = "UnsupportedParameterError";
        this.client = args.client;
        this.parameter = args.parameter;
    }
}
exports.UnsupportedParameterError = UnsupportedParameterError;
/**
 * Raised when a completed response carries no non-thinking content and no tool calls.
 *
 * Models occasionally finish a turn with thinking output only (reasoning models in
 * particular); replaying such an assistant message on the next turn fails with a 400
 * error, so the response is rejected as soon as the stream completes.
 */
/**
 * Raised when a client cannot perform an operation at all, whatever it is passed.
 *
 * Distinct from UnsupportedParameterError, which rejects a UniConfig parameter value:
 * this one reports a capability the routed client does not have, such as listing models
 * through an SDK client that carries no models endpoint.
 */
class UnsupportedOperationError extends AgentHubError {
    constructor(args) {
        super(args.message);
        this.name = "UnsupportedOperationError";
        this.client = args.client;
        this.operation = args.operation;
    }
}
exports.UnsupportedOperationError = UnsupportedOperationError;
class EmptyResponseError extends AgentHubError {
    constructor(args) {
        super(`${args.client} returned no content other than thinking ` +
            `(finish_reason=${JSON.stringify(args.finishReason)}).`);
        this.name = "EmptyResponseError";
        this.client = args.client;
        this.finishReason = args.finishReason;
    }
}
exports.EmptyResponseError = EmptyResponseError;
class ToolCallArgumentParseError extends AgentHubError {
    constructor(args) {
        const preview = previewToolCallArguments(args.rawArguments);
        super(`Invalid streamed tool call arguments from ${args.client} for tool "${args.toolName}" ` +
            `(tool_call_id="${args.toolCallId}", length=${args.rawArguments.length}, ` +
            `preview=${JSON.stringify(preview)}): ${args.reason}`);
        this.name = "ToolCallArgumentParseError";
        this.client = args.client;
        this.toolName = args.toolName;
        this.toolCallId = args.toolCallId;
        this.rawArgumentsLength = args.rawArguments.length;
        this.rawArgumentsPreview = preview;
    }
}
exports.ToolCallArgumentParseError = ToolCallArgumentParseError;
function parseToolCallArguments(rawArguments, client, toolName, toolCallId) {
    const raw = rawArguments || "{}";
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new ToolCallArgumentParseError({
            client,
            toolName,
            toolCallId,
            rawArguments: raw,
            reason,
        });
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new ToolCallArgumentParseError({
            client,
            toolName,
            toolCallId,
            rawArguments: raw,
            reason: "Expected a JSON object.",
        });
    }
    return parsed;
}
