import { describe, it, expect } from "vitest";
import { extractErrorDetail } from "../src/api/errors.js";

describe("extractErrorDetail", () => {
  it("HTML error extracts h2", () => {
    const text = `
    <html><body>
    <h2>No route matches [POST] "/api/v1/problem_collections"</h2>
    <p>Some long debug info...</p>
    </body></html>
    `;
    const result = extractErrorDetail(404, "text/html; charset=utf-8", text);
    expect(result).toContain("No route matches");
    expect(result).toContain("HTML 에러 응답");
    expect(result.length).toBeLessThan(200);
  });

  it("HTML error extracts h1", () => {
    const text = "<html><h1>Internal Server Error</h1></html>";
    const result = extractErrorDetail(500, "text/html", text);
    expect(result).toContain("Internal Server Error");
  });

  it("HTML error no heading", () => {
    const text = "<html><body>Something went wrong</body></html>";
    const result = extractErrorDetail(500, "text/html", text);
    expect(result).toContain("알 수 없는 에러");
  });

  it("JSON error passthrough", () => {
    const text = '{"errors": [{"detail": "Validation failed"}]}';
    const result = extractErrorDetail(
      422,
      "application/vnd.api+json",
      text
    );
    expect(result).toContain("Validation failed");
  });

  it("long JSON error truncated", () => {
    const text = "x".repeat(2000);
    const result = extractErrorDetail(422, "application/json", text);
    expect(result.length).toBeLessThan(1100);
    expect(result).toMatch(/\.\.\.$/);
  });
});
