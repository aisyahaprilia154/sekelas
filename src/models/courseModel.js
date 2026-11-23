import { readFileSync } from 'node:fs';

export const demoCatalog = JSON.parse(readFileSync(new URL('../../data/demo.json', import.meta.url), 'utf8'));
export const demoSource = 'Simulasi S1 Teknik Komputer';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createCourseModel(database) {
  async function getCatalog(id) {
    return await database.get(id) ?? { catalog: structuredClone(demoCatalog), source: demoSource, revision: 0 };
  }
  async function mutate(id, expectedRevision, change) {
    const current = await getCatalog(id);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new HttpError(400, 'Versi katalog harus diisi.');
    }
    if (current.revision !== expectedRevision) {
      throw new HttpError(409, 'Jadwal sudah berubah. Muat ulang daftar sebelum menyimpan perubahan ini.');
    }
    const next = { ...change(current), revision: current.revision + 1 };
    if (!await database.save(id, next, current.revision)) {
      throw new HttpError(409, 'Jadwal berubah saat disimpan. Muat ulang daftar lalu coba lagi.');
    }
    return next;
  }
  return {
    getCatalog,
    async getAll(id) { return (await getCatalog(id)).catalog; },
    async getByCode(id, code) {
      const course = (await getCatalog(id)).catalog.find(item => item.code === code);
      if (!course) throw new HttpError(404, 'Mata kuliah tidak ditemukan.');
      return course;
    },
    create(id, course, revision) {
      return mutate(id, revision, current => {
        if (current.catalog.some(item => item.code === course.code)) throw new HttpError(409, 'Kode mata kuliah sudah digunakan.');
        return { catalog: [...current.catalog, course], source: 'Jadwal pribadi' };
      });
    },
    update(id, code, course, revision) {
      return mutate(id, revision, current => {
        if (!current.catalog.some(item => item.code === code)) throw new HttpError(404, 'Mata kuliah tidak ditemukan.');
        if (current.catalog.some(item => item.code === course.code && item.code !== code)) {
          throw new HttpError(409, 'Kode mata kuliah sudah digunakan.');
        }
        return { catalog: current.catalog.map(item => item.code === code ? course : item), source: 'Jadwal pribadi' };
      });
    },
    remove(id, code, revision) {
      return mutate(id, revision, current => {
        if (!current.catalog.some(item => item.code === code)) throw new HttpError(404, 'Mata kuliah tidak ditemukan.');
        return { catalog: current.catalog.filter(item => item.code !== code), source: 'Jadwal pribadi' };
      });
    },
    replace(id, catalog, source, revision) {
      return mutate(id, revision, () => ({ catalog, source }));
    }
  };
}
