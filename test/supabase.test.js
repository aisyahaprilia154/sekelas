import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { createDatabase } from '../src/config/database.js';

test('adapter Supabase memakai REST SDK dan menolak konflik revisi', async () => {
  const rows = new Map();
  const requests = [];
  const app = express();
  app.use(express.json());
  app.all('/rest/v1/sekelas_catalogs', (req, res) => {
    requests.push(req.method);
    const id = req.query.id?.slice(3);
    if (req.method === 'GET') return res.json(rows.has(id) ? [rows.get(id)] : []);
    if (req.method === 'POST') {
      if (rows.has(req.body.id)) return res.status(409).json({ code: '23505', message: 'duplicate' });
      rows.set(req.body.id, req.body);
      return res.status(201).json({ revision: req.body.revision });
    }
    if (req.method === 'PATCH') {
      const current = rows.get(id);
      const revision = Number(req.query.revision?.slice(3));
      if (!current || current.revision !== revision) return res.json([]);
      rows.set(id, { id, ...req.body });
      return res.json([{ revision: req.body.revision }]);
    }
    res.sendStatus(405);
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_KEY;
  process.env.SUPABASE_URL = 'http://127.0.0.1:' + server.address().port;
  process.env.SUPABASE_KEY = 'test-server-key';
  let database;
  try {
    database = await createDatabase({ mode: 'supabase' });
    assert.equal(await database.get('test'), null);
    const first = { catalog: [], source: 'Test', revision: 1 };
    assert.equal(await database.save('test', first, 0), true);
    assert.equal(await database.save('test', first, 0), false);
    assert.deepEqual(await database.get('test'), { id: 'test', ...first });
    assert.equal(await database.save('test', { ...first, revision: 2 }, 1), true);
    assert.equal(await database.save('test', { ...first, revision: 2 }, 1), false);
    assert.deepEqual(requests, ['GET', 'POST', 'POST', 'GET', 'PATCH', 'PATCH']);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_KEY;
    else process.env.SUPABASE_KEY = previousKey;
    database?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('public key dan anon key menghasilkan petunjuk konfigurasi backend', async () => {
  const previousKey = process.env.SUPABASE_KEY;
  const previousUrl = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  const payload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');
  try {
    for (const key of ['sb_publishable_test', 'header.' + payload + '.signature']) {
      process.env.SUPABASE_KEY = key;
      await assert.rejects(createDatabase({ mode: 'supabase' }), /Secret key.*SUPABASE_KEY/);
    }
  } finally {
    if (previousKey === undefined) delete process.env.SUPABASE_KEY;
    else process.env.SUPABASE_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
  }
});
