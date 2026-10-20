import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {freshData} from '../lib/sample.js';
import {prepareChange,applyChange} from '../lib/data.js';

test('creates and completes a task without replacing another planner item',()=>{
  let d=freshData();
  const one=prepareChange({entity:'tasks',op:'create',actor:'Planner A',value:{title:'Book venue',category:'Venue',priority:'high',status:'todo'}});
  d=applyChange(d,one);
  const two=prepareChange({entity:'tasks',op:'create',actor:'Planner B',value:{title:'Book caterer',category:'Catering',status:'todo'}});
  d=applyChange(d,two);
  assert.equal(d.tasks.length,2);
  d=applyChange(d,prepareChange({entity:'tasks',op:'update',id:one.id,actor:'Planner A',value:{status:'done'}}));
  assert.equal(d.tasks.find(t=>t.id===one.id).status,'done');
  assert.equal(d.tasks.find(t=>t.id===two.id).status,'todo');
  assert.equal(d.activity[0].actor,'Planner A');
});
test('invalid operations, unsafe URLs, missing items rejected',()=>{
  assert.throws(()=>prepareChange({entity:'not-real',op:'create',value:{title:'X'}}));
  assert.throws(()=>prepareChange({entity:'tasks',op:'create',value:{title:''}}));
  assert.equal(prepareChange({entity:'inspiration',op:'create',value:{title:'Inspo',imageUrl:'javascript:alert(1)'}}).value.imageUrl,'');
  assert.throws(()=>applyChange(freshData(),prepareChange({entity:'tasks',op:'delete',id:randomUUID()})));
});
test('budget fields are numeric, nonnegative and bounded',()=>{
  const c=prepareChange({entity:'budget',op:'create',value:{title:'Florals',estimated:-500,actual:'350',paid:true}});
  assert.equal(c.value.estimated,0);assert.equal(c.value.actual,350);assert.equal(c.value.paid,true);
});
test('starter checklist can only be loaded into empty task list',()=>{
  let d=freshData();d=applyChange(d,prepareChange({entity:'starter'}));assert.equal(d.tasks.length,20);
  assert.throws(()=>applyChange(d,prepareChange({entity:'starter'})));
});
