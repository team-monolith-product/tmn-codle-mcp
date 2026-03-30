export interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
}

export async function fetchMetadata(
  authServerUrl: string,
): Promise<OAuthMetadata> {
  const url = `${authServerUrl}/.well-known/oauth-authorization-server`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `OAuth 메타데이터 조회 실패: ${url} (HTTP ${response.status})`,
    );
  }

  return (await response.json()) as OAuthMetadata;
}
