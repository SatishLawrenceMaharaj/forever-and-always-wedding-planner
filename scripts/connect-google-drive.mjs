/** One-time, local-only Google OAuth connection. The app never stores tokens in a browser. */
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';

const file='.env.local';
let raw='';try{raw=await readFile(file,'utf8');}catch{}
function setting(key){return process.env[key]||raw.match(new RegExp(`^${key}=(.*)$`,'m'))?.[1]?.trim()||'';}
const clientId=setting('GOOGLE_CLIENT_ID'),clientSecret=setting('GOOGLE_CLIENT_SECRET');
if(!clientId||!clientSecret){
  console.error('First, add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from your Google Cloud Desktop OAuth client to .env.local, then run npm run connect:drive again.');
  process.exit(1);
}
const state=randomBytes(28).toString('hex');
const codeVerifier=randomBytes(64).toString('base64url');
const codeChallenge=createHash('sha256').update(codeVerifier).digest('base64url');
let server;
const finish=()=>setTimeout(()=>server.close(),150);
server=createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://127.0.0.1:${server.address().port}`);
  if(url.pathname!=='/oauth2callback'){
    res.writeHead(404);res.end('Not found');return;
  }
  if(url.searchParams.get('state')!==state){res.writeHead(403);res.end('Google connection state mismatch.');return;}
  if(url.searchParams.has('error')){res.writeHead(400);res.end('Access was not granted. You can close this tab.');finish();return;}
  const code=url.searchParams.get('code');
  if(!code){res.writeHead(400);res.end('No authorization code.');finish();return;}
  try{
    const redirectUri=`http://127.0.0.1:${server.address().port}/oauth2callback`;
    const response=await fetch('https://oauth2.googleapis.com/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code',code_verifier:codeVerifier})
    });
    const body=await response.json();
    if(!response.ok||!body.refresh_token)throw new Error('Google did not return a refresh token. Ensure prompt=consent, use a Desktop OAuth client, then retry.');
    if(/^GOOGLE_REFRESH_TOKEN=/m.test(raw))raw=raw.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m,`GOOGLE_REFRESH_TOKEN=${body.refresh_token}`);
    else raw+=`\nGOOGLE_REFRESH_TOKEN=${body.refresh_token}\n`;
    await writeFile(file,raw,{mode:0o600});
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end('<h2>Google Drive connected successfully.</h2><p>You can close this tab. Your refresh token was saved to your local .env.local file. Add its value to Vercel as GOOGLE_REFRESH_TOKEN.</p>');
    console.log('\nGoogle Drive authorization succeeded.');
    console.log('GOOGLE_REFRESH_TOKEN was saved to .env.local (do not commit or share that file).');
    console.log('Copy its value into Vercel > Environment Variables as GOOGLE_REFRESH_TOKEN.');
  }catch(err){
    res.writeHead(500,{'Content-Type':'text/plain'});res.end('Google authorization failed. Check the terminal.');
    console.error('Google authorization failed:',err.message);
  }finally{finish();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const redirectUri=`http://127.0.0.1:${server.address().port}/oauth2callback`;
const params=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',access_type:'offline',prompt:'consent',scope:'https://www.googleapis.com/auth/drive',code_challenge:codeChallenge,code_challenge_method:'S256',state});
console.log('\nGoogle Drive Authorization — Wedding Planner');
console.log('\n1. Open this URL in a browser on THIS computer:');
console.log(`\nhttps://accounts.google.com/o/oauth2/v2/auth?${params}\n`);
console.log('2. Sign in to the Google account that OWNS or can edit the wedding folder.');
console.log('3. Approve the Drive permission. Your browser will redirect to this local Node.js program.');
console.log('4. After success, copy GOOGLE_REFRESH_TOKEN from your local .env.local into Vercel.');
console.log('\nThis local server is for one-time authorization only. No third-party bridge is needed.');
