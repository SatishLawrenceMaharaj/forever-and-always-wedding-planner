import {promises as fs} from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { freshData } from './sample.js';
import { applyChange } from './data.js';

const localRoot=path.join(process.cwd(),'.local-data');
const localFile=path.join(localRoot,'wedding-data.json');
const mediaDir=path.join(localRoot,'uploads');
let queue=Promise.resolve();

export function isCloud(){return Boolean(process.env.GOOGLE_APPS_SCRIPT_URL && process.env.GOOGLE_APPS_SCRIPT_SECRET);}
function requireConfigured() {
  if(!isCloud() && (process.env.VERCEL || process.env.NODE_ENV==='production'))
    throw new Error('Google Drive storage is not configured for production. Add GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_SECRET in Vercel.');
}
function lock(fn){const result=queue.then(fn,fn);queue=result.then(()=>{},()=>{});return result;}

async function callScript(action, details={}) {
  const response=await fetch(process.env.GOOGLE_APPS_SCRIPT_URL,{
    method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({token:process.env.GOOGLE_APPS_SCRIPT_SECRET,action,...details}),
    redirect:'follow',signal:AbortSignal.timeout(26000)
  });
  if(!response.ok)throw new Error(`Google Apps Script request failed (${response.status})`);
  const text=await response.text();
  let parsed;
  try{parsed=JSON.parse(text);}catch{throw new Error('Google Apps Script returned unexpected content. Check deployment access and Web App URL.');}
  if(!parsed.ok)throw new Error(parsed.error||'Google Drive operation failed');
  return parsed;
}
async function localRead() {
  try{return JSON.parse(await fs.readFile(localFile,'utf8'));}
  catch(e){if(e.code!=='ENOENT')throw e;await fs.mkdir(localRoot,{recursive:true});const d=freshData(true);await fs.writeFile(localFile,JSON.stringify(d,null,2));return d;}
}
async function localWrite(data){
  await fs.mkdir(localRoot,{recursive:true});
  const tmp=`${localFile}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp,JSON.stringify(data,null,2));
  await fs.rename(tmp,localFile);
}
export async function getData(){requireConfigured();return isCloud()?(await callScript('get')).data:localRead();}
export async function mutate(change){
  requireConfigured();
  if(isCloud())return (await callScript('mutate',{change})).data;
  return lock(async()=>{const data=await localRead();const result=applyChange(data,change);await localWrite(result);return result;});
}
const mimetypes={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
function checkSignature(bytes,mime){
  const b=bytes;
  if(mime==='image/jpeg')return b[0]===255&&b[1]===216&&b[2]===255;
  if(mime==='image/png')return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==='image/gif')return b.subarray(0,3).toString()==='GIF';
  if(mime==='image/webp')return b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';
  return false;
}
export async function uploadImage({base64,mime,name}){
  requireConfigured();
  if(!mimetypes[mime])throw new Error('Please upload a JPG, PNG, WEBP or GIF image.');
  if(typeof base64!=='string'||base64.length>4_050_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw new Error('Invalid image. Maximum size is 3 MB.');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length>3_000_000||bytes.length<12||!checkSignature(bytes,mime))throw new Error('Invalid image file. Maximum size is 3 MB.');
  if(isCloud())return (await callScript('upload',{base64,mime,name:String(name||'Wedding inspiration').slice(0,110)})).imageId;
  await fs.mkdir(mediaDir,{recursive:true});
  const id=`${randomUUID()}.${mimetypes[mime]}`;
  await fs.writeFile(path.join(mediaDir,id),bytes,{flag:'wx'});
  return id;
}
export async function getImage(id){
  requireConfigured();
  if(!/^[A-Za-z0-9_.-]{1,200}$/.test(id)||id.includes('..'))throw new Error('Invalid image ID');
  if(isCloud()){
    const result=await callScript('image',{imageId:id});
    if(!mimetypes[result.mime])throw new Error('Invalid image type');
    return {bytes:Buffer.from(result.base64,'base64'),mime:result.mime};
  }
  const ext=path.extname(id).slice(1);
  const mime=Object.keys(mimetypes).find(key=>mimetypes[key]===ext);
  if(!mime)throw new Error('Invalid image format');
  return {bytes:await fs.readFile(path.join(mediaDir,id)),mime};
}
