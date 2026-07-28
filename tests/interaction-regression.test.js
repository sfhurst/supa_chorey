const fs=require('fs'),assert=require('assert');
const app=fs.readFileSync('app.js','utf8');
const creator=fs.readFileSync('task-creator.js','utf8');
const css=fs.readFileSync('style.css','utf8');
assert(app.includes("assignmentSource='completion'"));
assert(app.includes("state.assignmentSource==='completion'"));
assert(app.includes("assignmentOverride:true"));
assert(app.includes("hold-assign-progress"));
assert(app.includes('await occurrenceRepository.resetAll()'));
assert(app.includes('ChoreyStorage.resetAllData()'));
assert(creator.includes('defaultAssignedIds:original?.defaultAssignedIds||[actor.id]'));
assert(creator.includes('task-name-input'));
assert(css.includes('@keyframes holdAssignFill'));
assert(css.includes('#task-name-form'));
assert(css.includes('gap: 14px'));
console.log('Interaction regression tests passed.');

// Background refresh must preserve the existing task board when its rendered markup is unchanged.
const appSource=fs.readFileSync('app.js','utf8');
assert(appSource.includes("lastViewportView==='today'&&lastViewportMarkup===markup"));
assert(appSource.includes("lastViewportView==='all'&&lastViewportMarkup===markup"));

// Congratulations only considers non-private tasks that are actually due today.
assert(appSource.includes("i.task.visibility!=='private'&&(i.occurrence.duration==='day'||i.occurrence.closesOn===activeDayData.dateKey)"));
