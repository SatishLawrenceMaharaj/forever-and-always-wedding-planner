/** Direct Google Drive REST API client, implemented with Node built-ins only. No Apps Script. */
import {randomUUID} from 'node:crypto';
import {DRIVE_FOLDER_ID} from './sample.js';

const DRIVE_API='https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD='https://www.googleapis.com/upload/drive/v3';
const ENTITY_NAMES=['tasks','inspiration','budget','guests','vendors','events','planners'];
const RECORD_PREFIX='wedding-planner--';
let tokenCache={token:'',expiresAt:0};

export function driveConfigured(){return !!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_REFRESH_TOKEN);}
export function driveFolderId(){return process.env.GOOGLE_DRIVE_FOLDER_ID||DRIVE_FOLDER_ID;}
function ensureConfigured(){
  if(!driveConfigured())throw new Error('Google Drive is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN in Vercel.');
}

async function accessToken(force=false){
  ensureConfigured();
  if(!force&&tokenCache.token&&Date.now()<tokenCache.expiresAt)return tokenCache.token;
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:process.env.GOOGLE_CLIENT_ID,
      client_secret:process.env.GOOGLE_CLIENT_SECRET,
      refresh_token:process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:'refresh_token'
    }),signal:AbortSignal.timeout(18000)
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload.access_token){
    const reason=payload.error==='invalid_grant'?'Refresh token expired or revoked. Reconnect your Google account and update GOOGLE_REFRESH_TOKEN.':
      'Google authorization failed. Check your GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN.';
    throw new Error(reason);
  }
  tokenCache={token:payload.access_token,expiresAt:Date.now()+Math.max(60,(payload.expires_in||3600)-120)*1000};
  return tokenCache.token;
}

async function driveRequest(method,url,{body,headers={},binary=false}={}){
  const request=async(force=false)=>fetch(url,{
    method,headers:{Authorization:`Bearer ${await accessToken(force)}`,...headers},body,
    signal:AbortSignal.timeout(23000)
  });
  let response=await request();
  if(response.status===401){tokenCache={token:'',expiresAt:0};response=await request(true);}
  if(!response.ok){
    let message='';
    try{const parsed=await response.json();message=parsed.error?.message||'';}catch{}
    if(response.status===403)throw new Error(`Google Drive permission or quota error (${response.status}). Confirm the connected Google account can edit your wedding folder. ${message.slice(0,160)}`);
    if(response.status===404)throw new Error(`Google Drive item not found (${response.status}). Confirm the account can access the folder.`);
    throw new Error(`Google Drive API request failed (${response.status}). ${message.slice(0,160)}`);
  }
  if(response.status===204)return null;
  return binary?Buffer.from(await response.arrayBuffer()):response.json();
}
function driveUrl(path,params={}){const u=new URL(`${DRIVE_API}${path}`);for(const [key,val] of Object.entries(params))u.searchParams.set(key,String(val));return u.toString();}

export async function listFolder(parentId){
  const results=[];
  let pageToken='';
  do{
    const params={q:`'${parentId.replace(/'/g,"\\'")}' in parents and trashed = false`,pageSize:1000,fields:'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,parents)',spaces:'drive'};
    if(pageToken)params.pageToken=pageToken;
    const json=await driveRequest('GET',driveUrl('/files',params));
    results.push(...(json.files||[]));pageToken=json.nextPageToken||'';
  }while(pageToken);
  return results;
}
export async function getFileJSON(id){return driveRequest('GET',driveUrl(`/files/${encodeURIComponent(id)}`,{alt:'media'}));}
export async function getFileBytes(id){return driveRequest('GET',driveUrl(`/files/${encodeURIComponent(id)}`,{alt:'media'}),{binary:true});}
export async function getFileMeta(id){return driveRequest('GET',driveUrl(`/files/${encodeURIComponent(id)}`,{fields:'id,name,mimeType,parents,trashed'}));}

function multipartBody(meta,bytes,mime){
  const boundary='wedding_'+randomUUID().replaceAll('-','');
  const before=Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`);
  const after=Buffer.from(`\r\n--${boundary}--\r\n`);
  return {body:Buffer.concat([before,bytes,after]),headers:{'Content-Type':`multipart/related; boundary=${boundary}`}};
}
export async function createFile(name,parentId,bytes,mime){
  const binary=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
  const options=multipartBody({name,parents:[parentId]},binary,mime);
  return driveRequest('POST',`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType`,options);
}
export async function createFolder(name,parentId){
  return driveRequest('POST',driveUrl('/files',{fields:'id,name'}),{
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parentId]})
  });
}
export async function updateFileJSON(id,data){
  return driveRequest('PATCH',`${DRIVE_UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media`,{
    headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(data)
  });
}
export async function trashFile(id){return driveRequest('PATCH',driveUrl(`/files/${encodeURIComponent(id)}`),{
  headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})
});}
export async function writeRecord(entity,id,record,existingId){
  if(!ENTITY_NAMES.includes(entity)&&entity!=='settings'&&entity!=='activity')throw new Error('Unknown record');
  if(existingId){await updateFileJSON(existingId,record);return existingId;}
  const name=entity==='settings'?`${RECORD_PREFIX}settings.json`:`${RECORD_PREFIX}${entity}--${id}.json`;
  const file=await createFile(name,driveFolderId(),JSON.stringify(record),'application/json');
  return file.id;
}
export function parseRecordFilename(name){
  if(name===`${RECORD_PREFIX}settings.json`)return {entity:'settings',id:'settings'};
  const match=/^wedding-planner--(tasks|inspiration|budget|guests|vendors|events|planners|activity)--([a-zA-Z0-9_-]+)\.json$/.exec(name||'');
  return match?{entity:match[1],id:match[2]}:null;
}
export async function fetchRecordFiles(){
  const files=await listFolder(driveFolderId());
  return files.map(f=>({...f,parsed:parseRecordFilename(f.name)})).filter(f=>f.parsed&&f.mimeType==='application/json');
}
export async function fetchInParallel(items,worker,concurrency=10){
  const results=new Array(items.length);let index=0;
  const workers=Array.from({length:Math.min(items.length,concurrency)},async()=>{
    while(index<items.length){const i=index++;results[i]=await worker(items[i],i);}
  });
  await Promise.all(workers);
  return results;
}
export async function findOrCreateImagesFolder(){
  const files=await listFolder(driveFolderId());
  const prior=files.find(f=>f.name==='Wedding Planner Images'&&f.mimeType==='application/vnd.google-apps.folder');
  if(prior)return prior.id;
  return (await createFolder('Wedding Planner Images',driveFolderId())).id;
}
