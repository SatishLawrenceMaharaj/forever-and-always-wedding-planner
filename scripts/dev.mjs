import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(!existsSync(new URL('../.env.local',import.meta.url))){
  const secret=randomBytes(32).toString('hex');
  writeFileSync(new URL('../.env.local',import.meta.url),`WEDDING_PASSWORD=STWed2027\nWEDDING_SESSION_SECRET=${secret}\nGOOGLE_APPS_SCRIPT_URL=\nGOOGLE_APPS_SCRIPT_SECRET=\nPORT=3000\n`,{mode:0o600});
  console.log('Created a private .env.local for local-only testing.');
}
process.loadEnvFile(new URL('../.env.local',import.meta.url));
await import('../server.js');
