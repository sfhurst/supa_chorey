const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={console,people:[
{id:'person-001',isOwner:true,isAdmin:true},{id:'person-002',isOwner:false,isAdmin:true},{id:'person-003',isOwner:false,isAdmin:false}
]};vm.createContext(context);vm.runInContext(fs.readFileSync('task-model.js','utf8')+'\nthis.model=ChoreyTaskModel;',context);
const m=context.model;
const migrated=m.normalizeTask({id:'x',name:'X',schedule:{type:'days',days:[1]},defaultAssigneeId:'person-002',visibility:{type:'household'},active:true});
assert.deepStrictEqual([...migrated.defaultAssignedIds],['person-002']);assert.equal(migrated.visibility,'visible');assert.equal(migrated.createdById,'person-001');
const shower=m.normalizeTask({id:'task-days-personal-take-a-shower',schedule:{type:'days',days:[1]},visibility:'visible'});assert.equal(shower.visibility,'private');assert.deepStrictEqual([...shower.defaultAssignedIds],['person-001']);
const privateState=m.normalizeOccurrence({assignedIds:[],isDone:false},shower);assert.deepStrictEqual([...privateState.assignedIds],['person-001']);
const state=m.normalizeOccurrence({assignedToId:'person-003',isDone:true,completedById:'person-003'},migrated);assert.deepStrictEqual([...state.assignedIds],['person-003']);assert.equal(state.isDone,true);
assert.equal(m.canEditTask(context.people[2],{createdById:'person-003'}),true);assert.equal(m.canEditTask(context.people[1],{createdById:'person-003'}),false);assert.equal(m.canEditTask(context.people[0],{createdById:'person-003'}),true);
console.log('Task model tests passed.');
