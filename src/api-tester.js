export const defaultHeaders = {
  accept: "application/json",
};

export async function request({ url, method = "GET", headers = {}, body } = {}) {
  if (!url) throw new TypeError("url is required");

  const init = {
    method: method.toUpperCase(),
    headers: { ...defaultHeaders, ...headers },
  };

  if (body !== undefined && body !== null && body !== "") {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!init.headers["content-type"] && !init.headers["Content-Type"]) {
      init.headers["content-type"] = "application/json";
    }
  }

  const startedAt = performance.now();
  const response = await fetch(url, init);
  const elapsedMs = Math.round(performance.now() - startedAt);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    url,
    method: init.method,
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    data,
    elapsedMs,
  };
}

export function describe(result) {
  return `${result.method} ${result.url} → ${result.status} ${result.ok ? "OK" : "FAIL"} (${result.elapsedMs}ms)`;
}
