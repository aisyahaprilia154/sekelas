import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { test } from 'node:test';
import { parseSchedule } from '../lib/import.js';
import { findSchedules } from '../lib/schedule.js';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/config/database.js';

const app = createApp(await createDatabase({ mode: 'local', path: ':memory:' }));

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

test('filter jam memeriksa semua pertemuan dan menerima jam tepat pada batas', () => {
  const courses = [{
    code: 'A', name: 'Algoritma', classes: [{
      label: 'A', meetings: [
        { day: 'Senin', start: '08:00', end: '10:00' },
        { day: 'Rabu', start: '10:30', end: '13:00' }
      ]
    }]
  }];
  assert.equal(findSchedules(courses, 'Jumat', '08:00', '13:00').total, 1);
  assert.equal(findSchedules(courses, '', '08:01').total, 0);
  assert.equal(findSchedules(courses, '', '', '12:59').total, 0);
  assert.equal(findSchedules(courses, 'Rabu', '08:00', '13:00').total, 0);
  assert.equal(findSchedules(courses, 'Jumat', '08:01', '13:00').compatibleCount, 1);
  assert.throws(() => findSchedules(courses, '', '25:00'), /format HH:MM/);
  assert.throws(() => findSchedules(courses, '', '14:00', '13:00'), /harus setelah/);
});

test('batas jam per hari hanya membatasi hari yang dipilih', () => {
  const courses = [{
    code: 'DAY', name: 'Uji hari', credits: 2,
    classes: [{ label: 'A', meetings: [
      { day: 'Senin', start: '07:00', end: '17:00' },
      { day: 'Selasa', start: '06:00', end: '19:00' }
    ] }]
  }];
  const find = (dayTimes) => findSchedules(courses, '', '', '', dayTimes);
  assert.equal(find({ Senin: { earliestStart: '07:00', latestEnd: '17:00' } }).total, 1);
  assert.equal(find({ Senin: { earliestStart: '07:01' } }).total, 0);
  assert.equal(find({ Senin: { latestEnd: '16:59' } }).total, 0);
  assert.equal(find({
    Senin: { earliestStart: '07:00', latestEnd: '17:00' },
    Selasa: { latestEnd: '18:00' }
  }).total, 0);
  assert.equal(find({ Rabu: { earliestStart: '08:00' } }).total, 1);
  assert.equal(find({}).total, 1);
  assert.throws(() => find({ Senin: { earliestStart: '17:00', latestEnd: '07:00' } }), /selesai Senin/);
  assert.throws(() => find({ Senin: { earliestStart: '25:00' } }), /format HH:MM/);
  assert.throws(() => find({ Unknown: {} }), /per hari tidak valid/);
  assert.throws(() => find([]), /per hari tidak valid/);
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
      body: JSON.stringify({ courses, freeDay: 'Jumat', earliestStart: '09:00', latestEnd: '16:30' })
    });
    assert.equal(result.status, 200);
    const filtered = await result.json();
    assert.equal(filtered.total, 44);
    assert.equal(filtered.compatibleCount, 494);
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
