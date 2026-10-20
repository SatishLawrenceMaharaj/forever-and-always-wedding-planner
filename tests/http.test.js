import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Using a temp working directory ensures no demo data is altered by tests.
test('password protects the site and API; authorized planners can persist changes and upload photos',async()=>{
  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))), original=process.cwd();
  const sandbox=await mkdtemp(path.join(tmpdir(),'wedding-test-'));
  process.chdir(sandbox);
  process.env.WEDDING_PASSWORD='STWed2027';
  process.env.WEDDING_SESSION_SECRET=randomBytes(32).toString('hex');
  delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET;delete process.env.GOOGLE_REFRESH_TOKEN;
  const {handle}=await import('../lib/app.js');
  const http=createServer((req,res)=>{handle(req,res)});
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${http.address().port}`;
  const post=(url,payload,cookie='')=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(payload)});
  try{
    const visitor=await fetch(base+'/');assert.equal(visitor.status,200);assert.match(await visitor.text(),/Wedding access password/);
    assert.equal((await fetch(base+'/app.js')).status,401);
    assert.equal((await fetch(base+'/api/data')).status,401);
    const wrong=await post('/api/login',{password:'wrong'});assert.equal(wrong.status,401);
    assert.equal(wrong.headers.get('set-cookie'),null);
    const good=await post('/api/login',{password:'STWed2027'});assert.equal(good.status,200);
    const setCookie=good.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);
    const cookie=setCookie.split(';')[0];
    const site=await fetch(base+'/',{headers:{Cookie:cookie}});assert.equal(site.status,200);assert.match(await site.text(),/id="app"/);
    const dataRes=await fetch(base+'/api/data',{headers:{Cookie:cookie}});assert.equal(dataRes.status,200);
    const data=await dataRes.json();assert.equal(data.mode,'local');assert.ok(data.data.tasks.length>=1);
    const created=await post('/api/data',{entity:'tasks',op:'create',actor:'Tester',value:{title:'Confirm the cake tasting',status:'todo',priority:'high'}},cookie);
    assert.equal(created.status,200,await created.clone().text());const createdData=(await created.json()).data;
    const task=createdData.tasks.find(t=>t.title==='Confirm the cake tasting');assert.ok(task);
    const update=await post('/api/data',{entity:'tasks',op:'update',id:task.id,value:{status:'done'}},cookie);
    assert.equal(update.status,200);assert.equal((await update.json()).data.tasks.find(t=>t.id===task.id).status,'done');
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXkAAAAASUVORK5CYII=';
    const uploaded=await post('/api/upload',{base64:png,mime:'image/png',name:'demo.png'},cookie);
    assert.equal(uploaded.status,200,await uploaded.clone().text());const meta=await uploaded.json();
    const image=await fetch(base+meta.url,{headers:{Cookie:cookie}});
    assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
    assert.equal((await fetch(base+meta.url)).status,401);
    const logout=await post('/api/logout',{},cookie);assert.equal(logout.status,200);
    assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  }finally{http.close();await rm(sandbox,{recursive:true,force:true});process.chdir(original);}
});
