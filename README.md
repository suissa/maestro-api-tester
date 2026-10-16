# maestro-api-tester

A small API tester with a natural-language test DSL and OpenTUI + React terminal dashboards.

## Test

The route tests use Node's strict assertion API, `node:test`, `node:http`, and native `fetch`; no Supertest or other HTTP testing framework is required.

Run tests without the TUI (suitable for CI):

```bash
npm test
```

Run tests interactively with live stdout/stderr, individual test results, errors, and the final exit status in the OpenTUI dashboard:

```bash
bun install
bun run test:dashboard
```

Press `Enter` or `R` to start/re-run the test suite. Use `↑`/`↓` to scroll output, `Home`/`End` to navigate, and `Q`/`Esc` to exit. The dashboard discovers every `*.test.ts` file under `tests/` and streams the native Node test runner's output while tests execute.

Assertions intentionally read like a sentence:

```ts
I.hope.this().isFalse(response.status !== 200);
```

Boolean helpers are generated from the primitive `is(what, value)`. The false predicate is equivalent to `(value) => !(value)`.

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

Launch the existing request dashboard with:

```bash
bun run dashboard
```

Use Enter to execute the request and `q` or `Esc` to leave the dashboard.
