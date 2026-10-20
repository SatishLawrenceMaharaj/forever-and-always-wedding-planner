import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

function createDriveSimulator(){
  const files=new Map(),folders=new Map();let number=0;
  class BlobMock{
    constructor(content,mime,name){this.value=Buffer.isBuffer(content)?content:Buffer.from(content);this.mime=mime;this.name=name;}
    getBytes(){return Array.from(this.value);}
    getContentType(){return this.mime;}
    getDataAsString(){return this.value.toString();}
  }
  class FileMock{
    constructor(folder,name,value,mime){this.id='filemockabc123'+(++number);this.name=name;this.folder=folder;this.value=Buffer.isBuffer(value)?value:Buffer.from(value);this.mime=mime;files.set(this.id,this);}
    getName(){return this.name;}
    getBlob(){return new BlobMock(this.value,this.mime,this.name);}
    getId(){return this.id;}
    setContent(content){this.value=Buffer.from(content);return this;}
    getParents(){return iterator([this.folder]);}
  }
  class FolderMock{
    constructor(name,parent=null,id='folder-'+(++number)){this.name=name;this.parent=parent;this.id=id;folders.set(this.id,this);}
    getId(){return this.id;}
    createFile(nameOrBlob,content,mime){return nameOrBlob instanceof BlobMock?new FileMock(this,nameOrBlob.name,nameOrBlob.value,nameOrBlob.mime):new FileMock(this,nameOrBlob,content,mime);}
    getFiles(){return iterator([...files.values()].filter(f=>f.folder===this));}
    getFoldersByName(n){return iterator([...folders.values()].filter(f=>f.parent===this&&f.name===n));}
    createFolder(n){return new FolderMock(n,this);}
  }
  function iterator(items){let i=0;return {hasNext:()=>i<items.length,next:()=>items[i++]};}
  const root=new FolderMock('Weddings',null,'1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4');
  const context={
    console,JSON,Date,Math,Array,Object,String,Error,Boolean,RegExp,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==='APP_SECRET'?'a'.repeat(64):null})},
    DriveApp:{getFolderById(id){assert.equal(id,root.id);return root;},getFileById(id){if(!files.has(id))throw Error('Not found');return files.get(id);}},
    LockService:{getScriptLock:()=>({waitLock(ms){assert.equal(ms,25000);},releaseLock(){}})},
    ContentService:{createTextOutput:s=>({string:s,setMimeType(){return this;}}),MimeType:{JSON:'application/json'}},
    MimeType:{PLAIN_TEXT:'text/plain'},
    Utilities:{getUuid:()=>`uuid-${++number}`,base64Decode:s=>[...Buffer.from(s,'base64')],base64Encode:b=>Buffer.from(b).toString('base64'),newBlob:(b,mime,n)=>new BlobMock(Buffer.from(b),mime,n)}
  };
  return {context,root,files,folders};
}
const SECRET='a'.repeat(64);
function call(script,action,extra={}){return JSON.parse(script.doPost({postData:{contents:JSON.stringify({token:SECRET,action,...extra})}}).string);}

test('Drive bridge creates missing category files and stores tasks, other records, and pictures',async()=>{
  const source=await readFile(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8');
  const {context,root,folders}=createDriveSimulator();
  const script=runInNewContext(`${source}\n({doPost,doGet})`,context);
  const blocked=JSON.parse(script.doPost({postData:{contents:JSON.stringify({action:'get'})}}).string);
  assert.equal(blocked.ok,false);
  assert.equal(root.getFiles().hasNext(),false);
  const initial=call(script,'get');assert.equal(initial.ok,true,initial.error);
  assert.equal(initial.data.tasks.length,0);
  const names=[];const itr=root.getFiles();while(itr.hasNext())names.push(itr.next().getName());
  for(const name of ['To Do.json','In Progress.json','Done.json','Budget.json','Guests.json','Vendors.json','Timeline.json','Planners.json','Inspiration.json','Settings.json','Activity.json'])assert.ok(names.includes(name),name);
  const create=call(script,'mutate',{change:{entity:'tasks',op:'create',id:'t1',actor:'Wedding Planner A',value:{title:'Reserve venue',assignee:'Sam',priority:'high',status:'todo',dueDate:'2027-01-01'}}});
  assert.equal(create.ok,true,create.error);
  assert.equal(create.data.tasks.find(t=>t.id==='t1').assignee,'Sam');
  const update=call(script,'mutate',{change:{entity:'tasks',op:'update',id:'t1',actor:'Sam',value:{status:'in_progress'}}});
  assert.equal(update.ok,true,update.error);
  const f1=root.getFiles();let todo,progress;while(f1.hasNext()){const f=f1.next();if(f.name==='To Do.json')todo=JSON.parse(f.getBlob().getDataAsString());if(f.name==='In Progress.json')progress=JSON.parse(f.getBlob().getDataAsString());}
  assert.equal(todo.length,0);assert.equal(progress.length,1);assert.equal(progress[0].assignee,'Sam');
  const done=call(script,'mutate',{change:{entity:'tasks',op:'update',id:'t1',value:{status:'done'}}});
  assert.equal(done.data.tasks[0].status,'done');
  const budget=call(script,'mutate',{change:{entity:'budget',op:'create',id:'b1',value:{title:'Photography',estimated:1200,actual:300}}});
  assert.equal(budget.data.budget[0].title,'Photography');
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXkAAAAASUVORK5CYII=';
  const saved=call(script,'upload',{base64:png,mime:'image/png',name:'flowers.png'});
  assert.equal(saved.ok,true,saved.error);
  const picture=call(script,'image',{imageId:saved.imageId});assert.equal(picture.ok,true,picture.error);assert.equal(picture.base64,png);
  assert.ok([...folders.values()].some(f=>f.name==='Wedding Planner Images'));
  assert.equal(call(script,'get').data.activity.length,4);
});
