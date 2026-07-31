const fs=require('fs'),vm=require('vm'),assert=require('assert');
const people=[
  {id:'person-001',name:'Steve',legacyIds:['steve']},
  {id:'person-002',name:'Sandy',legacyIds:['sandy']},
];
const values=new Map();
const localStorage={
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key),
};
const context={console,people,localStorage};
vm.createContext(context);
vm.runInContext(fs.readFileSync('storage.js','utf8')+'\nthis.storage=ChoreyStorage;',context);
assert.equal(context.storage.getState().schemaVersion,9);
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.storage.getState().settings)),{viewModeByUserId:{}});
assert.equal(context.storage.setViewMode('steve','completed'),true);
assert.equal(context.storage.getViewMode('person-001'),'completed');
assert.equal(context.storage.setViewMode('person-001','all'),false);
assert.equal(context.storage.getViewMode('person-001'),'completed');
console.log('Storage settings tests passed.');
assert.equal(context.storage.getCongratulationsShown('person-001'),false);
assert.equal(context.storage.setCongratulationsShown('person-001',true),true);
assert.equal(context.storage.getCongratulationsShown('steve'),true);
assert.equal(context.storage.getCongratulationsShown('person-002'),false);
assert.equal(context.storage.setCongratulationsShown('person-001',false),true);
assert.equal(context.storage.getCongratulationsShown('person-001'),false);
