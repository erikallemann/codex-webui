/** Security boundary for the local-only API surface. */

type RequestHeaders = Pick<Headers, "get">;

export interface LocalApiRequest {
  method: string;
  url: string;
  headers: RequestHeaders;
}

export type LocalApiValidation =
  | { ok: true }
  | { ok: false; status: 403 | 415; error: string };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function validateLocalApiRequest(request: LocalApiRequest): LocalApiValidation {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return forbidden("invalid request URL");
  }

  const headerHost = parseHostHeader(request.headers.get("host"));
  if (!isLoopbackHostname(requestUrl.hostname) || !headerHost || !isLoopbackHostname(headerHost.hostname)) {
    return forbidden("API access is restricted to the local loopback interface");
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const expectedOrigin = `${requestUrl.protocol}//${headerHost.host}`;
      if (new URL(origin).origin !== expectedOrigin) {
        return forbidden("cross-origin API requests are not allowed");
      }
    } catch {
      return forbidden("invalid request origin");
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return forbidden("cross-site API requests are not allowed");
  }

  if (!SAFE_METHODS.has(request.method.toUpperCase())) {
    const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (mediaType !== "application/json") {
      return {
        ok: false,
        status: 415,
        error: "API write requests require application/json",
      };
    }
  }

  return { ok: true };
}

function parseHostHeader(host: string | null): { host: string; hostname: string } | null {
  if (!host) return null;
  try {
    const parsed = new URL(`http://${host}`);
    return { host: parsed.host.toLowerCase(), hostname: parsed.hostname.toLowerCase() };
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

function forbidden(error: string): LocalApiValidation {
  return { ok: false, status: 403, error };
}
