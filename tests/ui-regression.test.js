const fs=require('fs'),vm=require('vm'),assert=require('assert');
const people=[{id:'steve',name:'Steve',accent:'#000'}]; const context={console,document:{getElementById:()=>({})},people,ChoreyUtils:{getPerson:()=>null,escapeHTML:s=>String(s)},ChoreyTaskModel:{canManageAssignments:()=>false,canEditTask:()=>false}};vm.createContext(context);vm.runInContext(fs.readFileSync('ui.js','utf8')+'\nthis.ui=ChoreyUI;',context);
assert.notEqual(context.ui.categoryColor('Living Room'),context.ui.categoryColor('Living Area'));
const base={occurrence:{duration:'day'},assignedIds:[],selfAssignedIds:[]};
const items=[
 {...base,id:'done-a',isDone:true,originalIndex:0,displayTask:'A done',task:{id:'1',name:'A done',category:'A',visibility:'visible'}},
 {...base,id:'open-z',isDone:false,originalIndex:1,displayTask:'Z open',task:{id:'2',name:'Z open',category:'Z',visibility:'visible'}},
 {...base,id:'open-a2',isDone:false,originalIndex:2,displayTask:'Beta',task:{id:'3',name:'Beta',category:'A',visibility:'visible'}},
 {...base,id:'open-a1',isDone:false,originalIndex:3,displayTask:'Alpha',task:{id:'4',name:'Alpha',category:'A',visibility:'visible'}}
];
const html=context.ui.renderBoard(people[0],{dateKey:'2026-07-28'},new Map([['steve',items]]));
assert(html.indexOf('Alpha') < html.indexOf('Beta'));
assert(html.indexOf('Beta') < html.indexOf('Z open'));
assert(html.indexOf('Z open') < html.indexOf('A done'));
console.log('UI regression tests passed.');
const emptyHtml=context.ui.renderBoard(people[0],{dateKey:'2026-07-28'},new Map([['steve',[]]]));
assert.equal(emptyHtml.includes('No tasks here'),false);
