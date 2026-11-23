import express from 'express';
import { InputError } from '../../lib/schedule.js';
import { createCourseController } from '../controllers/courseController.js';
import { createScheduleController } from '../controllers/scheduleController.js';
import { demoCatalog } from '../models/courseModel.js';

export function createApiRoutes(model) {
  const router = express.Router();
  const course = createCourseController(model);
  const schedule = createScheduleController(model);
  router.use((req, _res, next) => {
    const id = req.get('x-sekelas-workspace');
    if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new InputError('Identitas katalog tidak valid.');
    }
    req.workspace = id;
    next();
  });
  const workspaceRequired = (req, _res, next) => {
    if (!req.workspace) throw new InputError('Header X-Sekelas-Workspace diperlukan.');
    next();
  };
  const json = express.json({ limit: '2mb' });
  router.get('/contoh', (_req, res) => res.json(demoCatalog));
  router.get('/katalog', workspaceRequired, course.getCatalog);
  router.put('/katalog', workspaceRequired, json, course.replace);
  router.get('/mata-kuliah', course.getAll);
  router.get('/mata-kuliah/:kode', course.getByCode);
  router.post('/mata-kuliah', workspaceRequired, json, course.create);
  router.put('/mata-kuliah/:kode', workspaceRequired, json, course.update);
  router.delete('/mata-kuliah/:kode', workspaceRequired, course.remove);
  router.post('/impor', express.raw({ type: 'application/octet-stream', limit: '2mb' }), schedule.import);
  router.post('/jadwal/cari', json, schedule.search);
  return router;
}
