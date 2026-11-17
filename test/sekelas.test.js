import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { test } from 'node:test';
import { parseSchedule } from '../lib/import.js';
import { findSchedules } from '../lib/schedule.js';
import app from '../server.js';

const demo = JSON.parse(readFileSync(new URL('../data/demo.json', import.meta.url), 'utf8'));

test('jadwal contoh cocok dengan hitungan dari spreadsheet', () => {
  const initial = findSchedules(demo);
  assert.equal(initial.candidateCount, 1024);
  assert.equal(initial.total, 494);
  assert.equal(initial.schedules[0].gap, 0);
  assert.equal(initial.schedules[0].dayCount, 5);
  const friday = findSchedules(demo, 'Jumat');
  assert.equal(friday.total, 325);
  assert.equal(friday.schedules[0].gap, 10);
  assert.equal(friday.schedules[0].dayCount, 4);
  assert.ok(friday.schedules.every(schedule => schedule.freeDays.includes('Jumat')));
});

test('pencocokan memeriksa semua pertemuan dan menerima kelas yang bersambung', () => {
  const meeting = (day, start, end) => ({ day, start, end });
  const course = (code, meetings) => ({ code, name: code, classes: [{ label: 'A', meetings }] });
  const first = course('A', [meeting('Senin', '08:00', '10:00'), meeting('Sabtu', '10:00', '12:00')]);
  const next = course('B', [meeting('Senin', '10:00', '11:00')]);
  const result = findSchedules([first, next]);
  assert.equal(result.total, 1);
  assert.equal(result.schedules[0].gap, 0);
  assert.equal(findSchedules([first, next], 'Sabtu').total, 0);
  assert.equal(findSchedules([first, course('C', [meeting('Sabtu', '09:30', '11:30')])]).total, 0);
  assert.throws(() => findSchedules([course('D', [])]), /belum mempunyai kelas/);
});

test('impor mengelompokkan kelas, mencatat data rusak dan mempertahankan kelas tanpa jam', () => {
  const parsed = parseSchedule([
    ['Jadwal kuliah'],
    ['Waktu', 'Mata Kuliah', 'Kode MK', 'Kelas', 'SKS', 'Ruang'],
    ['SENIN'],
    ['Senin, 07:30-10:00', 'Algoritma', 'A1', 'A', '3 SKS', 'B.101'],
    ['Rabu, 10:00-12:30', 'Algoritma', 'A1', 'A', 3],
    ['TIDAK DI JADWALKAN', 'Algoritma', 'A1', 'B', '3 SKS'],
    ['Jumat 12', 'Algoritma', 'A1', 'C', '3 SKS']
  ]);
  assert.equal(parsed.catalog.length, 1);
  assert.equal(parsed.classCount, 2);
  assert.equal(parsed.unscheduledCount, 1);
  assert.equal(parsed.catalog[0].classes[0].meetings.length, 2);
  assert.equal(parsed.issues[0].row, 7);
});

test('web service dan aset PWA dapat dimuat dari origin yang sama', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const response = await fetch(base + '/api/mata-kuliah');
    assert.equal(response.status, 200);
    const courses = await response.json();
    assert.equal(courses.length, 5);
    const detail = await fetch(base + '/api/mata-kuliah/' + courses[0].code);
    assert.equal((await detail.json()).classes.length, 4);
    assert.equal((await fetch(base + '/api/mata-kuliah/unknown')).status, 404);
    const result = await fetch(base + '/api/jadwal/cari', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courses, freeDay: 'Jumat' })
    });
    assert.equal((await result.json()).total, 325);
    const invalidFile = await fetch(base + '/api/impor', {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: 'invalid'
    });
    assert.equal(invalidFile.status, 400);
    const manifest = await (await fetch(base + '/manifest.webmanifest')).json();
    assert.equal(manifest.display, 'standalone');
    const assetPaths = ['/', '/sw.js', '/app.js', '/style.css', '/fonts/Inter.woff2', ...manifest.icons.map(icon => icon.src)];
    await Promise.all(assetPaths.map(async path => {
      const asset = await fetch(base + path);
      assert.equal(asset.status, 200, path);
      await asset.arrayBuffer();
    }));
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
