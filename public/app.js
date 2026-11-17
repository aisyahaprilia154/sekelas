const view = document.querySelector('#view');
const nav = document.querySelector('#navigation');
const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const demoSource = 'Simulasi S1 Teknik Komputer';
const tabs = [
  ['mata-kuliah', 'Mata Kuliah', 'book'], ['susun', 'Susun', 'sliders'],
  ['hasil', 'Hasil', 'calendar'], ['tentang', 'Tentang', 'info']
];
const paths = {
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0 0 4h14M8 8h8m-8 4h6"/>',
  sliders: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="currentColor"/><circle cx="16" cy="17" r="2" fill="currentColor"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5h2m4 0h2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  tick: '<path d="m5 12 4 4L19 6"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  edit: '<path d="m14 5 5 5M4 20l4-1 12-12-3-3L5 16l-1 4Z"/>'
};
function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
function escape(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, character => entities[character]);
}
function read(key, fallback, storage = 'localStorage') {
  try { return JSON.parse(window[storage].getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function store(key, value, storage = 'localStorage') {
  try { window[storage].setItem(key, JSON.stringify(value)); }
  catch { notify('Penyimpanan browser tidak tersedia. Perubahan berlaku selama halaman terbuka.'); }
}
const saved = read('sekelas-active', null);
const session = read('sekelas-search', {}, 'sessionStorage');
const state = {
  catalog: saved?.catalog ?? [], source: saved?.source ?? '',
  selected: new Set(session.selected ?? []), result: session.result ?? null,
  freeDay: session.freeDay ?? '', loading: !saved, loadError: '', catalogFilter: '', buildFilter: ''
};
let toastTimer;
let routeVersion = 0;
let catalogVersion = 0;
function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}
function errorAt(element, message) {
  element.textContent = message || '';
  element.hidden = !message;
}
async function api(path, options) {
  let response;
  try { response = await fetch('/api' + path, options); }
  catch { throw new Error('API tidak terhubung. Cek koneksi lalu coba lagi.'); }
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload === null) throw new Error(payload?.message ?? 'API gagal memproses permintaan.');
  return payload;
}
function href(page, id) {
  return '#/' + page + (id === undefined ? '' : '/' + encodeURIComponent(id));
}
function go(page, id) {
  const next = href(page, id);
  if (next === location.hash) render();
  else location.hash = next;
}
function link(page, text, { id, type = '', symbol } = {}) {
  return `<a class="button ${type}" href="${href(page, id)}">${symbol ? icon(symbol, 17) : ''}${text}</a>`;
}
function back(page, text, id) {
  return `<a class="back" href="${href(page, id)}">${icon('back', 17)}${text}</a>`;
}
function heading(title, description = '') {
  return `<header class="page-head"><h1>${title}</h1>${description ? `<p>${description}</p>` : ''}</header>`;
}
function empty(text, action = '') {
  return `<div class="panel empty"><p>${text}</p>${action}</div>`;
}
function stat(value, label) {
  return `<span class="stat"><strong>${value}</strong>${label}</span>`;
}
function hasSchedule(course) {
  return course.classes.some(item => item.meetings.length);
}
function saveSearch() {
  store('sekelas-search', { selected: [...state.selected], freeDay: state.freeDay, result: state.result }, 'sessionStorage');
}
function setCatalog(catalog, source, reset = false) {
  catalogVersion++;
  state.catalog = catalog;
  state.source = source;
  state.loadError = '';
  state.loading = false;
  state.result = null;
  state.selected = reset ? new Set() : new Set([...state.selected].filter(
    code => catalog.some(course => course.code === code && hasSchedule(course))));
  if (reset) state.catalogFilter = state.buildFilter = state.freeDay = '';
  store('sekelas-active', { catalog, source });
  saveSearch();
}
async function loadDemo() {
  const version = catalogVersion;
  state.loading = true;
  state.loadError = '';
  render();
  try {
    const catalog = await api('/mata-kuliah');
    if (version !== catalogVersion) return;
    setCatalog(catalog, demoSource, true);
  } catch (error) {
    if (version !== catalogVersion) return;
    state.loadError = error.message;
    state.loading = false;
  }
  if (version + 1 >= catalogVersion && location.hash.split('/')[1] !== 'tambah') render();
}
function matches(course, filter) {
  return (course.name + ' ' + course.code).toLowerCase().includes(filter.trim().toLowerCase());
}
function searchField(value) {
  return `<label class="search-wrap">${icon('search', 18)}
    <input id="course-search" type="search" aria-label="Cari nama atau kode mata kuliah" placeholder="Cari nama atau kode mata kuliah" value="${escape(value)}">
  </label>`;
}
function courseRows(filter) {
  const courses = state.catalog.filter(course => matches(course, filter));
  if (!courses.length) {
    if (state.loading) return empty('Memuat jadwal contoh…');
    if (state.loadError) return empty(escape(state.loadError), '<button class="button secondary compact" data-demo>Coba lagi</button>');
    return empty(filter ? 'Tidak ada mata kuliah yang cocok.' : 'Tambahkan jadwal untuk mulai menyusun KRS.');
  }
  return `<ul class="list">${courses.map(course => `<li><a class="course-row" href="${href('detail-mk', course.code)}">
    <span class="course-icon">${icon('book', 17)}</span>${courseText(course)}${courseBadge(course)}
    <span class="chevron">${icon('right', 16)}</span>
  </a></li>`).join('')}</ul>`;
}
function courseText(course) {
  return `<span><strong>${escape(course.name)}</strong><small>${escape(course.code)} · ${escape(course.credits)} SKS</small></span>`;
}
function courseBadge(course) {
  return hasSchedule(course) ? `<span class="badge">${course.classes.length} kelas</span>` : '<span class="badge amber">Belum terjadwal</span>';
}
function catalogPage() {
  const classCount = state.catalog.reduce((sum, course) => sum + course.classes.length, 0);
  const filled = [0, 6, 7, 10, 13];
  view.innerHTML = `<section class="hero">
    <div><h1>Susun jadwal KRS bebas bentrok.</h1>
      <p>Cocokkan kelas paralel, cari jeda terpendek, dan kosongkan hari pilihanmu.</p>
      ${link('susun', 'Susun jadwal', { type: 'light', symbol: 'calendar' })}
    </div>
    <div class="hero-illustration" aria-hidden="true">
      <div class="calendar-head">${icon('calendar', 15)} Jadwal mingguan</div>
      <div class="calendar-grid">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum'].map(day => `<span>${day}</span>`).join('')}
        ${Array.from({ length: 15 }, (_, i) => `<span class="cal-cell ${filled.includes(i) ? 'filled' : ''} ${i === 13 ? 'green' : ''}"></span>`).join('')}
      </div>
      <div class="calendar-foot">${icon('tick', 15)} Jumat kosong</div>
    </div>
  </section>
  <div class="section split">
    <section aria-labelledby="catalog-title">
      <div class="heading-row"><div><h2 id="catalog-title">Mata kuliah</h2><p>Pilih mata kuliah untuk melihat kelas dan jamnya.</p></div>${link('tambah', 'Tambah jadwal', { symbol: 'plus' })}</div>
      ${searchField(state.catalogFilter)}
      <div id="course-list">${courseRows(state.catalogFilter)}</div>
    </section>
    <aside class="panel side-panel">
      <h2>Jadwal aktif</h2><p class="muted">${escape(state.source || 'Belum ada jadwal')}</p>
      <div class="stats">${stat(state.catalog.length, 'mata kuliah')}${stat(classCount, 'kelas')}</div>
      <p class="muted spaced">Unggah Excel atau tambah kelas secara manual untuk memakai jadwalmu sendiri.</p>
      ${state.source !== demoSource && !state.loading ? '<button class="button secondary compact" data-demo>Muat jadwal contoh</button>' : ''}
    </aside>
  </div>`;
  view.querySelector('#course-search').addEventListener('input', event => {
    state.catalogFilter = event.target.value;
    view.querySelector('#course-list').innerHTML = courseRows(state.catalogFilter);
  });
}
function meetingText(meeting) {
  return `<time>${escape(meeting.start)}–${escape(meeting.end)}</time>${meeting.room ? `<small> · ${escape(meeting.room)}</small>` : ''}`;
}
function courseDetail(course) {
  if (!course) return missing('Mata kuliah ini tidak ditemukan.');
  view.innerHTML = `${back('mata-kuliah', 'Mata kuliah')}${heading(escape(course.name), `${escape(course.code)} · ${escape(course.credits)} SKS`)}
    <div class="split"><section class="stack" aria-label="Kelas paralel">
      <h2>Kelas paralel</h2>
      ${course.classes.map(item => `<article class="panel"><h3>Kelas ${escape(item.label)}</h3>
        ${item.meetings.length ? item.meetings.map(meeting => `<div class="session"><strong>${escape(meeting.day)}</strong>${meetingText(meeting)}</div>`).join('') :
          '<p class="notice">Jam kelas ini belum tersedia.</p>'}</article>`).join('')}
    </section><aside class="panel side-panel"><h2>Kelola mata kuliah</h2>
      <div class="button-row">${link('edit', 'Edit kelas', { id: course.code, type: 'secondary', symbol: 'edit' })}
        ${hasSchedule(course) ? '<button class="button" id="choose-course">Pilih untuk KRS</button>' : ''}
      </div></aside></div>`;
  view.querySelector('#choose-course')?.addEventListener('click', () => {
    if (state.selected.size >= 10 && !state.selected.has(course.code)) return notify('Maksimal 10 mata kuliah.');
    state.selected.add(course.code);
    saveSearch();
    go('susun');
  });
}
function dayOptions(selected, withAny = false) {
  return (withAny ? '<option value="">Tanpa preferensi</option>' : '') + days.map(day =>
    `<option ${selected === day ? 'selected' : ''}>${day}</option>`).join('');
}
function selectionList() {
  const courses = state.catalog.filter(course => matches(course, state.buildFilter));
  if (!courses.length) return empty(state.buildFilter ? 'Tidak ada mata kuliah yang cocok.' : 'Daftar mata kuliah masih kosong.', state.catalog.length ? '' : link('tambah', 'Tambah jadwal'));
  return `<div class="stack">${courses.map(course => `<label class="course-row select-row">
    <input type="checkbox" class="checkbox" data-code="${escape(course.code)}" ${state.selected.has(course.code) ? 'checked' : ''} ${hasSchedule(course) ? '' : 'disabled'}>
    ${courseText(course)}${courseBadge(course)}
  </label>`).join('')}</div>`;
}
function buildPage() {
  view.innerHTML = `${heading('Susun jadwal', 'Pilih mata kuliah yang ingin kamu ambil saat KRS.')}
    <div class="split">
      <section aria-label="Pilih mata kuliah">
        ${searchField(state.buildFilter)}<div id="selection-list">${selectionList()}</div>
      </section>
      <form class="panel side-panel" id="search-form">
        <h2>Preferensi jadwal</h2><p class="muted" id="selection-count"></p>
        <label class="field spaced">Hari yang ingin dikosongkan<select name="freeDay">${dayOptions(state.freeDay, true)}</select></label>
        <p class="notice error" role="alert" hidden></p>
        <button class="button" type="submit">${icon('search', 18)} Cari jadwal</button>
        ${state.source === demoSource ? '<button type="button" class="button secondary" id="select-demo">Pilih semua contoh</button>' : ''}
      </form>
    </div>`;
  const list = view.querySelector('#selection-list');
  const form = view.querySelector('#search-form');
  const select = form.elements.freeDay;
  const submit = form.querySelector('[type="submit"]');
  const demo = form.querySelector('#select-demo');
  const count = view.querySelector('#selection-count');
  const filter = view.querySelector('#course-search');
  const refresh = () => {
    count.textContent = state.selected.size + ' dari maksimal 10 mata kuliah dipilih';
    submit.disabled = state.selected.size === 0;
  };
  refresh();
  filter.addEventListener('input', event => {
    state.buildFilter = event.target.value;
    list.innerHTML = selectionList();
  });
  list.addEventListener('change', event => {
    const input = event.target;
    const code = input.dataset.code;
    if (!code) return;
    if (input.checked && state.selected.size >= 10) {
      input.checked = false;
      notify('Maksimal 10 mata kuliah.');
      return;
    }
    if (input.checked) state.selected.add(code);
    else state.selected.delete(code);
    saveSearch();
    refresh();
  });
  demo?.addEventListener('click', () => {
    state.selected = new Set(state.catalog.filter(hasSchedule).map(course => course.code));
    list.innerHTML = selectionList();
    saveSearch();
    refresh();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const courses = state.catalog.filter(course => state.selected.has(course.code));
    const error = form.querySelector('[role="alert"]');
    submit.disabled = select.disabled = filter.disabled = list.inert = true;
    if (demo) demo.disabled = true;
    submit.textContent = 'Mencari…';
    errorAt(error, '');
    try { await runSearch(courses, select.value); }
    catch (failure) { errorAt(error, failure.message); }
    finally {
      select.disabled = filter.disabled = list.inert = false;
      if (demo) demo.disabled = false;
      submit.innerHTML = icon('search', 18) + ' Cari jadwal';
      refresh();
    }
  });
}
async function runSearch(courses, freeDay) {
  const version = routeVersion;
  const result = await api('/jadwal/cari', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courses, freeDay })
  });
  if (version !== routeVersion) return;
  state.freeDay = freeDay;
  state.result = { ...result, codes: courses.map(course => course.code) };
  saveSearch();
  go('hasil');
}
function freeBadges(daysOff) {
  return daysOff.map(day => `<span class="badge green">${day} kosong</span>`).join('');
}
function resultsPage() {
  if (!state.result) {
    view.innerHTML = `${heading('Hasil jadwal')}${empty('Hasil akan muncul setelah kamu mencari jadwal.', link('susun', 'Susun jadwal'))}`;
    return;
  }
  const { compatibleCount, total, schedules, codes } = state.result;
  const description = state.freeDay
    ? `${total.toLocaleString('id')} dari ${compatibleCount.toLocaleString('id')} jadwal bebas bentrok memiliki ${state.freeDay} kosong.`
    : `${compatibleCount.toLocaleString('id')} alternatif bebas bentrok, diurutkan berdasarkan jeda terpendek.`;
  view.innerHTML = `${heading('Hasil jadwal', description)}
    <form class="panel form-grid" id="filter-form">
      <label class="field">Hari yang ingin dikosongkan<select name="freeDay">${dayOptions(state.freeDay, true)}</select></label>
      <div class="button-row align-end">${link('susun', 'Ubah pilihan mata kuliah', { type: 'secondary' })}</div>
      <p class="notice error span" role="alert" hidden></p>
    </form>
    ${schedules.length ? `<p class="muted spaced">${total > schedules.length ? `Menampilkan ${schedules.length} dari ${total.toLocaleString('id')} hasil.` : 'Buka alternatif untuk melihat kelas dan jamnya.'}</p>
      <div class="result-list">${schedules.map((item, i) => `<a class="panel result-card" href="${href('detail-jadwal', i + 1)}">
        <div class="heading-row"><h3>Jadwal ${i + 1}</h3>${icon('right', 17)}</div>
        <div class="stats">${stat(item.gap + ' menit', 'total jeda')}${stat(item.dayCount, 'hari kuliah')}</div>
        <div class="button-row">${freeBadges(item.freeDays.filter(day => day !== 'Minggu' || state.freeDay === 'Minggu'))}</div>
      </a>`).join('')}</div>` : `<div class="spaced">${empty(
      state.freeDay && compatibleCount ? `Tidak ada jadwal tanpa bentrok dengan ${state.freeDay} kosong. Ubah filter untuk melihat pilihan lain.` :
        'Semua kombinasi bentrok. Coba ubah pilihan mata kuliah atau tambahkan kelas paralel.')}</div>`}`;
  const form = view.querySelector('#filter-form');
  form.elements.freeDay.addEventListener('change', async event => {
    const select = event.target;
    select.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try { await runSearch(state.catalog.filter(course => codes.includes(course.code)), select.value); }
    catch (error) {
      errorAt(form.querySelector('[role="alert"]'), error.message);
      select.value = state.freeDay;
    } finally {
      select.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
}
function resultDetail(id) {
  const result = /^[1-9]\d*$/.test(id) && state.result?.schedules[Number(id) - 1];
  if (!result) return missing('Alternatif jadwal tidak tersedia. Lakukan pencarian kembali.', 'hasil');
  view.innerHTML = `${back('hasil', 'Hasil jadwal')}${heading('Jadwal ' + Number(id))}
    <div class="split">
      <section class="stack" aria-label="Jadwal per hari">${days.map(day => {
        const items = result.classes.flatMap(course => course.meetings.filter(meeting => meeting.day === day)
          .map(meeting => ({ course, meeting }))).sort((a, b) => a.meeting.start.localeCompare(b.meeting.start));
        return `<article class="panel"><h3>${day}</h3>
          ${items.length ? items.map(({ course, meeting }) => `<div class="session">
            <strong>${escape(course.name)} <span class="badge">Kelas ${escape(course.label)}</span></strong>${meetingText(meeting)}
          </div>`).join('') : '<p class="muted">Tidak ada kelas</p>'}
        </article>`;
      }).join('')}</section>
      <aside class="panel side-panel"><h2>Ringkasan</h2>
        <div class="stats">${stat(result.gap + ' menit', 'total jeda')}${stat(result.dayCount, 'hari kuliah')}</div>
        <div class="actions">${freeBadges(result.freeDays)}</div>
      </aside>
    </div>`;
}
function addPage(mode) {
  const manual = mode === 'manual';
  view.innerHTML = `${back('mata-kuliah', 'Mata kuliah')}${heading('Tambah jadwal', 'Unggah Excel dari prodi atau masukkan mata kuliah secara manual.')}
    <div class="button-row tab-switch">
      <a class="button secondary" ${manual ? '' : 'aria-current="page"'} href="${href('tambah')}">${icon('upload', 17)} Unggah Excel</a>
      <a class="button secondary" ${manual ? 'aria-current="page"' : ''} href="${href('tambah', 'manual')}">${icon('edit', 17)} Isi manual</a>
    </div>
    <div class="split"><section id="add-content"></section><aside class="panel side-panel">
      <h2>${manual ? 'Kelas paralel' : 'Format Excel'}</h2>
      ${manual ? '<p class="muted">Satu mata kuliah bisa punya beberapa kelas. Satu kelas bisa punya beberapa pertemuan.</p>' :
        '<p class="muted">Lembar pertama perlu memiliki kolom Waktu, Mata Kuliah, Kode MK, Kelas, dan SKS. Kolom Ruang bersifat opsional.</p><p class="muted">Contoh waktu <strong>Senin, 07:30-10:00</strong>. Maksimum 2 MB.</p>'}
    </aside></div>`;
  const container = view.querySelector('#add-content');
  if (manual) renderEditor(container);
  else renderImport(container);
}
function renderImport(container) {
  container.innerHTML = `<form class="panel">
    <label class="field">Berkas jadwal (.xlsx)<input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required></label>
    <div class="actions"><button type="submit" class="button">${icon('upload', 17)} Lihat pratinjau</button></div>
    <p class="notice error" role="alert" hidden></p>
  </form><section id="preview" aria-label="Pratinjau impor" hidden></section>`;
  const form = container.querySelector('form');
  const preview = container.querySelector('#preview');
  const error = form.querySelector('[role="alert"]');
  const submit = form.querySelector('button');
  const input = form.elements.file;
  input.addEventListener('change', () => {
    preview.hidden = true;
    errorAt(error, '');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const file = input.files[0];
    preview.hidden = true;
    if (!file || !/\.xlsx$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
      return errorAt(error, 'Pilih berkas .xlsx dengan ukuran maksimum 2 MB.');
    }
    const version = catalogVersion;
    errorAt(error, '');
    submit.disabled = input.disabled = true;
    submit.textContent = 'Membaca Excel…';
    try {
      const data = await api('/impor', {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file
      });
      preview.innerHTML = `<article class="panel spaced">
        <h2>Pratinjau jadwal</h2>
        <div class="stats">${stat(data.catalog.length, 'mata kuliah')}${stat(data.classCount, 'kelas')}${stat(data.unscheduledCount, 'belum terjadwal')}</div>
        <ul class="list preview-items" aria-label="Mata kuliah yang terbaca">${data.catalog.map(course =>
          `<li><strong>${escape(course.name)}</strong> <span class="muted">· ${escape(course.code)} · ${course.classes.length} kelas</span></li>`).join('')}</ul>
        ${data.issues.length ? `<details class="notice"><summary>${data.issues.length} baris dilewati</summary><ul class="preview-items">
          ${data.issues.map(issue => `<li>Baris ${issue.row} · ${escape(issue.message)}</li>`).join('')}</ul></details>` : ''}
        ${state.catalog.length ? '<p class="notice">Impor ini akan mengganti daftar mata kuliah aktif dan menghapus pilihan pencarian sebelumnya.</p>' : ''}
        <div class="button-row"><button class="button" id="apply-import" type="button">Gunakan jadwal ini</button></div>
      </article>`;
      preview.hidden = false;
      preview.querySelector('#apply-import').addEventListener('click', () => {
        if (version !== catalogVersion) return errorAt(error, 'Daftar aktif berubah. Buat pratinjau baru.');
        setCatalog(data.catalog, 'Impor Excel · ' + file.name, true);
        notify('Jadwal dari Excel sudah aktif.');
        go('mata-kuliah');
      });
    } catch (failure) { errorAt(error, failure.message); }
    finally {
      input.disabled = submit.disabled = false;
      submit.innerHTML = icon('upload', 17) + ' Lihat pratinjau';
    }
  });
}
function meetingFields(meeting = {}) {
  return `<div class="meeting-fields">
    <label class="field">Hari<select data-field="day" aria-label="Hari">${dayOptions(meeting.day)}</select></label>
    <label class="field">Mulai<input type="time" data-field="start" value="${escape(meeting.start)}" required></label>
    <label class="field">Selesai<input type="time" data-field="end" value="${escape(meeting.end)}" required></label>
    <label class="field">Ruang (opsional)<input data-field="room" maxlength="180" value="${escape(meeting.room)}"></label>
    <button class="button danger compact" type="button" data-action="remove-meeting">Hapus pertemuan</button>
  </div>`;
}
function classFields(item = { label: '', meetings: [{}] }) {
  const scheduled = Boolean(item.meetings.length);
  return `<fieldset class="class-fields">
    <legend>Kelas paralel</legend>
    <div class="form-grid">
      <label class="field">Kode kelas<input data-field="label" placeholder="A" maxlength="40" value="${escape(item.label)}" required></label>
      <label class="button-row"><input type="checkbox" class="checkbox" data-field="unscheduled" ${scheduled ? '' : 'checked'}> Belum terjadwal</label>
    </div>
    <div class="meeting-section" ${scheduled ? '' : 'hidden'}>
      <div class="meeting-list">${item.meetings.map(meetingFields).join('')}</div>
      <div class="actions"><button class="button secondary compact" type="button" data-action="add-meeting">Tambah pertemuan</button></div>
    </div>
    <div class="actions"><button class="button danger compact" type="button" data-action="remove-class">Hapus kelas</button></div>
  </fieldset>`;
}
function renderEditor(container, course) {
  container.innerHTML = `<form class="panel stack">
    <div class="form-grid">
      <label class="field span">Nama mata kuliah<input name="name" maxlength="180" value="${escape(course?.name)}" required></label>
      <label class="field">Kode MK<input name="code" maxlength="40" value="${escape(course?.code)}" required></label>
      <label class="field">SKS<input name="credits" type="number" min="1" max="24" value="${escape(course?.credits ?? 3)}" required></label>
    </div>
    <div id="class-list" class="stack">${course ? course.classes.map(classFields).join('') : classFields()}</div>
    <div class="button-row">
      <button type="button" class="button secondary" data-action="add-class">${icon('plus', 17)} Tambah kelas</button>
      <button type="submit" class="button">Simpan mata kuliah</button>
      ${course ? '<button type="button" class="button danger" data-action="delete-course">Hapus mata kuliah</button>' : ''}
    </div>
    <p class="notice error" role="alert" hidden></p>
  </form>`;
  const form = container.querySelector('form');
  const list = form.querySelector('#class-list');
  const error = form.querySelector('[role="alert"]');
  form.addEventListener('click', event => {
    const action = event.target.closest('button')?.dataset.action;
    const item = event.target.closest('.class-fields');
    const meetings = item?.querySelector('.meeting-list');
    if (action === 'add-class') {
      if (list.children.length >= 50) return notify('Maksimal 50 kelas paralel.');
      list.insertAdjacentHTML('beforeend', classFields());
      list.lastElementChild.querySelector('[data-field="label"]').focus();
    }
    if (action === 'remove-class') {
      if (list.children.length <= 1) return notify('Sisakan setidaknya satu kelas.');
      item.remove();
    }
    if (action === 'add-meeting') {
      if (meetings.children.length >= 14) return notify('Maksimal 14 pertemuan per kelas.');
      meetings.insertAdjacentHTML('beforeend', meetingFields());
      meetings.lastElementChild.querySelector('select').focus();
    }
    if (action === 'remove-meeting') {
      if (meetings.children.length <= 1) return notify('Isi satu pertemuan atau pilih Belum terjadwal.');
      event.target.closest('.meeting-fields').remove();
    }
    if (action === 'delete-course' && confirm('Hapus ' + course.name + ' dari jadwal aktif?')) {
      setCatalog(state.catalog.filter(item => item.code !== course.code), 'Jadwal pribadi');
      notify('Mata kuliah dihapus.');
      go('mata-kuliah');
    }
  });
  form.addEventListener('change', event => {
    const input = event.target;
    if (input.dataset.field !== 'unscheduled') return;
    const section = input.closest('.class-fields').querySelector('.meeting-section');
    const meetings = section.querySelector('.meeting-list');
    if (!input.checked && !meetings.children.length) meetings.innerHTML = meetingFields();
    section.hidden = input.checked;
    for (const field of section.querySelectorAll('input, select')) field.disabled = input.checked;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const data = new FormData(form);
      const code = data.get('code').trim().toUpperCase();
      const name = data.get('name').trim();
      if (!code || !name) throw new Error('Nama dan kode mata kuliah harus diisi.');
      if (state.catalog.some(item => item.code === code && item.code !== course?.code)) {
        throw new Error('Kode mata kuliah sudah ada. Buka detailnya untuk menambah atau mengubah kelas.');
      }
      const labels = new Set();
      const classes = Array.from(list.children, item => {
        const get = field => item.querySelector('[data-field="' + field + '"]');
        const label = get('label').value.trim().toUpperCase();
        if (!label || labels.has(label)) throw new Error('Setiap kelas harus punya kode yang berbeda.');
        labels.add(label);
        const meetings = get('unscheduled').checked ? [] : Array.from(item.querySelectorAll('.meeting-fields'), row =>
          Object.fromEntries([...row.querySelectorAll('[data-field]')].map(field => [field.dataset.field, field.value.trim()])));
        for (const [i, meeting] of meetings.entries()) {
          if (!meeting.start || !meeting.end || meeting.start >= meeting.end) {
            throw new Error('Jam selesai kelas ' + label + ' harus setelah jam mulai.');
          }
          if (meetings.slice(0, i).some(other => meeting.day === other.day && meeting.start < other.end && other.start < meeting.end)) {
            throw new Error('Ada pertemuan yang bentrok dalam kelas ' + label + '.');
          }
        }
        return { label, meetings };
      });
      const updated = { code, name, credits: Number(data.get('credits')), classes };
      const catalog = course ? state.catalog.map(item => item.code === course.code ? updated : item) : [...state.catalog, updated];
      if (course && course.code !== code && state.selected.delete(course.code)) state.selected.add(code);
      setCatalog(catalog, 'Jadwal pribadi');
      notify('Mata kuliah disimpan.');
      go('detail-mk', code);
    } catch (failure) { errorAt(error, failure.message); }
  });
}
function editPage(course) {
  if (!course) return missing('Mata kuliah ini tidak ditemukan.');
  view.innerHTML = `${back('detail-mk', 'Detail mata kuliah', course.code)}${heading('Edit mata kuliah')}`;
  const section = document.createElement('section');
  view.append(section);
  renderEditor(section, course);
}
function aboutPage() {
  view.innerHTML = `${heading('Tentang Sekelas', 'Aplikasi Pencocokan Jadwal Kelas untuk Penyusunan KRS.')}
    <div class="split">
      <section class="panel"><h2>Cara pencocokan</h2>
        <ul class="about-list">
          <li>Sekelas memilih satu kelas paralel per mata kuliah dan melewati kombinasi yang jamnya bertabrakan.</li>
          <li>Jeda adalah waktu antara akhir satu kelas dan awal kelas berikutnya pada hari yang sama.</li>
          <li>Hasil diurutkan berdasarkan total jeda, lalu jumlah hari kuliah. Filter hari kosong menyisakan jadwal yang bebas kelas pada hari pilihanmu.</li>
        </ul>
        <p class="muted">Data bawaan berisi lima mata kuliah dari simulasi semester genap S1 Teknik Komputer. Gunakan kode kelas dalam hasil sebagai acuan saat mengisi KRS.</p>
      </section>
      <aside class="panel side-panel"><h2>Data dan koneksi</h2>
        <p class="muted">Jadwal aktif tersimpan di browser perangkatmu. Tampilan, daftar yang sudah dimuat, dan input manual tersedia secara luring setelah kunjungan pertama. Unggah Excel dan pencarian jadwal memakai API.</p>
      </aside>
    </div>`;
}
function missing(message, page = 'mata-kuliah') {
  view.innerHTML = `${heading('Halaman tidak tersedia')}${empty(message, link(page, page === 'hasil' ? 'Lihat hasil' : 'Lihat mata kuliah'))}`;
}
function render({ focus = false } = {}) {
  routeVersion++;
  const [, page = 'mata-kuliah', encoded = ''] = location.hash.split('/');
  let id;
  try { id = decodeURIComponent(encoded); } catch { id = ''; }
  const activeTab = { 'detail-mk': 'mata-kuliah', tambah: 'mata-kuliah', edit: 'mata-kuliah', 'detail-jadwal': 'hasil' }[page] ?? page;
  nav.innerHTML = `<div class="nav-inner">${tabs.map(([route, name, symbol]) =>
    `<a class="nav-item" href="${href(route)}" ${activeTab === route ? 'aria-current="page"' : ''}>
      <span class="nav-icon">${icon(symbol)}</span><span>${name}</span></a>`).join('')}</div>`;
  const course = () => state.catalog.find(item => item.code === id);
  switch (page) {
    case 'mata-kuliah': catalogPage(); break;
    case 'detail-mk': courseDetail(course()); break;
    case 'susun': buildPage(); break;
    case 'hasil': resultsPage(); break;
    case 'detail-jadwal': resultDetail(id); break;
    case 'tambah': addPage(id); break;
    case 'edit': editPage(course()); break;
    case 'tentang': aboutPage(); break;
    default: missing('Periksa alamat halaman dan coba lagi.');
  }
  view.setAttribute('aria-busy', String(state.loading));
  const title = view.querySelector('h1')?.textContent;
  document.title = title && page !== 'mata-kuliah' ? title + ' · Sekelas' : 'Sekelas — Penyusun Jadwal KRS';
  if (focus) {
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
view.addEventListener('click', async event => {
  if (!event.target.closest('[data-demo]') || state.loading) return;
  if (state.catalog.length && !confirm('Ganti jadwal aktif dengan jadwal contoh?')) return;
  await loadDemo();
  if (state.loadError) notify(state.loadError);
});
window.addEventListener('hashchange', () => render({ focus: true }));
const updateConnection = () => {
  document.querySelector('#connection').textContent = navigator.onLine ? 'Penyusun KRS' : 'Luring';
};
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
updateConnection();

const install = document.querySelector('#install');
let installEvent;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installEvent = event;
  install.hidden = false;
});
install.addEventListener('click', async () => {
  if (!installEvent) return;
  const prompt = installEvent;
  installEvent = null;
  install.hidden = true;
  await prompt.prompt();
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  install.hidden = true;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.warn);
if (saved) render();
else loadDemo();
