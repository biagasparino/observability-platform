const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/index');

test('POST /orders without required fields returns 400', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  const result = await new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port, path: '/orders', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      }
    );
    req.on('error', reject);
    req.end(JSON.stringify({}));
  });

  assert.strictEqual(result.status, 400);
  assert.ok(result.body.error);

  server.close();
});
