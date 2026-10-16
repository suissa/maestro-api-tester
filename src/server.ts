import http from "node:http";

export type Route = {
  method: string;
  path: string;
  description: string;
};

export const routes: Route[] = [
  { method: "GET", path: "/health", description: "Health check" },
  { method: "GET", path: "/routes", description: "Route catalog" },
  { method: "GET", path: "/echo", description: "Echo query parameters" },
  { method: "POST", path: "/echo", description: "Echo JSON body" },
];

function sendJson(response: http.ServerResponse, status: number, value: unknown): void {
  const payload = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  return JSON.parse(text);
}

export function createServer(): http.Server {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true, service: "maestro-api-tester" });
    }

    if (request.method === "GET" && url.pathname === "/routes") {
      return sendJson(response, 200, { routes });
    }

    if (request.method === "GET" && url.pathname === "/echo") {
      return sendJson(response, 200, {
        method: request.method,
        query: Object.fromEntries(url.searchParams.entries()),
      });
    }

    if (request.method === "POST" && url.pathname === "/echo") {
      try {
        const body = await readJson(request);
        return sendJson(response, 200, { method: request.method, body });
      } catch {
        return sendJson(response, 400, { error: "invalid JSON" });
      }
    }

    return sendJson(response, 404, { error: "route not found" });
  });
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`Maestro API Tester listening on http://127.0.0.1:${port}`);
  });
}
