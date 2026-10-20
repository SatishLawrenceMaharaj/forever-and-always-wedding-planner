/**
 * Forever & Always Wedding Planner — Google Drive folder connector.
 * GOOGLE CLOUD CONSOLE IS NOT REQUIRED. No paid database.
 *
 * Runs under your own Google account through the free Google Apps Script editor.
 * It is a private storage adapter; all wedding planning logic and UI live on Vercel.
 *
 * Google Apps Script -> Project Settings -> Script properties:
 *   APP_SECRET = <your own random 64-character hex string>
 *
 * Deploy -> Web app -> Execute as Me -> Who has access: Anyone.
 * This endpoint authenticates each request using APP_SECRET in the POST body.
 * Never put APP_SECRET in client-side JS or share your Apps Script URL publicly.
 */
var WEDDING_FOLDER_ID = '1ihLbsZeSl8hZ37Bec7mijpX6zkqr2IC4';
var WEDDING_IMAGES = 'Wedding Planner Images';
var WEDDING_FILES = {
  todo:'To Do.json',
  progress:'In Progress.json',
  done:'Done.json',
  inspiration:'Inspiration.json',
  budget:'Budget.json',
  guests:'Guests.json',
  vendors:'Vendors.json',
  events:'Timeline.json',
  planners:'Planners.json',
  settings:'Settings.json',
  activity:'Activity.json'
};

