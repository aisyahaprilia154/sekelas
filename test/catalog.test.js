import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDatabase } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { demoCatalog } from '../src/models/courseModel.js';

const newCourse = {
  code: 'QA001', name: 'Mata kuliah uji', credits: 3,
  classes: [{ label: 'A', meetings: [{ day: 'Senin', start: '09:00', end: '10:00', room: '' }] }]
};

test('CRUD API menyimpan data, memisahkan katalog dan mencegah penimpaan versi lama', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'sekelas-db-'));
  const path = join(folder, 'catalog.sqlite');
  let database = await createDatabase({ mode: 'local', path });
  let server = createApp(database).listen(0, '127.0.0.1');
  await once(server, 'listening');
  let base = 'http://127.0.0.1:' + server.address().port + '/api';
  const workspace = randomUUID();
  const otherWorkspace = randomUUID();
  const headers = { 'X-Sekelas-Workspace': workspace, 'Content-Type': 'application/json' };
  async function request(route, options = {}) {
    const response = await fetch(base + route, { ...options, headers: { ...headers, ...options.headers } });
    return { status: response.status, data: await response.json() };
  }
  try {
    const initial = await request('/katalog');
    assert.equal(initial.data.revision, 0);
    assert.equal(initial.data.catalog.length, 5);
    assert.equal((await fetch(base + '/katalog')).status, 400);
    const created = await request('/mata-kuliah', {
      method: 'POST', body: JSON.stringify({ course: newCourse, revision: 0 })
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.revision, 1);
    assert.equal(created.data.catalog.length, 6);
    assert.equal((await request('/mata-kuliah/QA001')).data.name, newCourse.name);

    const other = await request('/katalog', { headers: { 'X-Sekelas-Workspace': otherWorkspace } });
    assert.equal(other.data.catalog.length, 5);
    const invalid = await request('/mata-kuliah/QA001', {
      method: 'PUT', body: JSON.stringify({ revision: 1, course: { ...newCourse, classes: [{ label: 'A', meetings: [
        { day: 'Senin', start: '11:00', end: '10:00' }
      ] }] } })
    });
    assert.equal(invalid.status, 400);
    assert.equal((await request('/katalog')).data.revision, 1);

    const update = (name) => request('/mata-kuliah/QA001', {
      method: 'PUT', body: JSON.stringify({ course: { ...newCourse, name }, revision: 1 })
    });
    const racing = await Promise.all([update('Revisi satu'), update('Revisi dua')]);
    assert.deepEqual(racing.map(result => result.status).sort(), [200, 409]);
    const latest = (await request('/katalog')).data;
    assert.equal(latest.revision, 2);
    const search = await request('/jadwal/cari', {
      method: 'POST', body: JSON.stringify({ codes: ['QA001'], freeDay: 'Jumat' })
    });
    assert.equal(search.data.total, 1);
    assert.equal(search.data.schedules[0].classes[0].name, latest.catalog.at(-1).name);

    await new Promise(resolve => server.close(resolve));
    database.close();
    database = await createDatabase({ mode: 'local', path });
    server = createApp(database).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = 'http://127.0.0.1:' + server.address().port + '/api';
    assert.deepEqual((await request('/katalog')).data, latest);

    const removed = await request('/mata-kuliah/QA001', {
      method: 'DELETE', headers: { 'X-Catalog-Revision': '2' }
    });
    assert.equal(removed.status, 200);
    assert.equal(removed.data.revision, 3);
    assert.equal((await request('/mata-kuliah/QA001')).status, 404);
    const staleImport = await request('/katalog', {
      method: 'PUT', body: JSON.stringify({ catalog: [], source: 'Impor', revision: 2 })
    });
    assert.equal(staleImport.status, 409);
    assert.equal((await request('/katalog')).data.catalog.length, 5);
    const replace = await request('/katalog', {
      method: 'PUT', body: JSON.stringify({ catalog: [newCourse], source: 'Impor Excel', revision: 3 })
    });
    assert.equal(replace.status, 200);
    assert.equal(replace.data.source, 'Impor Excel');
    assert.equal(replace.data.catalog.length, 1);
    const clear = await request('/katalog', {
      method: 'PUT', body: JSON.stringify({ catalog: [], source: 'Kosong', revision: 4 })
    });
    assert.equal(clear.data.catalog.length, 0);
    assert.equal((await request('/katalog')).data.catalog.length, 0);
    assert.equal((await request('/contoh')).data.length, demoCatalog.length);
  } finally {
    await new Promise(resolve => server.close(resolve));
    database.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
