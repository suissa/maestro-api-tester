import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { promisify } from "node:util";
import testRunner from "node:test";

const execFileAsync = promisify(execFile);

testRunner(
  "all advanced test modes execute the CLI and return valid reports",
  async (t) => {
    const server = createServer((request, response) => {
      response.writeHead(request.url === "/failure" ? 500 : 200, {
        "content-type": "application/json",
        "content-security-policy": "default-src 'self'",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "permissions-policy": "camera=()",
        "strict-transport-security": "max-age=31536000",
      });
      response.end(JSON.stringify({ ok: true }));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => server.close());

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/health`;
    const run = async (args: string[], targetUrl = url) => {
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          "src/advanced-tests.ts",
          "--url",
          targetUrl,
          ...args,
        ],
        {
          encoding: "utf8",
          timeout: 15_000,
          env: {
            ...process.env,
            HTTP_PROXY: "",
            HTTPS_PROXY: "",
            ALL_PROXY: "",
            http_proxy: "",
            https_proxy: "",
            all_proxy: "",
            NO_PROXY: "127.0.0.1,localhost",
            no_proxy: "127.0.0.1,localhost",
            NODE_USE_ENV_PROXY: "0",
          },
        },
      );
      return JSON.parse(stdout) as
        Record<string, unknown> | Array<Record<string, unknown>>;
    };
    const assertReport = (report: Record<string, unknown>, kind: string) => {
      assert.equal(report.kind, kind);
      assert.ok(
        Number(report.requests) > 0,
        `${kind} should execute at least one request`,
      );
      assert.ok(
        Number(report.successes) > 0,
        `${kind} should record successful responses`,
      );
      assert.equal(typeof report.requestsPerSecond, "number");
      assert.equal(typeof report.latencyMs, "object");
      assert.equal(typeof report.statusCodes, "object");
    };

    await t.test("load", async () => {
      const report = await run([
        "--type",
        "load",
        "--duration",
        "0.1",
        "--concurrency",
        "2",
      ]);
      assert.ok(!Array.isArray(report));
      assertReport(report, "load");
    });

    await t.test(
      "fail-on-error exits unsuccessfully for HTTP failures",
      async () => {
        await assert.rejects(
          run(
            [
              "--type",
              "benchmark",
              "--requests",
              "1",
              "--concurrency",
              "1",
              "--fail-on-error",
            ],
            url.replace("/health", "/failure"),
          ),
          (error: unknown) =>
            error instanceof Error &&
            "code" in error &&
            (error as NodeJS.ErrnoException).code === 1,
        );
      },
    );

    await t.test("stress", async () => {
      const reports = await run([
        "--type",
        "stress",
        "--duration",
        "0.1",
        "--maxConcurrency",
        "2",
        "--step",
        "1",
      ]);
      assert.ok(Array.isArray(reports));
      assert.equal(reports.length, 2);
      for (const report of reports) assertReport(report, "stress");
    });

    await t.test("chaos", async () => {
      const report = await run([
        "--type",
        "chaos",
        "--duration",
        "0.1",
        "--concurrency",
        "2",
        "--chaosRate",
        "0",
      ]);
      assert.ok(!Array.isArray(report));
      assertReport(report, "chaos");
    });

    await t.test("security", async () => {
      const report = await run(["--type", "security"]);
      assert.ok(!Array.isArray(report));
      assert.equal(report.kind, "security");
      assert.ok(Array.isArray(report.checks));
      const checks = report.checks as Array<{ name: string; passed: boolean }>;
      assert.ok(
        checks.some(
          (check) => check.name === "Content-Security-Policy" && check.passed,
        ),
      );
      assert.ok(
        checks.some(
          (check) => check.name === "X-Content-Type-Options" && check.passed,
        ),
      );
    });

    await t.test("benchmark", async () => {
      const report = await run([
        "--type",
        "benchmark",
        "--requests",
        "4",
        "--concurrency",
        "2",
      ]);
      assert.ok(!Array.isArray(report));
      assertReport(report, "benchmark");
      assert.equal(report.requests, 4);
    });
  },
);
