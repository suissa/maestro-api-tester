import { performance } from "node:perf_hooks";

export type TestKind = "load" | "stress" | "chaos" | "security" | "benchmark";

export interface TestOptions {
  kind: TestKind;
  url: string;
  method?: string;
  concurrency?: number;
  durationSeconds?: number;
  requests?: number;
  timeoutMs?: number;
  maxConcurrency?: number;
  stepConcurrency?: number;
  chaosRate?: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface RequestSample {
  status?: number;
  latencyMs: number;
  error?: string;
}

export interface TestReport {
  kind: TestKind;
  url: string;
  startedAt: string;
  durationMs: number;
  requests: number;
  successes: number;
  failures: number;
  requestsPerSecond: number;
  latencyMs: {
    min: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    mean: number;
  };
  statusCodes: Record<string, number>;
  errors: Record<string, number>;
  checks?: Array<{ name: string; passed: boolean; detail: string }>;
}

const DEFAULT_TIMEOUT_MS = 5_000;

export function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(quantile * sorted.length) - 1),
  );
  return Number(sorted[index].toFixed(2));
}

export function summarizeLatencies(values: number[]): TestReport["latencyMs"] {
  if (values.length === 0) {
    return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }
  const sum = values.reduce((total, value) => total + value, 0);
  const min = values.reduce(
    (best, value) => Math.min(best, value),
    Number.POSITIVE_INFINITY,
  );
  const max = values.reduce(
    (best, value) => Math.max(best, value),
    Number.NEGATIVE_INFINITY,
  );
  return {
    min: Number(min.toFixed(2)),
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    max: Number(max.toFixed(2)),
    mean: Number((sum / values.length).toFixed(2)),
  };
}

function validateOptions(
  options: TestOptions,
): Required<Pick<TestOptions, "concurrency" | "timeoutMs">> {
  const concurrency = options.concurrency ?? 10;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 1000) {
    throw new Error("concurrency must be an integer between 1 and 1000");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new Error("timeoutMs must be positive");
  }
  const parsed = new URL(options.url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must use http:// or https://");
  }
  return { concurrency, timeoutMs };
}

