import { randomUUID } from 'node:crypto';
import { starterTasks } from './sample.js';

const ENTITY_FIELDS = {
  tasks:['title','category','status','priority','notes','assignee','dueDate'],
  inspiration:['title','category','imageUrl','imageId','notes'],
  budget:['title','category','estimated','actual','paid','notes'],
  guests:['name','group','rsvp','meal','plusOne','notes'],
  vendors:['name','category','status','phone','email','website','amount','notes'],
  events:['title','date','time','location','notes','done'],
  planners:['name','role','email']
};
const TEXT_MAX = {notes:1200, title:160, name:100, imageUrl:1800, website:1800, email:160, location:200};
const OPTIONS={status:['todo','in_progress','done'],priority:['low','medium','high'],rsvp:['pending','attending','declined']};

function cleanText(value,field) {
  return String(value??'').trim().slice(0,TEXT_MAX[field] || 120);
}
export function cleanActor(value) {return cleanText(value||'A planner','name') || 'A planner';}
function cleanUrl(value) {
  const text=cleanText(value,'imageUrl');
  if (!text) return '';
  try {const u=new URL(text); if (['https:','http:'].includes(u.protocol)) return u.href;} catch{}
  return '';
}
function cleanDate(value){const text=cleanText(value,'date');return /^\d{4}-\d{2}-\d{2}$/.test(text)&&!Number.isNaN(new Date(`${text}T12:00:00Z`).getTime())?text:'';}
export function prepareChange(body) {
  if (!body || typeof body!=='object' || Array.isArray(body)) throw new Error('Invalid request body');
  const actor=cleanActor(body.actor);
  if(body.entity==='starter') return {entity:'starter',op:'create',actor,id:randomUUID(),value:{}};
  if(body.entity==='settings') {
    const p=body.value||{};
    if(body.op!=='update'||typeof p!=='object'||Array.isArray(p)) throw new Error('Invalid settings update');
    const value={};
    for(const f of ['partnerOne','partnerTwo','venue','location','tagline']) if(Object.hasOwn(p,f))value[f]=cleanText(p[f],f);
    if(Object.hasOwn(p,'weddingDate')) value.weddingDate=cleanDate(p.weddingDate);
    if(Object.hasOwn(p,'currency')) {const s=cleanText(p.currency,'currency').toUpperCase();value.currency=/^[A-Z]{3}$/.test(s)?s:'TTD';}
    return {entity:'settings',op:'update',actor,value};
  }
  const fields=ENTITY_FIELDS[body.entity];
  if(!fields) throw new Error('Unknown section');
  if(!['create','update','delete'].includes(body.op)) throw new Error('Invalid action');
  const id=body.op==='create'?randomUUID():cleanText(body.id,'id');
  if(!id||id.length>100||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('Invalid item ID');
  if(body.op==='delete')return {entity:body.entity,op:'delete',actor,id,value:{}};
  const p=body.value;
  if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Missing item data');
  const value={};
  for(const field of fields) {
    if (!Object.hasOwn(p,field))continue;
    if(['estimated','actual','amount'].includes(field)) value[field]=Math.min(100_000_000,Math.max(0,Number(p[field])||0));
    else if(['paid','plusOne','done'].includes(field)) value[field]=p[field]===true;
    else if(field==='imageUrl'||field==='website') value[field]=cleanUrl(p[field]);
    else if(field==='dueDate'||field==='date') value[field]=cleanDate(p[field]);
    else if(field==='imageId')value[field]=/^[a-zA-Z0-9_-]{1,200}$/.test(String(p[field]))?p[field]:'';
    else if(field==='status'){
      const opts=body.entity==='vendors'?['researching','contacted','booked']:OPTIONS.status;
      value[field]=opts.includes(p[field])?p[field]:opts[0];
    }
    else if(OPTIONS[field])value[field]=OPTIONS[field].includes(p[field])?p[field]:OPTIONS[field][0];
    else value[field]=cleanText(p[field],field);
  }
  if(body.op==='create') {
    const titleField=body.entity==='guests'||body.entity==='vendors'||body.entity==='planners'?'name':'title';
    if(!value[titleField]) throw new Error(`Please enter a ${titleField}`);
  }
  return {entity:body.entity,op:body.op,actor,id,value};
}
export function applyChange(data, change) {
  const now=new Date().toISOString();
  const d=structuredClone(data);
  if(change.entity==='settings'){
    d.settings={...d.settings,...change.value};
  } else if(change.entity==='starter') {
    if(d.tasks.length>0)throw new Error('Your task list already has items. Starter checklist is available for an empty list.');
    d.tasks=starterTasks.map(([title,category,priority])=>({id:randomUUID(),title,category,priority,status:'todo',notes:'',assignee:'',dueDate:'',createdAt:now,updatedAt:now}));
  } else {
    const list=d[change.entity];
    if(!Array.isArray(list))throw new Error('Unknown list');
    const idx=list.findIndex(item=>item.id===change.id);
    if(change.op==='create')list.unshift({id:change.id,...change.value,createdAt:now,updatedAt:now});
    else if(change.op==='update'){
      if(idx===-1)throw new Error('Item no longer exists. Please refresh.');
      list[idx]={...list[idx],...change.value,updatedAt:now};
    } else {
      if(idx===-1)throw new Error('Item no longer exists. Please refresh.');
      list.splice(idx,1);
    }
  }
  const labels={tasks:'a task',inspiration:'an inspiration',budget:'a budget item',guests:'a guest',vendors:'a vendor',events:'an event',planners:'a planner',settings:'wedding details',starter:'the starter checklist'};
  const verbs={create:'added',update:'updated',delete:'removed'};
  const thing=change.entity==='settings'?'wedding details':change.entity==='starter'?'the starter checklist':
    (change.value?.title||change.value?.name||labels[change.entity]);
  d.activity=[{id:randomUUID(),actor:change.actor,text:`${verbs[change.op]||'changed'} ${thing}`,at:now},...(d.activity||[])].slice(0,60);
  d.updatedAt=now;
  return d;
}
