import { OpenaiChatClient } from "../openai_chat";
type Options = ConstructorParameters<typeof OpenaiChatClient>[0];
/** Experimental transport; the caller owns authorization, tools and the agent loop. */
export declare class GitHubCopilotClient extends OpenaiChatClient {
    constructor(options: Options);
    listModels(): Promise<string[]>;
}
export {};
//# sourceMappingURL=client.d.ts.map