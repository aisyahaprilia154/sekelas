import express from 'express';
import { fileURLToPath } from 'node:url';
import { InputError } from '../lib/schedule.js';
import { createCourseModel, HttpError } from './models/courseModel.js';
import { createApiRoutes } from './routes/apiRoutes.js';

export function createApp(database) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', createApiRoutes(createCourseModel(database)));
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url)), {
    setHeaders(res, path) {
      if (path.endsWith('sw.js')) res.set('Cache-Control', 'no-cache');
    }
  }));
  app.use((error, _req, res, _next) => {
    if (error instanceof InputError) return res.status(400).json({ message: error.message });
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
    if (error.status === 413) return res.status(413).json({ message: 'Ukuran data melebihi batas unggahan.' });
    if (error.status === 400) return res.status(400).json({ message: 'Format permintaan tidak valid.' });
    console.error(error);
    res.status(500).json({ message: 'Server tidak dapat memproses permintaan.' });
  });
  return app;
}
