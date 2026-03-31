import { logger } from "../logger.js";
import { startCallbackServer } from "./callback-server.js";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "./crypto.js";
import { fetchMetadata } from "./metadata.js";
import { save, type StoredCredentials } from "./token-manager.js";

// AIDEV-NOTE: 매 로그인마다 새 클라이언트를 등록한다.
// 콜백 포트가 동적(port 0)이라 redirect_uri가 매번 달라지므로,
// Doorkeeper의 exact redirect_uri 매칭 정책상 클라이언트 재사용이 불가능하다.
async function registerClient(
  registrationEndpoint: string,
  redirectUri: string,
): Promise<string> {
  const response = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`클라이언트 등록 실패 (HTTP ${response.status}): ${text}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return data.client_id as string;
}

async function exchangeCode(
  tokenEndpoint: string,
  clientId: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`토큰 교환 실패 (HTTP ${response.status}): ${text}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function login(authServerUrl: string): Promise<StoredCredentials> {
  const metadata = await fetchMetadata(authServerUrl);
  logger.debug("OAuth 메타데이터 조회 완료: %s", metadata.issuer);

  const server = await startCallbackServer();
  logger.debug("콜백 서버 시작: %s", server.redirectUri);

  try {
    const clientId = await registerClient(
      metadata.registration_endpoint,
      server.redirectUri,
    );
    logger.debug("클라이언트 등록 완료: %s", clientId);

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    const authorizeUrl = new URL(metadata.authorization_endpoint);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", server.redirectUri);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("scope", "public");

    const { default: open } = await import("open");
    console.error(`브라우저에서 로그인 페이지를 열고 있습니다...`);
    console.error(
      `브라우저가 자동으로 열리지 않으면 아래 URL을 직접 열어주세요:\n${authorizeUrl.toString()}\n`,
    );
    await open(authorizeUrl.toString());

    const callback = await server.waitForCallback();

    if (callback.state !== state) {
      throw new Error(
        "OAuth state 불일치. 보안 위험이 있을 수 있습니다. 다시 시도해주세요.",
      );
    }

    const tokenData = await exchangeCode(
      metadata.token_endpoint,
      clientId,
      callback.code,
      server.redirectUri,
      codeVerifier,
    );

    const credentials: StoredCredentials = {
      auth_server_url: authServerUrl,
      client_id: clientId,
      access_token: tokenData.access_token as string,
      refresh_token: tokenData.refresh_token as string,
      scope: (tokenData.scope as string) ?? "public",
      created_at:
        (tokenData.created_at as number) ?? Math.floor(Date.now() / 1000),
      expires_in: (tokenData.expires_in as number) ?? 7200,
    };

    save(credentials);
    return credentials;
  } finally {
    server.close();
  }
}
