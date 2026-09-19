/** Experimental Codex device authorization. The caller owns secure storage. */
export const CHATGPT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const ISSUER = "https://auth.openai.com";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

export class ChatGPTAuthorizationError extends Error {
  readonly code = "authentication_error";
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = "ChatGPTAuthorizationError";
  }
}

export interface ChatGPTCredentials {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  expiresAt: number;
}
export type ChatGPTCredentialProvider = (
  signal?: AbortSignal,
) => Promise<ChatGPTCredentials>;

export interface ChatGPTDeviceAuthorization {
  deviceAuthId: string;
  userCode: string;
  intervalMs: number;
  expiresAt: number;
  authorizeUrl: string;
}

async function request(
  path: string,
  body: object | URLSearchParams,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    return await fetch(`${ISSUER}${path}`, {
      method: "POST",
      headers: {
        "Content-Type":
          body instanceof URLSearchParams
            ? "application/x-www-form-urlencoded"
            : "application/json",
      },
      body: body instanceof URLSearchParams ? body : JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch {
    signal?.throwIfAborted();
    throw new Error("ChatGPT authorization could not be reached. Try again.");
  }
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

async function credentials(
  response: Response,
  previous?: ChatGPTCredentials,
): Promise<ChatGPTCredentials> {
  if (!response.ok && ![400, 401, 403].includes(response.status))
    throw Object.assign(
      new Error("ChatGPT authorization is temporarily unavailable. Try again."),
      { status: response.status },
    );
  if (!response.ok)
    throw new ChatGPTAuthorizationError(
      "ChatGPT authorization was rejected. Reconnect your subscription.",
    );
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const accessToken = body.access_token;
    const refreshToken = body.refresh_token ?? previous?.refreshToken;
    let accountId = previous?.accountId;
    if (nonempty(body.id_token)) {
      // Metadata from the issuer's token exchange, never an authorization decision.
      const claims = JSON.parse(
        Buffer.from(body.id_token.split(".")[1], "base64url").toString("utf8"),
      );
      accountId = claims["https://api.openai.com/auth"]?.chatgpt_account_id;
    }
    const lifetime =
      body.expires_in === undefined && nonempty(accessToken)
        ? Number(
            JSON.parse(
              Buffer.from(accessToken.split(".")[1], "base64url").toString(
                "utf8",
              ),
            ).exp,
          ) -
          Date.now() / 1000
        : Number(body.expires_in);
    if (
      !nonempty(accessToken) ||
      !nonempty(refreshToken) ||
      !nonempty(accountId) ||
      !Number.isFinite(lifetime) ||
      lifetime <= 0 ||
      (previous && accountId !== previous.accountId)
    )
      throw new Error();
    return {
      accessToken,
      refreshToken,
      accountId,
      expiresAt: Date.now() + lifetime * 1000,
    };
  } catch {
    throw new ChatGPTAuthorizationError(
      "ChatGPT returned invalid credentials. Reconnect your subscription.",
    );
  }
}

export async function startChatGPTDeviceAuthorization(
  signal?: AbortSignal,
): Promise<ChatGPTDeviceAuthorization> {
  const response = await request(
    "/api/accounts/deviceauth/usercode",
    { client_id: CLIENT_ID },
    signal,
  );
  if (!response.ok)
    throw new Error("ChatGPT device authorization is unavailable. Try again.");
  const body = (await response.json()) as Record<string, unknown>;
  const userCode = body.user_code ?? body.usercode;
  const interval = Number(body.interval ?? 5);
  if (
    !nonempty(body.device_auth_id) ||
    !nonempty(userCode) ||
    !Number.isFinite(interval) ||
    interval < 0
  )
    throw new Error("ChatGPT returned an invalid device authorization.");
  return {
    deviceAuthId: body.device_auth_id,
    userCode,
    intervalMs: Math.max(5, interval) * 1000,
    expiresAt: Date.now() + 900_000,
    authorizeUrl: `${ISSUER}/codex/device`,
  };
}

/** A null result means pending. Callers must respect intervalMs and expiresAt. */
export async function pollChatGPTDeviceAuthorization(
  flow: ChatGPTDeviceAuthorization,
  signal?: AbortSignal,
): Promise<ChatGPTCredentials | null> {
  if (Date.now() >= flow.expiresAt)
    throw new Error("ChatGPT device authorization expired. Start again.");
  const response = await request(
    "/api/accounts/deviceauth/token",
    {
      device_auth_id: flow.deviceAuthId,
      user_code: flow.userCode,
    },
    signal,
  );
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok)
    throw new Error("ChatGPT device authorization failed. Start again.");
  const body = (await response.json()) as Record<string, unknown>;
  if (!nonempty(body.authorization_code) || !nonempty(body.code_verifier))
    throw new Error("ChatGPT returned an invalid authorization response.");
  return credentials(
    await request(
      "/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code: body.authorization_code,
        code_verifier: body.code_verifier,
        redirect_uri: `${ISSUER}/deviceauth/callback`,
      }),
      signal,
    ),
  );
}

/** Serialize refreshes and persist the returned rotation before issuing inference. */
export async function refreshChatGPTCredentials(
  previous: ChatGPTCredentials,
  signal?: AbortSignal,
): Promise<ChatGPTCredentials> {
  return credentials(
    await request(
      "/oauth/token",
      {
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        refresh_token: previous.refreshToken,
      },
      signal,
    ),
    previous,
  );
}
