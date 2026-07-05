'use strict';

const { spawn } = require('child_process');
const http = require('http');

const SERVERS = [
  { name: 'Express 4', script: 'express4-server.js', port: 3001 },
  { name: 'Express 5', script: 'express5-server.js', port: 3002 },
  { name: 'Fastify 4', script: 'fastify4-server.js', port: 3003 },
  { name: 'Fastify 5', script: 'fastify5-server.js', port: 3004 },
];

function request(port, method, path, body, contentType) {
  return new Promise((resolve, reject) => {
    const data = body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const opts = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': contentType || 'application/json' },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(opts, (res) => {
      let chunks = '';
      res.on('data', (d) => (chunks += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, data: chunks });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function waitForServer(port, retries = 30) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const check = () => {
      const req = http.request({ hostname: '127.0.0.1', port, path: '/', method: 'GET' }, () => resolve());
      req.on('error', () => {
        if (++attempt >= retries) return reject(new Error(`Server on :${port} not ready`));
        setTimeout(check, 200);
      });
      req.end();
    };
    check();
  });
}

const TESTS = [
  {
    name: 'Basic $ stripping',
    method: 'POST',
    path: '/auto/basic',
    body: { username: '$admin', password: { $ne: '' } },
    assert: (r) => r.data.body.username === 'admin' && r.data.body.password.ne === '',
  },
  {
    name: 'Prototype pollution blocked',
    method: 'POST',
    path: '/proto/test',
    rawBody: '{"__proto__": {"isAdmin": true}, "name": "$evil"}',
    assert: (r) => r.data.body.name === 'evil' && !r.data.hasProto && !r.data.globalPolluted,
    skip: ['Fastify 4', 'Fastify 5'],
  },
  {
    name: 'Prototype pollution via constructor key (fastify)',
    method: 'POST',
    path: '/proto/test',
    body: { constructor: { isAdmin: true }, name: '$evil' },
    assert: (r) => r.data.body.name === 'evil' && !Object.hasOwn(r.data.body, 'constructor'),
    skip: ['Express 4', 'Express 5'],
  },
  {
    name: 'Nested sanitization',
    method: 'POST',
    path: '/auto/basic',
    body: { user: { role: '$admin', nested: { val: '$x' } } },
    assert: (r) => r.data.body.user.role === 'admin' && r.data.body.user.nested.val === 'x',
  },
  {
    name: 'Array injection',
    method: 'POST',
    path: '/auto/basic',
    body: { tags: ['$gt', 'safe', '$ne'] },
    assert: (r) => {
      const t = r.data.body.tags;
      return t[0] === 'gt' && t[1] === 'safe' && t[2] === 'ne';
    },
  },
  {
    name: 'Email preserved',
    method: 'POST',
    path: '/auto/basic',
    body: { email: 'user@example.com', name: '$admin' },
    assert: (r) => r.data.body.email === 'user@example.com' && r.data.body.name === 'admin',
  },
  {
    name: 'Manual mode - sanitize()',
    method: 'POST',
    path: '/manual/sanitize',
    body: { username: '$admin' },
    assert: (r) => r.data.before.username === '$admin' && r.data.after.username === 'admin',
  },
  {
    name: 'Manual mode - custom opts',
    method: 'POST',
    path: '/manual/sanitize-custom',
    body: { level1: '$x', nested: { level2: '$y' } },
    assert: (r) => r.data.body.level1 === 'x' && r.data.body.nested === undefined,
  },
  {
    name: 'Full options - denied keys + stringOptions + onSanitize',
    method: 'POST',
    path: '/full/test',
    body: { secret: 'hidden', name: '  $ADMIN  ', email: 'user@test.com' },
    assert: (r) => {
      const b = r.data.body;
      return (
        b.secret === undefined &&
        (b.name === '_admin' || b.name === 'admin') &&
        b.email === 'user@test.com' &&
        r.data.events.length > 0
      );
    },
  },
  {
    name: 'skipRoute exact (express)',
    method: 'POST',
    path: '/auto/skip/exact',
    body: { $evil: 'should pass through' },
    assert: (r) => r.data.body.$evil === 'should pass through' && r.data.skipped === true,
    skip: ['Fastify 4', 'Fastify 5'],
  },
  {
    name: 'skipRoute exact (fastify)',
    method: 'POST',
    path: '/full/skip',
    body: { $evil: 'should pass through' },
    assert: (r) => r.data.body.$evil === 'should pass through' && r.data.skipped === true,
    skip: ['Express 4', 'Express 5'],
  },
  {
    name: 'Custom sanitizer',
    method: 'POST',
    path: '/custom/test',
    body: { name: 'hello', age: 25 },
    assert: (r) => r.data.body.NAME === 'HELLO' && r.data.body.AGE === 25,
  },
  {
    name: 'maxDepth throw returns 400',
    method: 'POST',
    path: '/throw/test',
    body: { nested: { deep: 'value' } },
    assert: (r) => r.status === 400 && r.data.error.includes('Max sanitization depth'),
  },
  {
    name: 'Query string sanitization',
    method: 'GET',
    path: '/auto/query?role=$admin&name=ok',
    body: null,
    assert: (r) => r.data.query.role === 'admin' && r.data.query.name === 'ok',
    skip: ['Express 4'],
  },
  {
    name: 'allowedKeys - only whitelisted keys pass (keys still sanitized)',
    method: 'POST',
    path: '/allowed/test',
    body: { $set: { name: 'ok' }, $evil: 'bad', $push: { tags: 'x' } },
    assert: (r) => {
      const b = r.data.body;
      const keys = Object.keys(b);
      return keys.includes('set') && keys.includes('push') && !keys.includes('evil') && keys.length === 2;
    },
  },
  {
    name: 'removeMatches - entire key-value removed on match',
    method: 'POST',
    path: '/removematches/test',
    body: { $gt: 5, name: 'safe', $ne: '' },
    assert: (r) => {
      const b = r.data.body;
      return b.name === 'safe' && b.$gt === undefined && b.gt === undefined && b.$ne === undefined;
    },
  },
  {
    name: 'arrayOptions - filterNull + distinct',
    method: 'POST',
    path: '/arrayopts/test',
    body: { items: ['$a', '', '$a', null, 'b', 'b'] },
    assert: (r) => {
      const items = r.data.body.items;
      return items.length === 2 && items[0] === 'a' && items[1] === 'b';
    },
  },
  {
    name: 'preserveEmails: false - $ in email stripped',
    method: 'POST',
    path: '/no-email/test',
    body: { email: 'user$test@example.com', name: '$admin' },
    assert: (r) => r.data.body.email === 'usertest@example.com' && r.data.body.name === 'admin',
  },
  {
    name: 'replaceWith underscore',
    method: 'POST',
    path: '/replace/test',
    body: { $gt: 5, name: '$admin' },
    assert: (r) => r.data.body._gt === 5 && r.data.body.name === '_admin',
  },
  {
    name: 'recursive: false - nested objects untouched',
    method: 'POST',
    path: '/no-recursive/test',
    body: { name: '$admin', nested: { $danger: 'hack' } },
    assert: (r) => r.data.body.name === 'admin' && r.data.body.nested.$danger === 'hack',
  },
  {
    name: 'maxDepth preserve - over-depth values pass through unsanitized',
    method: 'POST',
    path: '/preserve/test',
    body: { top: '$x', nested: { deep: '$y' } },
    assert: (r) => r.data.body.top === 'x' && r.data.body.nested.deep === '$y',
  },
  {
    name: 'Control characters stripped',
    method: 'POST',
    path: '/auto/basic',
    body: { key: 'hello\x00world\x01test', name: 'normal' },
    assert: (r) => r.data.body.key === 'helloworldtest' && r.data.body.name === 'normal',
  },
  {
    name: 'Form URL-encoded body sanitized',
    method: 'POST',
    path: '/form/test',
    contentType: 'application/x-www-form-urlencoded',
    rawBody: 'username=%24admin&role=%24super',
    assert: (r) => r.data.body.username === 'admin' && r.data.body.role === 'super',
    skip: ['Fastify 4', 'Fastify 5'],
  },
  {
    name: 'Param sanitization (Express)',
    method: 'GET',
    path: '/user/$admin',
    body: null,
    assert: (r) => r.data.username === 'admin',
    skip: ['Fastify 4', 'Fastify 5'],
  },
  {
    name: 'contentTypes guard - JSON body sanitized (Express)',
    method: 'POST',
    path: '/ct/json',
    body: { name: '$admin' },
    assert: (r) => r.data.body.name === 'admin',
    skip: ['Fastify 4', 'Fastify 5'],
  },
  {
    name: 'contentTypes guard - text body NOT sanitized (Express)',
    method: 'POST',
    path: '/ct/text',
    contentType: 'text/plain',
    rawBody: '$admin injection',
    assert: (r) => r.data.body === '$admin injection',
    skip: ['Fastify 4', 'Fastify 5'],
  },
];

