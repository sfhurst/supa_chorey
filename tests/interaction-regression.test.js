const fs=require('fs'),assert=require('assert');
const app=fs.readFileSync('app.js','utf8');
const creator=fs.readFileSync('task-creator.js','utf8');
const css=fs.readFileSync('style.css','utf8');
assert(app.includes('next.assignmentSource = "completion"'));
assert(app.includes('state.assignmentSource === "completion"'));
assert(app.includes('assignmentOverride: true'));
assert(app.includes('hold-assign-progress'));
assert(app.includes('await occurrenceRepository.resetAll()'));
assert(app.includes('ChoreyStorage.resetAllData()'));
assert(creator.includes('defaultAssignedIds:original?.defaultAssignedIds||[actor.id]'));
assert(creator.includes('task-name-input'));
assert(css.includes('@keyframes holdAssignFill'));
assert(css.includes('#task-name-form'));
assert(css.includes('gap: 14px'));
console.log('Interaction regression tests passed.');

// Background refresh must preserve the existing task board when its rendered markup is unchanged.
assert(app.includes('lastViewportView === "today" && lastViewportMarkup === markup'));
assert(app.includes('lastViewportView === "all" && lastViewportMarkup === markup'));

// Role-aware views and congratulations remain separate concerns.
assert(app.includes('settings.viewModeByUserId') === false); // storage owns settings access
assert(app.includes('scope: "mine-unassigned"'));
assert(app.includes('scope: "household"'));
assert(app.includes('item.task.visibility !== "private"'));
assert(app.includes('(item.assignedIds || []).includes(person.id)'));
assert(creator.includes('Occurs on these…'));
assert(creator.includes('["dates","Dates"]'));
assert(creator.includes('data-repeat'));
assert(creator.includes('ChoreyUI.categoryColor(c)'));
assert(app.includes('scheduleResumeRefresh'));
