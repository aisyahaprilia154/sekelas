import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export async function createDatabase(options = {}) {
  const mode = options.mode ?? process.env.DATABASE_MODE ?? (process.env.VERCEL ? 'supabase' : 'local');
  if (mode === 'supabase') {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) throw new Error('Isi SUPABASE_URL dan SUPABASE_KEY di .env untuk mengaktifkan Supabase.');
    let role;
    if (key.split('.').length === 3) {
      try {
        role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role;
      } catch {
        // Kunci yang tidak terbaca akan divalidasi oleh Supabase.
      }
    }
    if (key.startsWith('sb_publishable_') || role === 'anon' || role === 'authenticated') {
      throw new Error('SUPABASE_KEY masih berupa public/anon key. Buka Settings > API Keys di Supabase, lalu isi Secret key (sb_secret_...) atau service_role key ke SUPABASE_KEY di .env backend.');
    }
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    return {
      mode,
      async get(id) {
        const { data, error } = await client.from('sekelas_catalogs').select('catalog, source, revision').eq('id', id).maybeSingle();
        if (error) throw error;
        return data;
      },
      async save(id, next, revision) {
        const result = revision === 0
          ? await client.from('sekelas_catalogs').insert({ id, ...next }).select('revision').single()
          : await client.from('sekelas_catalogs').update(next).eq('id', id).eq('revision', revision).select('revision').maybeSingle();
        if (result.error?.code === '23505') return false;
        if (result.error) throw result.error;
        return Boolean(result.data);
      },
      close() {}
    };
  }
  if (mode !== 'local' || process.env.VERCEL) {
    throw new Error('DATABASE_MODE harus supabase untuk deployment atau local untuk pengembangan lokal.');
  }
  const { DatabaseSync } = await import('node:sqlite');
  const path = options.path ?? process.env.SQLITE_PATH ?? resolve('data/sekelas.sqlite');
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS catalogs (
    id TEXT PRIMARY KEY, catalog TEXT NOT NULL, source TEXT NOT NULL, revision INTEGER NOT NULL
  )`);
  return {
    mode,
    async get(id) {
      const row = db.prepare('SELECT catalog, source, revision FROM catalogs WHERE id = ?').get(id);
      return row ? { ...row, catalog: JSON.parse(row.catalog) } : null;
    },
    async save(id, next, revision) {
      const data = [JSON.stringify(next.catalog), next.source, next.revision];
      const result = revision === 0
        ? db.prepare('INSERT OR IGNORE INTO catalogs (catalog,source,revision,id) VALUES (?,?,?,?)').run(...data, id)
        : db.prepare('UPDATE catalogs SET catalog=?,source=?,revision=? WHERE id=? AND revision=?').run(...data, id, revision);
      return result.changes === 1;
    },
    close() { db.close(); }
  };
}
