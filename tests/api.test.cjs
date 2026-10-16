const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');

let createServer;
let describe;
let request;
let is;
let isFalse;
let isTrue;

const I = {
  hope: {
    this() {
      return {
        isFalse(value) {
          assert.equal(isFalse(value), true);
        },
        isTrue(value) {
          assert.equal(isTrue(value), true);
        },
      };
    },
  },
};

const modules = Promise.all([
  import('../src/server.js'),
  import('../src/api-tester.js'),
  import('../src/is.js'),
]).then(([server, tester, assertions]) => {
  createServer = server.createServer;
  ({ describe, request } = tester);
  ({ is, isFalse, isTrue } = assertions);
});

function theServerStartsWithHttp(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    server.once('error', reject);
  });
}

function theServerStopsAfterTheTest(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function theHealthRouteAnswers(port) {
  return fetch(`http://127.0.0.1:${port}/health`);
}

async function theRouteCatalogAnswers(port) {
  return fetch(`http://127.0.0.1:${port}/routes`);
}

async function theEchoRouteAnswers(port) {
  return fetch(`http://127.0.0.1:${port}/echo?hello=maestro&mode=natural`);
}

async function thePostEchoRouteAnswers(port) {
  return fetch(`http://127.0.0.1:${port}/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hello: 'maestro', value: 42 }),
  });
}

async function theBrokenJsonIsRejected(port) {
  return fetch(`http://127.0.0.1:${port}/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{broken',
  });
}

async function theUnknownRouteIsRejected(port) {
  return fetch(`http://127.0.0.1:${port}/missing`);
}

test('the natural assertion primitive builds false predicates', async () => {
  await modules;
  const saysThisIsFalse = is(false, 'ignored');
  I.hope.this().isFalse(saysThisIsFalse(true));
  I.hope.this().isTrue(saysThisIsFalse(false));
  I.hope.this().isFalse(isFalse(true));
  I.hope.this().isTrue(isFalse(false));
});

test('the natural assertion primitive builds true predicates', async () => {
  await modules;
  const saysThisIsTrue = is(true, 'ignored');
  I.hope.this().isTrue(saysThisIsTrue(true));
  I.hope.this().isFalse(saysThisIsTrue(false));
});

test('the health route answers successfully', async () => {
  await modules;
  const server = createServer();
  const port = await theServerStartsWithHttp(server);
  try {
    const response = await theHealthRouteAnswers(port);
    I.hope.this().isFalse(!response.ok);
    I.hope.this().isFalse(response.status !== 200);
    const body = await response.json();
    I.hope.this().isFalse(body.ok !== true);
    I.hope.this().isFalse(body.service !== 'maestro-api-tester');
  } finally {
    await theServerStopsAfterTheTest(server);
  }
});

test('the route catalog describes every route', async () => {
  await modules;
  const server = createServer();
  const port = await theServerStartsWithHttp(server);
  try {
    const response = await theRouteCatalogAnswers(port);
    I.hope.this().isFalse(!response.ok);
    const body = await response.json();
    I.hope.this().isFalse(!Array.isArray(body.routes));
    I.hope.this().isFalse(body.routes.length < 4);
    I.hope.this().isFalse(!body.routes.some((route) => route.path === '/health'));
    I.hope.this().isFalse(!body.routes.some((route) => route.path === '/echo' && route.method === 'POST'));
  } finally {
    await theServerStopsAfterTheTest(server);
  }
});

test('the GET echo route returns query parameters', async () => {
  await modules;
  const server = createServer();
  const port = await theServerStartsWithHttp(server);
  try {
    const response = await theEchoRouteAnswers(port);
    I.hope.this().isFalse(!response.ok);
    const body = await response.json();
    I.hope.this().isFalse(body.method !== 'GET');
    I.hope.this().isFalse(body.query.hello !== 'maestro');
    I.hope.this().isFalse(body.query.mode !== 'natural');
  } finally {
    await theServerStopsAfterTheTest(server);
  }
});

test('the POST echo route returns JSON bodies', async () => {
  await modules;
  const server = createServer();
  const port = await theServerStartsWithHttp(server);
  try {
    const response = await thePostEchoRouteAnswers(port);
    I.hope.this().isFalse(!response.ok);
    const body = await response.json();
    I.hope.this().isFalse(body.method !== 'POST');
    I.hope.this().isFalse(body.body.hello !== 'maestro');
    I.hope.this().isFalse(body.body.value !== 42);
  } finally {
    await theServerStopsAfterTheTest(server);
  }
});

test('the POST echo route rejects broken JSON', async () => {
  await modules;
  const server = createServer();
  const port = await theServerStartsWithHttp(server);
  try {
    const response = await theBrokenJsonIsRejected(port);
    I.hope.this().isFalse(response.status !== 400);
    const body = await response.json();
    I.hope.this().isFalse(body.error !== 'invalid JSON');
  } finally {
    await theServerStopsAfterTheTest(server);
  }
});

test('unknown routes return a clear failure', async () => {
  await modules;
  const server = createServer();
  const port = await theServerStartsWithHttp(server);
  try {
    const response = await theUnknownRouteIsRejected(port);
    I.hope.this().isFalse(response.status !== 404);
    I.hope.this().isFalse(response.ok);
  } finally {
    await theServerStopsAfterTheTest(server);
  }
});

test('the API request runner uses fetch and describes responses', async () => {
  await modules;
  const server = createServer();
  const port = await theServerStartsWithHttp(server);
  try {
    const result = await request({ url: `http://127.0.0.1:${port}/health` });
    I.hope.this().isFalse(!result.ok);
    I.hope.this().isFalse(result.status !== 200);
    I.hope.this().isFalse(!Number.isFinite(result.elapsedMs));
    I.hope.this().isFalse(!describe(result).includes('GET'));
    I.hope.this().isFalse(!describe(result).includes('200 OK'));
  } finally {
    await theServerStopsAfterTheTest(server);
  }
});
