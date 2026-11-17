import { readSheet } from 'read-excel-file/node';
import { days, InputError, validMeeting } from './schedule.js';

const columns = ['waktu', 'mata kuliah', 'kode mk', 'kelas', 'sks'];
const clean = (value) => String(value ?? '').trim();
const normalize = (value) => clean(value).replace(/\s+/g, ' ').toLowerCase();

export async function importSchedule(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new InputError('Pilih berkas Excel terlebih dahulu.');
  let rows;
  try {
    rows = await readSheet(buffer, { trim: false });
  } catch {
    throw new InputError('Berkas tidak dapat dibaca. Pilih file Excel .xlsx yang valid.');
  }
  return parseSchedule(rows);
}

export function parseSchedule(rows) {
  const headerIndex = rows.findIndex(row => columns.every(column => row.map(normalize).includes(column)));
  if (headerIndex < 0) {
    throw new InputError('Kolom Waktu, Mata Kuliah, Kode MK, Kelas, dan SKS harus ada di lembar pertama.');
  }

  const header = rows[headerIndex].map(normalize);
  const courses = new Map();
  const issues = [];
  let classCount = 0;
  let unscheduledCount = 0;
  for (const [index, row] of rows.entries()) {
    if (index <= headerIndex || row.every(value => !clean(value))) continue;
    const get = (column) => clean(row[header.indexOf(column)]);
    const [time, name, codeValue, labelValue, rawCredits] = columns.map(get);
    const code = codeValue.toUpperCase();
    const label = labelValue.toUpperCase();
    const creditsMatch = rawCredits.match(/^(\d{1,2})(?:\s*sks)?$/i);
    const credits = Number(creditsMatch?.[1]);
    const unscheduled = /^tidak\s*di\s*jadwalkan$/i.test(time);
    if (!name && !code && !label && !rawCredits &&
        (unscheduled || days.some(day => day.toLowerCase() === time.toLowerCase()))) continue;

    const issue = (message) => issues.push({ row: index + 1, message });
    if (!name || name.length > 180 || !code || code.length > 40 || !label || label.length > 40 ||
        !Number.isInteger(credits) || credits < 1 || credits > 24) {
      issue('Nama, kode MK, kelas, atau SKS tidak valid.');
      continue;
    }

    const match = time.match(/^([a-z]+)\s*,\s*(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})$/i);
    const meeting = match && {
      day: days.find(day => day.toLowerCase() === match[1].toLowerCase()),
      start: match[2].replace('.', ':').padStart(5, '0'),
      end: match[3].replace('.', ':').padStart(5, '0'),
      room: get('ruang').replace(/\s*\|\s*/g, ' · ').slice(0, 180)
    };
    if (!unscheduled && (!meeting || !validMeeting(meeting))) {
      issue('Waktu tidak valid. Contoh: Senin, 07:30-10:00.');
      continue;
    }

    if (!courses.has(code)) courses.set(code, { code, name, credits, classes: [] });
    const course = courses.get(code);
    if (course.name !== name || course.credits !== credits) {
      issue('Nama atau SKS berbeda untuk kode mata kuliah yang sama.');
      continue;
    }
    let item = course.classes.find(entry => entry.label === label);
    if (!item) {
      item = { label, meetings: [] };
      course.classes.push(item);
      classCount++;
    }
    if (item.meetings.length >= 14) {
      issue('Satu kelas dapat memiliki hingga 14 pertemuan.');
      continue;
    }
    if (!unscheduled && !item.meetings.some(existing =>
      existing.day === meeting.day && existing.start === meeting.start && existing.end === meeting.end)) {
      item.meetings.push(meeting);
    }
  }

  const catalog = [...courses.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  for (const course of catalog) {
    course.classes.sort((a, b) => a.label.localeCompare(b.label));
    unscheduledCount += course.classes.filter(item => !item.meetings.length).length;
  }
  if (!catalog.length) throw new InputError('Tidak ada kelas yang dapat diimpor. Periksa isi lembar pertama.');
  return { catalog, classCount, unscheduledCount, issues };
}
