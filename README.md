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
