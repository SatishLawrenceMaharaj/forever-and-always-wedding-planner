import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
import { createSession, makeCookie, clearCookie, isAuthenticated, matchesPassword, recordAttempt, tooManyAttempts, hasServerSecrets } from './security.js';
import { prepareChange } from './data.js';
import { getData, getImage, isCloud, mutate, uploadImage } from './store.js';
import { DRIVE_FOLDER_URL } from './sample.js';

const publicFiles={
 '/':'web/app.html','/login':'web/login.html','/styles.css':'web/styles.css',
 '/app.js':'web/app.js','/favicon.svg':'web/favicon.svg'
};
const types={'html':'text/html; charset=utf-8','css':'text/css; charset=utf-8','js':'text/javascript; charset=utf-8','svg':'image/svg+xml'};

function send(res,status,body,headers={}){
  res.writeHead(status,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"frame-ancestors 'none'",...headers});
  res.end(body);
}
function json(res,status,obj,headers={}){send(res,status,JSON.stringify(obj),{'Content-Type':'application/json; charset=utf-8',...headers});}
async function requestBody(req){
  if(req.body!==undefined && req.body!==null){
    if(typeof req.body==='object' && !Buffer.isBuffer(req.body))return req.body;
    if(typeof req.body==='string')return JSON.parse(req.body);
  }
  let bytes=0,chunks=[];
  for await(const chunk of req){bytes+=chunk.length;if(bytes>4_200_000)throw new Error('Request too large (3 MB image limit).');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
}
function requestPath(req){
  const url=new URL(req.url||'/', 'http://localhost');
  const route=req.query?.route || url.searchParams.get('route');
  if(route)return '/'+String(route).replace(/^\/+/,'').replace(/^root$/,'');
  return url.pathname;
}
function sameOrigin(req){
  const origin=req.headers.origin;
  if(!origin)return true;
  try{
    const u=new URL(origin);
    const host=req.headers['x-forwarded-host']||req.headers.host;
    return u.host===host && ['http:','https:'].includes(u.protocol);
  }catch{return false;}
}
async function file(res,filename){
  try{
    const body=await readFile(path.join(PROJECT_ROOT,filename));
    const extension=filename.split('.').at(-1);
    send(res,200,body,{'Content-Type':types[extension]||'application/octet-stream'});
  }catch{send(res,500,'Could not load the page.');}
}

export async function handle(req,res){
  const p=requestPath(req),method=req.method||'GET';
  try{
    if(method==='POST'&&!sameOrigin(req))return json(res,403,{error:'Cross-site requests are blocked.'});
    if(p==='/api/login'){
      if(method!=='POST')return json(res,405,{error:'Method not allowed'});
      if(!hasServerSecrets())return json(res,503,{error:'Website password is not configured on the server.'});
      const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
      if(tooManyAttempts(ip))return json(res,429,{error:'Too many incorrect attempts. Please try again later.'});
      const body=await requestBody(req);
      const success=matchesPassword(body.password);
      recordAttempt(ip,success);
      if(!success)return json(res,401,{error:'That password is not correct. Please try again.'});
      return json(res,200,{ok:true},{'Set-Cookie':makeCookie(createSession(),req)});
    }
    if(!isAuthenticated(req)){
      if(method==='GET'&&(p==='/'||p==='/login'))return file(res,'web/login.html');
      return json(res,401,{error:'Please enter the wedding password to continue.'});
    }
    if(p==='/login'&&method==='GET')return send(res,302,'',{'Location':'/'});
    if(p==='/api/logout'){
      if(method!=='POST')return json(res,405,{error:'Method not allowed'});
      return json(res,200,{ok:true},{'Set-Cookie':clearCookie(req)});
    }
    if(p==='/api/data'){
      if(method==='GET')return json(res,200,{data:await getData(),mode:isCloud()?'drive':'local',driveFolderUrl:DRIVE_FOLDER_URL});
      if(method==='POST')return json(res,200,{data:await mutate(prepareChange(await requestBody(req))),mode:isCloud()?'drive':'local'});
      return json(res,405,{error:'Method not allowed'});
    }
    if(p==='/api/upload'){
      if(method!=='POST')return json(res,405,{error:'Method not allowed'});
      const body=await requestBody(req);
      const imageId=await uploadImage(body);
      return json(res,200,{imageId,url:`/api/images/${encodeURIComponent(imageId)}`});
    }
    if(p.startsWith('/api/images/')){
      if(method!=='GET')return json(res,405,{error:'Method not allowed'});
      const id=decodeURIComponent(p.slice('/api/images/'.length));
      const image=await getImage(id);
      return send(res,200,image.bytes,{'Content-Type':image.mime,'Cache-Control':'private, max-age=3600','Content-Security-Policy':"default-src 'none'; sandbox"});
    }
    if(method==='GET'&&Object.hasOwn(publicFiles,p))return file(res,publicFiles[p]);
    if(method==='GET'&&p==='/health')return json(res,200,{ok:true,storage:isCloud()?'drive':'local'});
    return json(res,404,{error:'Page not found'});
  }catch(err){
    const text=String(err?.message||'Unknown error');
    const userError=/Invalid|Missing|Unknown|Please|no longer|already|too large|Maximum|not configured/i.test(text);
    if(!userError)console.error('[wedding-planner]',text);
    return json(res,userError?400:500,{error:userError?text:'A server error occurred. Please try again or check the server logs.'});
  }
}
