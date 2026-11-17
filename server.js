import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { importSchedule } from './lib/import.js';
import { findSchedules, InputError } from './lib/schedule.js';

const app = express();
const demo = JSON.parse(readFileSync(new URL('./data/demo.json', import.meta.url), 'utf8'));
app.disable('x-powered-by');
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/mata-kuliah', (_req, res) => res.json(demo));
app.get('/api/mata-kuliah/:kode', (req, res) => {
  const course = demo.find(item => item.code === req.params.kode);
  if (!course) return res.status(404).json({ message: 'Mata kuliah tidak ditemukan.' });
  res.json(course);
});
app.post('/api/impor', express.raw({ type: 'application/octet-stream', limit: '2mb' }), async (req, res) => {
  res.json(await importSchedule(req.body));
});
app.post('/api/jadwal/cari', express.json({ limit: '256kb' }), (req, res) => {
  res.json(findSchedules(req.body?.courses, req.body?.freeDay));
});
app.use('/api', (_req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url)), {
  setHeaders(res, path) {
    if (path.endsWith('sw.js')) res.set('Cache-Control', 'no-cache');
  }
}));
app.use((error, _req, res, _next) => {
  if (error instanceof InputError) return res.status(400).json({ message: error.message });
  if (error.status === 413) return res.status(413).json({ message: 'Ukuran data melebihi batas unggahan.' });
  if (error.status === 400) return res.status(400).json({ message: 'Format permintaan tidak valid.' });
  console.error(error);
  res.status(500).json({ message: 'Server tidak dapat memproses permintaan.' });
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, process.env.HOST || '127.0.0.1', () => console.log('Sekelas: http://localhost:' + port));
}

export default app;