async function runTestsForServer(server, proc) {
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const test of TESTS) {
    if (test.skip && test.skip.includes(server.name)) continue;

    try {
      const body = test.rawBody || test.body;
      const r = await request(server.port, test.method, test.path, body, test.contentType);
      if (test.assert(r)) {
        passed++;
      } else {
        failed++;
        failures.push({ test: test.name, response: r.data });
      }
    } catch (err) {
      failed++;
      failures.push({ test: test.name, error: err.message });
    }
  }

  return { passed, failed, failures };
}

async function main() {
  const procs = [];

  console.log('Starting servers...\n');

  for (const srv of SERVERS) {
    const proc = spawn('node', [srv.script], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(srv.port) },
      stdio: 'pipe',
    });
    proc.stderr.on('data', (d) => process.stderr.write(`[${srv.name}] ${d}`));
    procs.push(proc);
  }

  // Wait for all servers
  for (const srv of SERVERS) {
    try {
      await waitForServer(srv.port);
      console.log(`  ✓ ${srv.name} ready on :${srv.port}`);
    } catch (e) {
      console.error(`  ✗ ${srv.name} failed to start: ${e.message}`);
    }
  }

  console.log('\n─── Running Tests ───\n');

  let totalPassed = 0;
  let totalFailed = 0;

  for (const srv of SERVERS) {
    const { passed, failed, failures } = await runTestsForServer(srv);
    totalPassed += passed;
    totalFailed += failed;

    const icon = failed === 0 ? '✓' : '✗';
    console.log(`  ${icon} ${srv.name}: ${passed} passed, ${failed} failed`);
    for (const f of failures) {
      console.log(`    ✗ ${f.test}: ${f.error || JSON.stringify(f.response).slice(0, 100)}`);
    }
  }

  console.log(`\n─── Summary ───`);
  console.log(`  Total: ${totalPassed + totalFailed} tests, ${totalPassed} passed, ${totalFailed} failed\n`);

  // Cleanup
  for (const proc of procs) proc.kill();
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
