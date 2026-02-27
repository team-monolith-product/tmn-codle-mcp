import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  accessToken: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getAccessToken(): string | undefined {
  return requestContext.getStore()?.accessToken;
}