function doGet(){return respond_({ok:true,message:'Wedding storage connector is available. All data operations require authentication.'});}
function doPost(e){
  try{
    var req=JSON.parse(e && e.postData && e.postData.contents || '{}');
    var expected=PropertiesService.getScriptProperties().getProperty('APP_SECRET');
    if(typeof expected!=='string' || expected.length<32 || typeof req.token!=='string' || req.token!==expected)
      return respond_({ok:false,error:'Storage connection authentication failed. Verify the secret in Vercel and Apps Script.'});
    if(req.action==='get')return locked_(function(){
      var folder=DriveApp.getFolderById(WEDDING_FOLDER_ID),files=ensureFiles_(folder);
      return respond_({ok:true,data:readPlan_(files)});
    });
    if(req.action==='mutate')return locked_(function(){
      var folder=DriveApp.getFolderById(WEDDING_FOLDER_ID),files=ensureFiles_(folder);
      var before=readPlan_(files),after=mutatePlan_(before,req.change);
      saveChange_(files,after,req.change);
      return respond_({ok:true,data:after});
    });
    if(req.action==='upload')return locked_(function(){
      if(!/^(image\/jpeg|image\/png|image\/webp|image\/gif)$/.test(req.mime||''))throw new Error('Invalid image type');
      if(typeof req.base64!=='string'||req.base64.length>4050000||!/^[A-Za-z0-9+/]+={0,2}$/.test(req.base64))throw new Error('Invalid image data or image too large.');
      var bytes=Utilities.base64Decode(req.base64);
      if(bytes.length<12||bytes.length>3000000)throw new Error('Image must be smaller than 3 MB.');
      var name=String(req.name||'Wedding Photo').replace(/[\\/<>:"|?*]/g,'-').slice(0,90);
      var blob=Utilities.newBlob(bytes,req.mime,Utilities.getUuid()+'-'+name);
      return respond_({ok:true,imageId:imageFolder_().createFile(blob).getId()});
    });
    if(req.action==='image'){
      var id=String(req.imageId||'');
      if(!/^[A-Za-z0-9_-]{8,200}$/.test(id))throw new Error('Invalid image ID');
      var file=DriveApp.getFileById(id),parents=file.getParents(),authorized=false;
      var imageFolderId=imageFolder_().getId();
      while(parents.hasNext()){if(parents.next().getId()===imageFolderId)authorized=true;}
      if(!authorized)throw new Error('Photo does not belong to the wedding folder.');
      var blob=file.getBlob(),mime=blob.getContentType();
      if(!/^(image\/jpeg|image\/png|image\/webp|image\/gif)$/.test(mime))throw new Error('Invalid image type');
      return respond_({ok:true,mime:mime,base64:Utilities.base64Encode(blob.getBytes())});
    }
    return respond_({ok:false,error:'Unsupported storage operation'});
  }catch(ex){console.error(ex);return respond_({ok:false,error:String(ex.message||ex)});}
}
function respond_(v){return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON);}
function locked_(fn){var lock=LockService.getScriptLock();lock.waitLock(25000);try{return fn();}finally{lock.releaseLock();}}
function imageFolder_(){
  var folder=DriveApp.getFolderById(WEDDING_FOLDER_ID),found=folder.getFoldersByName(WEDDING_IMAGES);
  return found.hasNext()?found.next():folder.createFolder(WEDDING_IMAGES);
}
function initialSettings_(){return {partnerOne:'',partnerTwo:'',weddingDate:'',venue:'',location:'',currency:'TTD',tagline:'A beautiful beginning, together.'};}
function defaultFor_(key){return key==='settings'?initialSettings_():[];}
function ensureFiles_(folder){
  var filenames={},list=folder.getFiles();
  while(list.hasNext()){var f=list.next();filenames[f.getName()]=f;}
  var keys=Object.keys(WEDDING_FILES),found=keys.some(function(k){return !!filenames[WEDDING_FILES[k]];});
  // Migrate an old single-file wedding planner automatically on first connection.
  var old=null;
  if(!found && filenames['wedding-planner-data.json']){
    try{old=JSON.parse(filenames['wedding-planner-data.json'].getBlob().getDataAsString('UTF-8'));}catch(err){throw new Error('Old wedding data is not valid JSON. Please back it up and correct it before connecting.');}
  }
  for(var i=0;i<keys.length;i++){
    var key=keys[i],name=WEDDING_FILES[key];
    if(!filenames[name]){
      var initial=defaultFor_(key);
      if(old){
        if(key==='todo')initial=(old.tasks||[]).filter(function(x){return !x.status || x.status==='todo';});
        else if(key==='progress')initial=(old.tasks||[]).filter(function(x){return x.status==='in_progress';});
        else if(key==='done')initial=(old.tasks||[]).filter(function(x){return x.status==='done';});
        else if(key==='settings')initial=Object.assign(initialSettings_(),old.settings||{});
        else initial=old[key]||initial;
      }
      filenames[name]=folder.createFile(name,JSON.stringify(initial,null,2),MimeType.PLAIN_TEXT);
    }
  }
  return filenames;
}
function readJson_(file,key){
  try{
    var result=JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    if(key==='settings'){
      if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('Invalid settings file');
      return Object.assign(initialSettings_(),result);
    }
    if(!Array.isArray(result))throw new Error('Expected an array');
    return result;
  }catch(err){throw new Error('Cannot parse '+WEDDING_FILES[key]+'. File must contain valid JSON. '+err.message);}
}
function readPlan_(files){
  var data={version:1,settings:readJson_(files[WEDDING_FILES.settings],'settings'),tasks:[],inspiration:[],budget:[],guests:[],vendors:[],events:[],planners:[],activity:[]};
  var statusKeys=[['todo','todo'],['progress','in_progress'],['done','done']];
  statusKeys.forEach(function(entry){
    readJson_(files[WEDDING_FILES[entry[0]]],entry[0]).forEach(function(task){
      // List location is the source of truth, including if a planner manually moves an object between files.
      data.tasks.push(Object.assign({},task,{status:entry[1]}));
    });
  });
  ['inspiration','budget','guests','vendors','events','planners','activity'].forEach(function(key){data[key]=readJson_(files[WEDDING_FILES[key]],key);});
  data.activity=data.activity.slice(0,60);
  data.updatedAt=data.activity[0]&&data.activity[0].at || new Date().toISOString();
  return data;
}
function saveJson_(file,data){file.setContent(JSON.stringify(data,null,2));}
function saveChange_(files,data,change){
  var key=change.entity;
  if(key==='tasks'||key==='starter'){
    saveJson_(files[WEDDING_FILES.todo],data.tasks.filter(function(t){return t.status==='todo';}));
    saveJson_(files[WEDDING_FILES.progress],data.tasks.filter(function(t){return t.status==='in_progress';}));
    saveJson_(files[WEDDING_FILES.done],data.tasks.filter(function(t){return t.status==='done';}));
  }else if(key==='settings')saveJson_(files[WEDDING_FILES.settings],data.settings);
  else if(Object.prototype.hasOwnProperty.call(WEDDING_FILES,key))saveJson_(files[WEDDING_FILES[key]],data[key]);
  saveJson_(files[WEDDING_FILES.activity],data.activity.slice(0,60));
}
var starter_=[
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
function mutatePlan_(data,change){
  if(!change||!change.entity||!change.op)throw new Error('Invalid planning change');
  var allow=['tasks','inspiration','budget','guests','vendors','events','planners'];
  var now=new Date().toISOString(),itemLabel='wedding details';
  if(change.entity==='settings'&&change.op==='update'){
    Object.keys(change.value||{}).forEach(function(k){if(Object.prototype.hasOwnProperty.call(initialSettings_(),k))data.settings[k]=change.value[k];});
  }else if(change.entity==='starter'&&change.op==='create'){
    if(data.tasks.length)throw new Error('Starter checklist requires an empty task list');
    data.tasks=starter_.map(function(t){return {id:Utilities.getUuid(),title:t[0],category:t[1],priority:t[2],status:'todo',notes:'',assignee:'',dueDate:'',createdAt:now,updatedAt:now};});
    itemLabel='the starter checklist';
  }else if(allow.indexOf(change.entity)>=0&&['create','update','delete'].indexOf(change.op)>=0){
    var arr=data[change.entity],idx=arr.findIndex(function(item){return item.id===change.id;});
    if(change.op==='create'){
      if(idx>=0)throw new Error('Duplicate record ID');
      arr.unshift(Object.assign({id:change.id,createdAt:now,updatedAt:now},change.value||{}));
    }else if(change.op==='update'){
      if(idx<0)throw new Error('Item no longer exists; refresh and try again.');
      arr[idx]=Object.assign({},arr[idx],change.value||{},{updatedAt:now});
    }else{
      if(idx<0)throw new Error('Item no longer exists; refresh and try again.');
      itemLabel=arr[idx].title||arr[idx].name||change.entity;
      arr.splice(idx,1);
    }
    if(change.op!=='delete')itemLabel=(change.value||{}).title||(change.value||{}).name||change.entity;
  }else throw new Error('Unknown planning operation');
  var verb={create:'added',update:'updated',delete:'removed'}[change.op]||'changed';
  data.activity=[{id:Utilities.getUuid(),actor:String(change.actor||'A planner').slice(0,100),text:verb+' '+itemLabel,at:now}].concat(data.activity||[]).slice(0,60);
  data.updatedAt=now;
  return data;
}
