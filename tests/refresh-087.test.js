const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('app.js', 'utf8');

assert(source.includes('lastAppliedStateSignature'), 'state signature cache is missing');
assert(source.includes('if (lastAppliedStateSignature === nextSignature && viewportIsIntact(person)) return;'), 'unchanged intact state must exit before rendering');
const guard = source.indexOf('if (lastAppliedStateSignature === nextSignature && viewportIsIntact(person)) return;');
assert(guard < source.indexOf('ChoreyUI.updateHeader', guard), 'guard must run before header updates');
assert(guard < source.indexOf('renderToday(person)', guard), 'guard must run before viewport rendering');
assert(source.includes('if (background) return;'), 'background failures must leave the displayed screen alone');

const philosophy = fs.readFileSync('PHILOSOPHY.md', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
assert(source.includes('CHOREY STABILITY RULE — STOP BEFORE RENDERING'), 'permanent render-guard comment is missing');
assert(source.includes('core Chorey philosophy, not a performance optimization'), 'render philosophy warning is missing');
assert(philosophy.includes('## Stability over activity'), 'stability principle is missing from PHILOSOPHY.md');
assert(philosophy.includes('Same day + same user + same view + same normalized task state = do nothing.'), 'stability rule is missing from PHILOSOPHY.md');
assert(readme.includes('## Stability over activity'), 'stability principle is missing from README.md');
assert(changelog.includes('Stability over activity'), 'stability principle is missing from CHANGELOG.md');

console.log('v0.8.7 refresh tests passed.');