async function requestOnce(
  options: TestOptions,
  timeoutMs: number,
  chaosRate = 0,
): Promise<RequestSample> {
  const started = performance.now();
  try {
    if (chaosRate > 0 && Math.random() < chaosRate) {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.floor(Math.random() * Math.min(timeoutMs, 250)),
        ),
      );
      throw new Error("chaos: injected client-side abort");
    }
    const response = await fetch(options.url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.arrayBuffer();
    return { status: response.status, latencyMs: performance.now() - started };
  } catch (error) {
    return {
      latencyMs: performance.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function makeReport(
  kind: TestKind,
  url: string,
  startedAt: string,
  durationMs: number,
  samples: RequestSample[],
): TestReport {
  const statusCodes: Record<string, number> = {};
  const errors: Record<string, number> = {};
  for (const sample of samples) {
    if (sample.status !== undefined) {
      const key = String(sample.status);
      statusCodes[key] = (statusCodes[key] ?? 0) + 1;
    }
    if (sample.error) errors[sample.error] = (errors[sample.error] ?? 0) + 1;
  }
  const successes = samples.filter(
    (sample) => sample.status !== undefined && sample.status < 400,
  ).length;
  return {
    kind,
    url,
    startedAt,
    durationMs: Number(durationMs.toFixed(2)),
    requests: samples.length,
    successes,
    failures: samples.length - successes,
    requestsPerSecond:
      durationMs > 0
        ? Number((samples.length / (durationMs / 1000)).toFixed(2))
        : 0,
    latencyMs: summarizeLatencies(samples.map((sample) => sample.latencyMs)),
    statusCodes,
    errors,
  };
}

async function runWorkers(
  options: TestOptions,
  concurrency: number,
  stopAt: number,
  maxRequests: number,
  chaosRate = 0,
): Promise<RequestSample[]> {
  const samples: RequestSample[] = [];
  let next = 0;
  const worker = async () => {
    while (performance.now() < stopAt && next < maxRequests) {
      next += 1;
      samples.push(
        await requestOnce(
          options,
          options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          chaosRate,
        ),
      );
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return samples;
}

export async function runLoadTest(options: TestOptions): Promise<TestReport> {
  const { concurrency, timeoutMs } = validateOptions(options);
  const durationSeconds = options.durationSeconds ?? 30;
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > 3600
  ) {
    throw new Error("durationSeconds must be between 0 and 3600");
  }
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const samples = await runWorkers(
    { ...options, timeoutMs },
    concurrency,
    start + durationSeconds * 1000,
    options.requests ?? Number.MAX_SAFE_INTEGER,
    (options as TestOptions & { chaosRate?: number }).chaosRate ?? 0,
  );
  return makeReport(
    options.kind,
    options.url,
    startedAt,
    performance.now() - start,
    samples,
  );
}

export async function runStressTest(
  options: TestOptions,
): Promise<TestReport[]> {
  const maxConcurrency = options.maxConcurrency ?? 100;
  const step =
    options.stepConcurrency ?? Math.max(1, Math.ceil(maxConcurrency / 5));
  if (
    !Number.isInteger(maxConcurrency) ||
    maxConcurrency < 1 ||
    maxConcurrency > 1000
  ) {
    throw new Error("maxConcurrency must be an integer between 1 and 1000");
  }
  if (!Number.isInteger(step) || step < 1) {
    throw new Error("stepConcurrency must be a positive integer");
  }
  const reports: TestReport[] = [];
  for (
    let concurrency = step;
    concurrency < maxConcurrency;
    concurrency += step
  ) {
    reports.push(
      await runLoadTest({ ...options, kind: "stress", concurrency }),
    );
  }
  reports.push(
    await runLoadTest({
      ...options,
      kind: "stress",
      concurrency: maxConcurrency,
    }),
  );
  return reports;
}

export async function runChaosTest(options: TestOptions): Promise<TestReport> {
  const rate = options.chaosRate ?? 0.1;
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.9) {
    throw new Error("chaosRate must be between 0 and 0.9");
  }
  return runLoadTest({
    ...options,
    kind: "chaos",
    chaosRate: rate,
  } as TestOptions & { chaosRate: number });
}

export async function runBenchmark(options: TestOptions): Promise<TestReport> {
  const { concurrency, timeoutMs } = validateOptions(options);
  const requests = options.requests ?? 100;
  if (!Number.isInteger(requests) || requests < 1 || requests > 1_000_000) {
    throw new Error("requests must be an integer between 1 and 1000000");
  }
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const samples = await runWorkers(
    { ...options, timeoutMs },
    concurrency,
    Number.POSITIVE_INFINITY,
    requests,
  );
  return makeReport(
    "benchmark",
    options.url,
    startedAt,
    performance.now() - start,
    samples,
  );
}

export async function runSecurityChecks(
  options: TestOptions,
): Promise<TestReport> {
  validateOptions(options);
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const checks: NonNullable<TestReport["checks"]> = [];
  try {
    const response = await fetch(options.url, {
      method: "GET",
      headers: options.headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      redirect: "manual",
    });
    const headers = response.headers;
    const url = new URL(options.url);
    const securityHeaders = [
      ["content-security-policy", "Content-Security-Policy"],
      ["x-content-type-options", "X-Content-Type-Options"],
      ["referrer-policy", "Referrer-Policy"],
      ["permissions-policy", "Permissions-Policy"],
    ];
    for (const [key, label] of securityHeaders) {
      const value = headers.get(key);
      checks.push({
        name: label,
        passed: Boolean(value),
        detail: value ? `present: ${value}` : `missing ${label}`,
      });
    }
    if (url.protocol === "https:") {
      checks.push({ name: "HTTPS", passed: true, detail: "target uses HTTPS" });
      checks.push({
        name: "Strict-Transport-Security",
        passed: Boolean(headers.get("strict-transport-security")),
        detail:
          headers.get("strict-transport-security") ??
          "missing Strict-Transport-Security",
      });
    } else {
      checks.push({
        name: "HTTPS",
        passed: false,
        detail: "target uses HTTP; HTTPS is recommended",
      });
    }
    const server = headers.get("server");
    checks.push({
      name: "Server banner",
      passed: !server,
      detail: server
        ? `server banner disclosed: ${server}`
        : "no Server header exposed",
    });
    const poweredBy = headers.get("x-powered-by");
    checks.push({
      name: "X-Powered-By",
      passed: !poweredBy,
      detail: poweredBy
        ? `technology disclosed: ${poweredBy}`
        : "no X-Powered-By header exposed",
    });
    await response.body?.cancel();
  } catch (error) {
    checks.push({
      name: "Target reachable",
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  const durationMs = performance.now() - start;
  return {
    ...makeReport("security", options.url, startedAt, durationMs, []),
    requests: 1,
    successes: checks.every((check) => check.passed) ? 1 : 0,
    failures: checks.every((check) => check.passed) ? 0 : 1,
    checks,
  };
}

function parseArgs(args: string[]): TestOptions {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value for --${key}`);
    values[key] = value;
    index += 1;
  }
  const kind = values.type as TestKind;
  if (!["load", "stress", "chaos", "security", "benchmark"].includes(kind)) {
    throw new Error(
      "--type must be load, stress, chaos, security, or benchmark",
    );
  }
  if (!values.url) throw new Error("--url is required");
  const headers: Record<string, string> = {};
  if (values.header) {
    for (const item of values.header.split(";")) {
      const separator = item.indexOf(":");
      if (separator <= 0) {
        throw new Error("--header format is Name: value;Name2: value2");
      }
      headers[item.slice(0, separator).trim()] = item
        .slice(separator + 1)
        .trim();
    }
  }
  return {
    kind,
    url: values.url,
    method: values.method ?? "GET",
    concurrency: values.concurrency !== undefined ? Number(values.concurrency) : undefined,
    durationSeconds: values.duration !== undefined ? Number(values.duration) : undefined,
    requests: values.requests !== undefined ? Number(values.requests) : undefined,
    timeoutMs: values.timeout !== undefined ? Number(values.timeout) : undefined,
    maxConcurrency: values.maxConcurrency !== undefined ? Number(values.maxConcurrency) : undefined,
    stepConcurrency: values.step !== undefined ? Number(values.step) : undefined,
    chaosRate: values.chaosRate !== undefined ? Number(values.chaosRate) : undefined,
    headers: Object.keys(headers).length ? headers : undefined,
    body: values.body,
  };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  try {
    const options = parseArgs(args);
    if (options.kind === "security") {
      console.log(JSON.stringify(await runSecurityChecks(options), null, 2));
    } else if (options.kind === "stress") {
      console.log(JSON.stringify(await runStressTest(options), null, 2));
    } else if (options.kind === "chaos") {
      const report = await runLoadTest({
        ...options,
        kind: "chaos",
        chaosRate: options.chaosRate ?? 0.1,
      } as TestOptions & { chaosRate: number });
      console.log(JSON.stringify(report, null, 2));
    } else if (options.kind === "benchmark") {
      console.log(JSON.stringify(await runBenchmark(options), null, 2));
    } else {
      console.log(JSON.stringify(await runLoadTest(options), null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  await main();
}
