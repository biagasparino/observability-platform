const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/index');

test('GET /health returns 200 and status ok', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(JSON.parse(data).status, 'ok');
        resolve();
      });
    }).on('error', reject);
  });

  server.close();
});

test('GET /metrics exposes Prometheus format', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/metrics`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        assert.strictEqual(res.statusCode, 200);
        assert.ok(data.includes('http_requests_total') || data.includes('app_process'));
        resolve();
      });
    }).on('error', reject);
  });

  server.close();
});
