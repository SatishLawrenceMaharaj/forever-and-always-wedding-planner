import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareChange} from '../lib/data.js';
import {getData,mutate,getImage,uploadImage} from '../lib/store.js';
import {driveConfigured,parseRecordFilename} from '../lib/drive.js';

const HOME='1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXkAAAAASUVORK5CYII=';
function mockGoogle(){
  const files=new Map();let serial=0;
  function response(payload,status=200){return new Response(status===204?null:JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});}
  const fetchMock=async(rawUrl,opts={})=>{
    const u=new URL(rawUrl),p=u.pathname;
    if(u.hostname==='oauth2.googleapis.com')return response({access_token:'fake-access',expires_in:3600});
    if(u.hostname!=='www.googleapis.com')throw new Error('Unexpected host');
    if(p==='/drive/v3/files'&&opts.method==='GET'){
      const q=u.searchParams.get('q'),parent=q?.match(/^'([^']+)' in parents/)?.[1];
      return response({files:[...files.values()].filter(f=>!f.trashed&&f.parents.includes(parent)).map(({id,name,mimeType,parents,createdTime})=>({id,name,mimeType,parents,createdTime}))});
    }
    if(p==='/drive/v3/files'&&opts.method==='POST'){
      const meta=JSON.parse(opts.body);const id=`file${++serial}`;
      files.set(id,{...meta,id,createdTime:new Date().toISOString(),bytes:Buffer.alloc(0),trashed:false});
      return response({id,name:meta.name});
    }
    if(p==='/upload/drive/v3/files'&&opts.method==='POST'){
      const b=opts.body,headerEnd=b.indexOf('\r\n\r\n');
      const nextBoundary=b.indexOf('\r\n--',headerEnd+4);const meta=JSON.parse(b.subarray(headerEnd+4,nextBoundary).toString());
      const secondHeaderEnd=b.indexOf('\r\n\r\n',nextBoundary+4);
      const end=b.lastIndexOf('\r\n--');const bytes=b.subarray(secondHeaderEnd+4,end);
      const mime=b.subarray(nextBoundary,secondHeaderEnd).toString().match(/Content-Type: ([^\r\n]+)/)?.[1];
      const id=`file${++serial}`;
      files.set(id,{...meta,id,mimeType:mime,bytes,createdTime:new Date(Date.now()+serial).toISOString(),trashed:false});
      return response({id,name:meta.name,mimeType:mime});
    }
    const id=p.match(/\/files\/([^/]+)/)?.[1];
    if(!id)return response({error:{message:'invalid route'}},404);
    const f=files.get(id);if(!f||f.trashed)return response({error:{message:'missing'}},404);
    if(opts.method==='GET'){
      if(u.searchParams.get('alt')==='media')return new Response(f.bytes,{status:200});
      return response({id:f.id,name:f.name,mimeType:f.mimeType,parents:f.parents,trashed:f.trashed});
    }
    if(opts.method==='PATCH'&&p.startsWith('/upload/')){f.bytes=Buffer.from(opts.body);return response({id:f.id});}
    if(opts.method==='PATCH'){Object.assign(f,JSON.parse(opts.body));return response({id:f.id});}
    return response({error:{message:'invalid request'}},400);
  };
  return {files,fetchMock};
}

test('without OAuth vars, Drive is not accidentally used',()=>{
  delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET;delete process.env.GOOGLE_REFRESH_TOKEN;
  assert.equal(driveConfigured(),false);
  assert.deepEqual(parseRecordFilename('wedding-planner--guests--abc-123.json'),{entity:'guests',id:'abc-123'});
  assert.equal(parseRecordFilename('irrelevant-file.json'),null);
});

test('direct Google Drive API stores independent task records and photos without Apps Script',async()=>{
  const realFetch=globalThis.fetch;
  const {files,fetchMock}=mockGoogle();
  globalThis.fetch=fetchMock;
  process.env.GOOGLE_CLIENT_ID='mock-client';process.env.GOOGLE_CLIENT_SECRET='mock-secret';process.env.GOOGLE_REFRESH_TOKEN='mock-refresh';
  process.env.VERCEL='1';
  try{
    assert.deepEqual((await getData()).tasks,[]);
    const first=prepareChange({entity:'tasks',op:'create',actor:'Planner A',value:{title:'Book ceremony'}});
    const second=prepareChange({entity:'tasks',op:'create',actor:'Planner B',value:{title:'Book photographer'}});
    await Promise.all([mutate(first),mutate(second)]);
    let data=await getData();assert.equal(data.tasks.length,2);
    assert.ok(data.tasks.some(x=>x.title==='Book ceremony'));
    assert.ok(data.tasks.some(x=>x.title==='Book photographer'));
    await mutate(prepareChange({entity:'tasks',op:'update',id:first.id,value:{status:'done'}}));
    data=await getData();assert.equal(data.tasks.find(x=>x.id===first.id).status,'done');
    assert.equal(data.tasks.find(x=>x.id===second.id).title,'Book photographer');
    const imageId=await uploadImage({base64:png,mime:'image/png',name:'flowers.png'});
    const image=await getImage(imageId);assert.equal(image.mime,'image/png');assert.ok(image.bytes.length>20);
    await mutate(prepareChange({entity:'tasks',op:'delete',id:second.id}));
    data=await getData();assert.equal(data.tasks.length,1);
    assert.equal([...files.values()].filter(x=>x.name?.startsWith('wedding-planner--tasks--')).length,2);
  }finally{
    globalThis.fetch=realFetch;
    delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET;delete process.env.GOOGLE_REFRESH_TOKEN;delete process.env.VERCEL;
  }
});
