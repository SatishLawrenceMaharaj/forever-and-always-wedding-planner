/**
 * Wedding Planner Google Drive bridge (Google Apps Script, V8 runtime)
 * This script runs as the Google account that deploys it.
 * In Apps Script > Project Settings > Script properties add:
 *   APP_SECRET = a random 64+ character string (also set in Vercel)
 * The Drive folder must be editable by the deploying Google account.
 * Web app deployment: Execute as Me; Who has access: Anyone.
 * The secret is checked on EVERY request. Never put the secret in browser code.
 */
var WEDDING_FOLDER_ID = '1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4';
var WEDDING_DATA_FILENAME = 'wedding-planner-data.json';
var WEDDING_IMAGE_FOLDER = 'Wedding Planner Images';

function doPost(e) {
  try {
    var request = JSON.parse((e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('APP_SECRET');
    if (!expected || expected.length < 32 || request.token !== expected) {
      return respond_({ok:false,error:'Unauthorized request'});
    }
    if (request.action === 'get') {
      return withLock_(function () { return respond_({ok:true,data:readData_()}); });
    }
    if (request.action === 'mutate') {
      return withLock_(function () {
        var data = readData_();
        var next = mutateData_(data, request.change);
        writeData_(next);
        return respond_({ok:true,data:next});
      });
    }
    if (request.action === 'upload') {
      return withLock_(function () {
        if (!/^(image\/jpeg|image\/png|image\/webp|image\/gif)$/.test(request.mime || '')) throw new Error('Invalid image type');
        if (typeof request.base64 !== 'string' || request.base64.length > 4050000) throw new Error('Image is too large');
        var blob = Utilities.newBlob(Utilities.base64Decode(request.base64), request.mime, String(request.name || 'Wedding Photo').slice(0,100));
        if (blob.getBytes().length > 3000000) throw new Error('Maximum image size is 3 MB');
        var imageFile = getImageFolder_().createFile(blob);
        return respond_({ok:true,imageId:imageFile.getId()});
      });
    }
    if (request.action === 'image') {
      var imageFolder = getImageFolder_();
      var f = DriveApp.getFileById(String(request.imageId || ''));
      var parents = f.getParents(),allowed = false;
      while(parents.hasNext())if(parents.next().getId()===imageFolder.getId())allowed=true;
      if(!allowed)throw new Error('Image not found in wedding folder');
      var blob=f.getBlob();
      if(!/^(image\/jpeg|image\/png|image\/webp|image\/gif)$/.test(blob.getContentType()))throw new Error('Invalid image type');
      return respond_({ok:true,mime:blob.getContentType(),base64:Utilities.base64Encode(blob.getBytes())});
    }
    throw new Error('Unknown operation');
  } catch(err) {
    console.error(err);
    return respond_({ok:false,error:String(err.message || err)});
  }
}

function respond_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function withLock_(fn){var lock=LockService.getScriptLock();lock.waitLock(25000);try{return fn();}finally{lock.releaseLock();}}
function folder_(){return DriveApp.getFolderById(WEDDING_FOLDER_ID);}
function getDataFile_(){
  var parent=folder_(),matches=parent.getFilesByName(WEDDING_DATA_FILENAME);
  if(matches.hasNext())return matches.next();
  return parent.createFile(WEDDING_DATA_FILENAME,JSON.stringify(emptyData_(),null,2),MimeType.PLAIN_TEXT);
}
function readData_(){return JSON.parse(getDataFile_().getBlob().getDataAsString('UTF-8'));}
function writeData_(data){getDataFile_().setContent(JSON.stringify(data,null,2));}
function getImageFolder_(){
  var list=folder_().getFoldersByName(WEDDING_IMAGE_FOLDER);
  return list.hasNext()?list.next():folder_().createFolder(WEDDING_IMAGE_FOLDER);
}
function emptyData_(){
  return {version:1,updatedAt:new Date().toISOString(),settings:{partnerOne:'',partnerTwo:'',weddingDate:'',venue:'',location:'',currency:'TTD',tagline:'A beautiful beginning, together.'},
    tasks:[],inspiration:[],budget:[],guests:[],vendors:[],events:[],planners:[],activity:[]};
}
var starter_ = [
 ['Set your wedding budget','Planning','high'],['Choose a wedding date','Planning','high'],
 ['Book the ceremony and reception venue','Venue','high'],['Create the first guest list','Guests','high'],
 ['Book your photographer','Photography','high'],['Decide on colours and styling','Decor','medium'],
 ['Research caterers and schedule tastings','Catering','high'],['Choose the wedding party','Planning','medium'],
 ['Shop for wedding attire','Attire','medium'],['Book a florist','Decor','medium'],
 ['Book entertainment or DJ','Entertainment','medium'],['Plan invitations and save-the-dates','Stationery','medium'],
 ['Book hair and makeup','Beauty','medium'],['Arrange transportation','Transport','low'],
 ['Plan the ceremony order','Ceremony','medium'],['Confirm vendor timelines','Planning','medium'],
 ['Finalize the seating plan','Guests','medium'],['Confirm final guest count','Guests','high'],
 ['Prepare final vendor payments','Budget','high'],['Pack everything for the big day','Planning','medium']
];
function mutateData_(data,change){
  if(!change || !change.entity || !change.op)throw new Error('Invalid change');
  var allow=['tasks','inspiration','budget','guests','vendors','events','planners'];
  var now=new Date().toISOString(),itemLabel='wedding details';
  if(change.entity==='settings' && change.op==='update') {
    Object.keys(change.value||{}).forEach(function(k){
      if(['partnerOne','partnerTwo','weddingDate','venue','location','currency','tagline'].indexOf(k)>=0)data.settings[k]=change.value[k];
    });
  }else if(change.entity==='starter' && change.op==='create'){
    if(data.tasks.length)throw new Error('Starter checklist requires an empty task list');
    data.tasks=starter_.map(function(task){return {id:Utilities.getUuid(),title:task[0],category:task[1],priority:task[2],status:'todo',notes:'',assignee:'',dueDate:'',createdAt:now,updatedAt:now};});
    itemLabel='the starter checklist';
  }else if(allow.indexOf(change.entity)>=0 && ['create','update','delete'].indexOf(change.op)>=0){
    var arr=data[change.entity],index=arr.findIndex(function(item){return item.id===change.id;});
    if(change.op==='create'){
      arr.unshift(Object.assign({id:change.id,createdAt:now,updatedAt:now},change.value||{}));
    }else if(change.op==='update'){
      if(index<0)throw new Error('Item no longer exists');
      arr[index]=Object.assign({},arr[index],change.value||{},{updatedAt:now});
    }else{
      if(index<0)throw new Error('Item no longer exists');
      itemLabel=arr[index].title||arr[index].name||change.entity;
      arr.splice(index,1);
    }
    if(change.op!=='delete')itemLabel=(change.value||{}).title||(change.value||{}).name||change.entity;
  }else throw new Error('Unknown operation');
  var verb={create:'added',update:'updated',delete:'removed'}[change.op]||'changed';
  data.activity=[{id:Utilities.getUuid(),actor:String(change.actor||'A planner').slice(0,100),text:verb+' '+itemLabel,at:now}].concat(data.activity||[]).slice(0,60);
  data.updatedAt=now;
  return data;
}
