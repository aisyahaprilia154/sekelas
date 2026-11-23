import { InputError, validMeeting } from '../../lib/schedule.js';
import { demoCatalog, HttpError } from '../models/courseModel.js';

export function validateCourse(course) {
  if (!course || typeof course.code !== 'string' || !course.code.trim() || course.code.length > 40 ||
      typeof course.name !== 'string' || !course.name.trim() || course.name.length > 180 ||
      !Number.isInteger(course.credits) || course.credits < 1 || course.credits > 24 ||
      !Array.isArray(course.classes) || !course.classes.length || course.classes.length > 50) {
    throw new InputError('Data mata kuliah, SKS, atau kelas tidak valid.');
  }
  const labels = new Set();
  const classes = course.classes.map(item => {
    if (!item || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 40 ||
        labels.has(item.label.trim().toUpperCase()) || !Array.isArray(item.meetings) ||
        item.meetings.length > 14 || !item.meetings.every(meeting => meeting && validMeeting(meeting))) {
      throw new InputError('Kode kelas atau waktu pertemuan tidak valid.');
    }
    const label = item.label.trim().toUpperCase();
    labels.add(label);
    const meetings = item.meetings.map(({ day, start, end, room }) => ({
      day, start, end, room: typeof room === 'string' ? room.trim().slice(0, 180) : ''
    }));
    if (meetings.some((meeting, index) => meetings.slice(0, index).some(other =>
      other.day === meeting.day && other.start < meeting.end && meeting.start < other.end))) {
      throw new InputError('Pertemuan dalam satu kelas saling bentrok.');
    }
    return { label, meetings };
  });
  return { code: course.code.trim().toUpperCase(), name: course.name.trim(), credits: course.credits, classes };
}

export function createCourseController(model) {
  return {
    async getCatalog(req, res) { res.json(await model.getCatalog(req.workspace)); },
    async getAll(req, res) {
      res.json(req.workspace ? await model.getAll(req.workspace) : demoCatalog);
    },
    async getByCode(req, res) {
      if (req.workspace) return res.json(await model.getByCode(req.workspace, req.params.kode));
      const course = demoCatalog.find(item => item.code === req.params.kode);
      if (!course) throw new HttpError(404, 'Mata kuliah tidak ditemukan.');
      res.json(course);
    },
    async create(req, res) {
      res.status(201).json(await model.create(req.workspace, validateCourse(req.body?.course), req.body?.revision));
    },
    async update(req, res) {
      res.json(await model.update(req.workspace, req.params.kode, validateCourse(req.body?.course), req.body?.revision));
    },
    async remove(req, res) {
      const revision = req.get('x-catalog-revision');
      if (!revision || !/^\d+$/.test(revision)) throw new InputError('Versi katalog harus diisi.');
      res.json(await model.remove(req.workspace, req.params.kode, Number(revision)));
    },
    async replace(req, res) {
      if (!Array.isArray(req.body?.catalog) || req.body.catalog.length > 500) {
        throw new InputError('Katalog harus berupa daftar maksimal 500 mata kuliah.');
      }
      const catalog = req.body.catalog.map(validateCourse);
      if (new Set(catalog.map(item => item.code)).size !== catalog.length) throw new InputError('Kode mata kuliah ganda.');
      const source = typeof req.body.source === 'string' ? req.body.source.trim().slice(0, 250) : 'Jadwal pribadi';
      res.json(await model.replace(req.workspace, catalog, source, req.body.revision));
    }
  };
}
