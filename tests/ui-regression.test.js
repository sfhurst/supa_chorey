const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={console,document:{getElementById:()=>({})},people:[],ChoreyUtils:{getPerson:()=>null,escapeHTML:s=>String(s)},ChoreyTaskModel:{canManageAssignments:()=>false,canEditTask:()=>false}};vm.createContext(context);vm.runInContext(fs.readFileSync('ui.js','utf8')+'\nthis.ui=ChoreyUI;',context);
assert.notEqual(context.ui.categoryColor('Living Room'),context.ui.categoryColor('Living Area'));
console.log('UI regression tests passed.');
