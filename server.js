import {createServer} from 'node:http';
import {handle} from './lib/app.js';
const port=Number(process.env.PORT||3000);
createServer((req,res)=>{handle(req,res).catch(err=>{console.error(err);if(!res.headersSent){res.statusCode=500;res.end('Internal error');}})}).listen(port,()=>{
 console.log(`\n💍 Wedding Planner running at http://localhost:${port}`);
 console.log('Storage: '+(process.env.GOOGLE_APPS_SCRIPT_URL?'Google Drive':'LOCAL TEST MODE (not shared)'));
});
