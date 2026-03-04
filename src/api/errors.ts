export class CodleAPIError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly detail: string,
  ) {
    super(`Codle API error ${statusCode}: ${detail}`);
    this.name = "CodleAPIError";
  }
}

export function extractErrorDetail(
  statusCode: number,
  contentType: string,
  text: string,
): string {
  if (contentType.includes("text/html")) {
    const match = text.slice(0, 2000).match(/<h[12]>(.*?)<\/h[12]>/);
    const msg = match ? match[1] : "알 수 없는 에러";
    return `HTML 에러 응답 (${statusCode}): ${msg}`;
  }
  if (text.length > 1000) {
    return text.slice(0, 1000) + "...";
  }
  return text;
}
