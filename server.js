import { fileURLToPath } from 'node:url';
import { createDatabase } from './src/config/database.js';
import { createApp } from './src/app.js';

const database = await createDatabase();
const app = createApp(database);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log('Sekelas: http://localhost:' + port);
    console.log('Database: ' + database.mode);
  });
}

export default app;
