import { randomUUID } from 'node:crypto';
import { createDatabase } from '../src/config/database.js';

let database;
try {
  database = await createDatabase();
  await database.get(randomUUID());
  console.log('Koneksi database ' + database.mode + ' berhasil. Tabel katalog tersedia.');
} catch (error) {
  console.error('Database belum siap: ' + error.message);
  process.exitCode = 1;
} finally {
  database?.close();
}
