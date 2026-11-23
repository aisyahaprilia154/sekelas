import { importSchedule } from '../../lib/import.js';
import { findSchedules, InputError } from '../../lib/schedule.js';

export function createScheduleController(model) {
  return {
    async import(req, res) {
      res.json(await importSchedule(req.body));
    },
    async search(req, res) {
      const { codes, courses, freeDay, earliestStart, latestEnd, dayTimes } = req.body ?? {};
      let selected = courses;
      if (codes !== undefined) {
        if (!req.workspace) throw new InputError('Identitas katalog diperlukan.');
        if (!Array.isArray(codes) || !codes.length || codes.length > 10 ||
            codes.some(code => typeof code !== 'string') || new Set(codes).size !== codes.length) {
          throw new InputError('Pilih 1 sampai 10 mata kuliah dengan kode yang berbeda.');
        }
        const catalog = await model.getAll(req.workspace);
        selected = codes.map(code => {
          const course = catalog.find(item => item.code === code);
          if (!course) throw new InputError('Mata kuliah terpilih sudah berubah. Muat ulang daftar.');
          return course;
        });
      }
      res.json(findSchedules(selected, freeDay, earliestStart, latestEnd, dayTimes));
    }
  };
}
