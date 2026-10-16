export type RequestOptions = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type RequestResult = {
  url: string;
  method: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  data: unknown;
  elapsedMs: number;
};

export const defaultHeaders = {
  accept: "application/json",
};

export async function request({ url, method = "GET", headers = {}, body }: RequestOptions): Promise<RequestResult> {
  if (!url) throw new TypeError("url is required");

  const init: RequestInit = {
    method: method.toUpperCase(),
    headers: { ...defaultHeaders, ...headers },
  };

  if (body !== undefined && body !== null && body !== "") {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    const requestHeaders = init.headers as Record<string, string>;
    if (!requestHeaders["content-type"] && !requestHeaders["Content-Type"]) {
      requestHeaders["content-type"] = "application/json";
    }
  }

  const startedAt = performance.now();
  const response = await fetch(url, init);
  const elapsedMs = Math.round(performance.now() - startedAt);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  return {
    url,
    method: init.method as string,
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    data,
    elapsedMs,
  };
}

export function describe(result: RequestResult): string {
  return `${result.method} ${result.url} → ${result.status} ${result.ok ? "OK" : "FAIL"} (${result.elapsedMs}ms)`;
}
