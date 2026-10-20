import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';

test('Vercel-style deployment renders embedded login without storage variables and returns clear setup error',async()=>{
  process.env.VERCEL='1';
  process.env.NODE_ENV='production';
  process.env.WEDDING_PASSWORD='STWed2027';
  process.env.WEDDING_SESSION_SECRET=randomBytes(32).toString('hex');
  delete process.env.GOOGLE_APPS_SCRIPT_URL;
  delete process.env.GOOGLE_APPS_SCRIPT_SECRET;
  const {handle}=await import('../lib/app.js');
  const http=createServer(handle);
  await new Promise(r=>http.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${http.address().port}`;
  try{
    const landing=await fetch(origin+'/?route=root');
    assert.equal(landing.status,200);
    assert.match(await landing.text(),/Wedding access password/);
    const noAccess=await fetch(origin+'/app.js');
    assert.equal(noAccess.status,401);
    const signed=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'STWed2027'})});
    assert.equal(signed.status,200);
    const cookie=signed.headers.get('set-cookie').split(';')[0];
    const workspace=await fetch(origin+'/',{headers:{Cookie:cookie}});
    assert.equal(workspace.status,200);
    assert.match(await workspace.text(),/id="app"/);
    for(const asset of ['/app.js','/styles.css','/favicon.svg']){
      const response=await fetch(origin+asset,{headers:{Cookie:cookie}});
      assert.equal(response.status,200,asset);
      assert.ok((await response.text()).length>15);
    }
    const data=await fetch(origin+'/api/data',{headers:{Cookie:cookie}});
    assert.equal(data.status,503);
    assert.match((await data.json()).error,/not connected/);
  }finally{http.close();}
});
