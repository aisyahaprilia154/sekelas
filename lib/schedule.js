export const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export class InputError extends Error {}

export function toMinutes(time) {
  if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function validMeeting({ day, start, end }) {
  return days.includes(day) && toMinutes(start) < toMinutes(end);
}

function evaluate(meetings) {
  const byDay = new Map();
  for (const meeting of meetings) {
    if (!byDay.has(meeting.day)) byDay.set(meeting.day, []);
    byDay.get(meeting.day).push(meeting);
  }

  let gap = 0;
  for (const sessions of byDay.values()) {
    sessions.sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sessions.length; i++) {
      const difference = toMinutes(sessions[i].start) - toMinutes(sessions[i - 1].end);
      if (difference < 0) return null;
      gap += difference;
    }
  }
  return { gap, dayCount: byDay.size, freeDays: days.filter(day => !byDay.has(day)) };
}

export function findSchedules(courses, freeDay = '', earliestStart = '', latestEnd = '', dayTimes = {}) {
  if (!Array.isArray(courses) || courses.length < 1 || courses.length > 10) {
    throw new InputError('Pilih 1 sampai 10 mata kuliah.');
  }
  if (freeDay !== '' && !days.includes(freeDay)) throw new InputError('Hari kosong tidak valid.');
  if ([earliestStart, latestEnd].some(time => time !== '' && !Number.isFinite(toMinutes(time)))) {
    throw new InputError('Masukkan batas jam dalam format HH:MM.');
  }
  if (earliestStart && latestEnd && earliestStart >= latestEnd) {
    throw new InputError('Batas jam selesai harus setelah batas jam mulai.');
  }
  if (!dayTimes || typeof dayTimes !== 'object' || Array.isArray(dayTimes) ||
      Object.keys(dayTimes).some(day => !days.includes(day))) {
    throw new InputError('Pengaturan jam per hari tidak valid.');
  }
  for (const [day, limits] of Object.entries(dayTimes)) {
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) {
      throw new InputError('Pengaturan jam ' + day + ' tidak valid.');
    }
    const start = limits.earliestStart ?? '';
    const end = limits.latestEnd ?? '';
    if ([start, end].some(time => time !== '' && !Number.isFinite(toMinutes(time)))) {
      throw new InputError('Batas jam ' + day + ' harus dalam format HH:MM.');
    }
    if (start && end && start >= end) {
      throw new InputError('Batas jam selesai ' + day + ' harus setelah batas jam mulai.');
    }
  }

  const seen = new Set();
  let candidateCount = 1;
  const options = courses.map(course => {
    if (!course || typeof course.code !== 'string' || !course.code.trim() || course.code.length > 40 ||
        typeof course.name !== 'string' || !course.name.trim() || course.name.length > 180 ||
        seen.has(course.code) || !Array.isArray(course.classes) || course.classes.length > 50) {
      throw new InputError('Data mata kuliah tidak valid atau memiliki kode ganda.');
    }
    seen.add(course.code);
    const classLabels = new Set();
    const scheduled = course.classes.flatMap(item => {
      if (!item || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 40 ||
          classLabels.has(item.label) || !Array.isArray(item.meetings) || item.meetings.length > 14 ||
          !item.meetings.every(meeting => meeting && validMeeting(meeting))) {
        throw new InputError('Jadwal kelas untuk ' + course.name + ' tidak valid.');
      }
      classLabels.add(item.label);
      if (!item.meetings.length) return [];
      return [{
        code: course.code,
        name: course.name,
        label: item.label,
        meetings: item.meetings.map(({ day, start, end, room }) => ({
          day, start, end, room: typeof room === 'string' ? room.slice(0, 180) : ''
        }))
      }];
    });
    if (!scheduled.length) throw new InputError(course.name + ' belum mempunyai kelas dengan jam kuliah.');
    candidateCount *= scheduled.length;
    return scheduled;
  });

  if (candidateCount > 50_000) {
    throw new InputError('Pilihan ini menghasilkan lebih dari 50.000 kombinasi. Kurangi mata kuliah untuk mencari jadwal.');
  }

  const schedules = [];
  let compatibleCount = 0;
  function visit(index, selected, meetings, scores) {
    if (index === options.length) {
      compatibleCount++;
      const matchesDay = !freeDay || scores.freeDays.includes(freeDay);
      const matchesHours = meetings.every(({ day, start, end }) => {
        const limits = dayTimes[day];
        return (!earliestStart || start >= earliestStart) && (!latestEnd || end <= latestEnd) &&
          (!limits?.earliestStart || start >= limits.earliestStart) &&
          (!limits?.latestEnd || end <= limits.latestEnd);
      });
      if (matchesDay && matchesHours) schedules.push({ ...scores, classes: selected });
      return;
    }
    for (const item of options[index]) {
      const next = [...meetings, ...item.meetings];
      const nextScores = evaluate(next);
      if (nextScores) visit(index + 1, [...selected, item], next, nextScores);
    }
  }
  visit(0, [], [], null);

  schedules.sort((a, b) => a.gap - b.gap || a.dayCount - b.dayCount ||
    a.classes.map(item => item.label).join('|').localeCompare(b.classes.map(item => item.label).join('|')));
  return { candidateCount, compatibleCount, total: schedules.length, schedules: schedules.slice(0, 50) };
}
