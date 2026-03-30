import { createServer, type Server } from "node:http";

const TIMEOUT_MS = 120_000;

const SUCCESS_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Codle CLI</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
<div style="text-align:center">
<h2>로그인 완료</h2>
<p>이 탭을 닫고 터미널로 돌아가세요.</p>
</div></body></html>`;

const ERROR_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Codle CLI</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
<div style="text-align:center">
<h2>로그인 실패</h2>
<p>터미널에서 오류를 확인하세요.</p>
</div></body></html>`;

export interface CallbackResult {
  code: string;
  state: string;
}

export interface CallbackServer {
  port: number;
  redirectUri: string;
  waitForCallback(): Promise<CallbackResult>;
  close(): void;
}

export function startCallbackServer(): Promise<CallbackServer> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer();

    let callbackResolve: (result: CallbackResult) => void;
    let callbackReject: (err: Error) => void;
    const callbackPromise = new Promise<CallbackResult>((res, rej) => {
      callbackResolve = res;
      callbackReject = rej;
    });

    const timeout = setTimeout(() => {
      server.close();
      callbackReject(new Error("로그인 타임아웃 (120초). 다시 시도해주세요."));
    }, TIMEOUT_MS);

    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        const description = url.searchParams.get("error_description") ?? error;
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(ERROR_HTML);
        clearTimeout(timeout);
        server.close();
        callbackReject(new Error(`OAuth 에러: ${description}`));
        return;
      }

      if (!code || !state) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(ERROR_HTML);
        clearTimeout(timeout);
        server.close();
        callbackReject(
          new Error("OAuth 콜백에 code 또는 state가 누락되었습니다."),
        );
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(SUCCESS_HTML);
      clearTimeout(timeout);
      server.close();
      callbackResolve({ code, state });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("콜백 서버 바인딩 실패"));
        return;
      }
      const port = addr.port;
      resolve({
        port,
        redirectUri: `http://127.0.0.1:${port}/callback`,
        waitForCallback: () => callbackPromise,
        close: () => {
          clearTimeout(timeout);
          server.close();
        },
      });
    });

    server.on("error", reject);
  });
}
