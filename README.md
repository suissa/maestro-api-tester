# maestro-api-tester

A small API tester with a natural-language test DSL and OpenTUI + React terminal dashboards.

## Test

The route tests use Node's strict assertion API, `node:test`, `node:http`, and native `fetch`; no Supertest or other HTTP testing framework is required.

Run tests without the TUI (suitable for CI):

```bash
npm test
```

Run the complete test suite interactively with the OpenTUI dashboard:

```bash
bun install
npm run test:dashboard
```

The dashboard lives in `packages/tui/maestro-tui` and is the canonical TUI entry point. It discovers every `*.test.ts` file under `tests/`, starts Node's native test runner, and streams both stdout and stderr into the terminal UI while execution is in progress. The final exit status is retained on screen, and the dashboard shows the discovered files, elapsed time, output counts, and pass/fail lines.

Press `Enter` or `R` to start/re-run the suite. Use `↑`/`↓` to scroll output, `Home`/`End` to navigate, and `Q`/`Esc` to exit.

Assertions intentionally read like a sentence:

```ts
I.hope.this().isFalse(response.status !== 200);
```

Boolean helpers are generated from the primitive `is(what, value)`. The false predicate is equivalent to `(value) => !(value)`.

## Advanced HTTP test types

Run the advanced test runner with Node 22.6+:

```bash
# Load: fixed concurrency for 30 seconds
npm run test:load -- --url http://localhost:3000/health --duration 30 --concurrency 20

# Stress: ramp concurrency in steps up to 100 workers
npm run test:stress -- --url http://localhost:3000/health --duration 10 --maxConcurrency 100 --step 20

# Chaos: inject client-side aborted attempts (10% by default)
npm run test:chaos -- --url http://localhost:3000/health --duration 30 --concurrency 10 --chaosRate 0.1

# Security: passive HTTP security-header and information-disclosure checks
npm run test:security -- --url https://example.com

# Benchmark: fixed request count (100 by default)
npm run test:benchmark -- --url http://localhost:3000/health --requests 500 --concurrency 1
```

Performance modes accept `--method POST`, `--body '{"hello":"world"}'`, `--header 'Authorization: Bearer token;Content-Type: application/json'`, and `--timeout 5000`. Reports are JSON and include throughput, status codes, errors, and latency min/p50/p95/p99/max/mean. Stress mode emits a report per concurrency step.

**Safety:** run load/stress/chaos tests only against systems you own or are authorized to test. Start with low concurrency and short duration. Chaos mode injects client-side failures only; it does not terminate processes, mutate infrastructure, or simulate server-side outages. Security checks are passive baseline checks, not a full penetration test or substitute for a security audit.

## Local API

```bash
npm start
```

The sample server exposes:

- `GET /health`
- `GET /routes`
- `GET /echo?hello=maestro`
- `POST /echo` with JSON

## API request dashboard

Launch the request-oriented dashboard with:

```bash
bun run dashboard
```

Use Enter to execute the request and `q` or `Esc` to leave the dashboard.
