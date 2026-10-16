# maestro-api-tester

A small API tester with a natural-language test DSL and an OpenTUI + React terminal dashboard.

## Test

The route tests use only Node's strict assertion API, `node:test`, `node:http`, and the native `fetch` API. There is no Supertest or other HTTP testing framework.

```bash
npm test
```

Assertions intentionally read like a sentence:

```js
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

## Dashboard

OpenTUI's React renderer provides the terminal UI.

```bash
bun install
bun run dashboard
```

Use Enter to execute the request and `q` or `Esc` to leave the dashboard.
