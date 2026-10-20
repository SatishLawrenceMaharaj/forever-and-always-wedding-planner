import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {freshData} from './sample.js';
import {applyChange} from './data.js';
import {createFile,driveConfigured,driveFolderId,fetchInParallel,fetchRecordFiles,findOrCreateImagesFolder,getFileBytes,getFileJSON,getFileMeta,trashFile,writeRecord} from './drive.js';

const localRoot=path.join(process.cwd(),'.local-data');
const localFile=path.join(localRoot,'wedding-data.json');
const mediaDir=path.join(localRoot,'uploads');
let queue=Promise.resolve();

export function isCloud(){return driveConfigured();}
function requireConfigured(){
  if(!isCloud()&&(process.env.VERCEL||process.env.NODE_ENV==='production'))
    throw new Error('Google Drive is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in Vercel.');
}
function lock(fn){const result=queue.then(fn,fn);queue=result.then(()=>{},()=>{});return result;}

async function localRead(){
  try{return JSON.parse(await fs.readFile(localFile,'utf8'));}
  catch(e){if(e.code!=='ENOENT')throw e;await fs.mkdir(localRoot,{recursive:true});const d=freshData(true);await fs.writeFile(localFile,JSON.stringify(d,null,2));return d;}
}
async function localWrite(data){
  await fs.mkdir(localRoot,{recursive:true});
  const tmp=`${localFile}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp,JSON.stringify(data,null,2));
  await fs.rename(tmp,localFile);
}

/** Each item occupies its own Drive file: two planners editing different items never overwrite the same JSON document. */
async function readDrive(){
  const all=await fetchRecordFiles();
  const activities=all.filter(f=>f.parsed.entity==='activity').sort((a,b)=>(b.createdTime||'').localeCompare(a.createdTime||'')).slice(0,60);
  const others=all.filter(f=>f.parsed.entity!=='activity');
  const selected=[...others,...activities];
  const records=await fetchInParallel(selected,async file=>({...file,record:await getFileJSON(file.id)}));
  const data=freshData(false), fileMap=new Map();
  for(const f of records){
    const {entity,id}=f.parsed;
    if(entity==='settings'){
      data.settings={...data.settings,...f.record};fileMap.set('settings',f.id);
    }else if(entity==='activity'){
      data.activity.push(f.record);
    }else if(Array.isArray(data[entity])){
      if(f.record?.id===id){data[entity].push(f.record);fileMap.set(`${entity}:${id}`,f.id);}
    }
  }
  for(const entity of ['tasks','inspiration','budget','guests','vendors','events','planners']){
    data[entity].sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  }
  data.activity.sort((a,b)=>(b.at||'').localeCompare(a.at||''));data.activity=data.activity.slice(0,60);
  data.updatedAt=data.activity[0]?.at||new Date().toISOString();
  return {data,fileMap};
}

export async function getData(){requireConfigured();return isCloud()?(await readDrive()).data:localRead();}
export async function mutate(change){
  requireConfigured();
  if(isCloud()){
    const {data:before,fileMap}=await readDrive();
    const after=applyChange(before,change);
    if(change.entity==='settings'){
      await writeRecord('settings','settings',after.settings,fileMap.get('settings'));
    }else if(change.entity==='starter'){
      await fetchInParallel(after.tasks,task=>writeRecord('tasks',task.id,task),6);
    }else if(change.op==='delete'){
      const fileId=fileMap.get(`${change.entity}:${change.id}`);
      if(!fileId)throw new Error('Item no longer exists. Please refresh.');
      await trashFile(fileId);
    }else{
      const item=after[change.entity].find(record=>record.id===change.id);
      await writeRecord(change.entity,change.id,item,fileMap.get(`${change.entity}:${change.id}`));
    }
    // A separate immutable activity file avoids a shared log-file write bottleneck.
    try{await writeRecord('activity',after.activity[0].id,after.activity[0]);}
    catch(e){console.error('[wedding-planner] Could not record activity:',String(e?.message||e));}
    return after;
  }
  return lock(async()=>{const data=await localRead();const result=applyChange(data,change);await localWrite(result);return result;});
}

const mimetypes={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
function checkSignature(b,mime){
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
  if(isCloud()){
    const folderId=await findOrCreateImagesFolder();
    const safe=String(name||'inspiration').replace(/[^a-zA-Z0-9._-]/g,'-').slice(-90);
    const file=await createFile(`${randomUUID()}-${safe}.${mimetypes[mime]}`,folderId,bytes,mime);
    return file.id;
  }
  await fs.mkdir(mediaDir,{recursive:true});
  const id=`${randomUUID()}.${mimetypes[mime]}`;
  await fs.writeFile(path.join(mediaDir,id),bytes,{flag:'wx'});
  return id;
}
export async function getImage(id){
  requireConfigured();
  if(!/^[A-Za-z0-9_.-]{1,200}$/.test(id)||id.includes('..'))throw new Error('Invalid image ID');
  if(isCloud()){
    const file=await getFileMeta(id);
    if(file.trashed||!mimetypes[file.mimeType])throw new Error('Invalid image file');
    // Enforce ancestry: authentication alone must not grant access to unrelated Drive files.
    const parents=file.parents||[];let allowed=false;
    for(const parentId of parents){
      const folder=await getFileMeta(parentId);
      if(folder.name==='Wedding Planner Images'&&(folder.parents||[]).includes(driveFolderId()))allowed=true;
    }
    if(!allowed)throw new Error('Image is outside your wedding folder');
    return {bytes:await getFileBytes(id),mime:file.mimeType};
  }
  const ext=path.extname(id).slice(1);
  const mime=Object.keys(mimetypes).find(key=>mimetypes[key]===ext);
  if(!mime)throw new Error('Invalid image format');
  return {bytes:await fs.readFile(path.join(mediaDir,id)),mime};
}
