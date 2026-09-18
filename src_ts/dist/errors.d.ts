export declare class AgentHubError extends Error {
    constructor(message: string);
}
/**
 * Raised when a UniConfig parameter value is not supported by the target model client.
 *
 * Thinking levels never raise this by design: every client maps each ThinkingLevel
 * onto the closest level the model supports. Parameters such as temperature and
 * tool_choice may reject unsupported values with this error.
 */
export declare class UnsupportedParameterError extends AgentHubError {
    readonly client: string;
    readonly parameter: string;
    constructor(args: {
        client: string;
        parameter: string;
        message: string;
    });
}
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
export declare class UnsupportedOperationError extends AgentHubError {
    readonly client: string;
    readonly operation: string;
    constructor(args: {
        client: string;
        operation: string;
        message: string;
    });
}
export declare class EmptyResponseError extends AgentHubError {
    readonly client: string;
    readonly finishReason: string | null;
    constructor(args: {
        client: string;
        finishReason: string | null;
    });
}
export declare class ToolCallArgumentParseError extends AgentHubError {
    readonly client: string;
    readonly toolName: string;
    readonly toolCallId: string;
    readonly rawArgumentsLength: number;
    readonly rawArgumentsPreview: string;
    constructor(args: {
        client: string;
        toolName: string;
        toolCallId: string;
        rawArguments: string;
        reason: string;
    });
}
export declare function parseToolCallArguments(rawArguments: string | undefined, client: string, toolName: string, toolCallId: string): Record<string, unknown>;
//# sourceMappingURL=errors.d.ts.map