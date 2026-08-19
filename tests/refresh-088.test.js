const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('app.js', 'utf8');

assert(source.includes('function viewportIsIntact(person)'), 'viewport integrity check is missing');
assert(source.includes('lastAppliedStateSignature === nextSignature && viewportIsIntact(person)'), 'unchanged state must not skip rendering when the viewport is missing or damaged');
assert(source.includes('function restoreCachedViewportIfBlank()'), 'last-known-good viewport recovery is missing');
assert(source.includes('restoreCachedViewportIfBlank();\n    if (refreshing) return;'), 'blank recovery must happen before an in-progress refresh can exit');
assert(source.includes('restoreCachedViewportIfBlank();\n    clearTimeout(resumeRefreshTimer);'), 'resume must restore a blank viewport immediately');

const renderToday = source.indexOf('else await renderToday(person);');
const commit = source.indexOf('lastAppliedStateSignature = stateSignature({', renderToday);
assert(renderToday >= 0 && commit > renderToday, 'state signature must be committed only after rendering succeeds');

const docs = ['README.md', 'PHILOSOPHY.md', 'HARDENING_NOTES.md', 'CHANGELOG.md'].map(file => fs.readFileSync(file, 'utf8')).join('\n');
assert(docs.includes('last known-good'), 'blank-screen recovery rule is not documented');
assert(docs.includes('viewport'), 'viewport integrity rule is not documented');

console.log('v0.8.8 blank-screen regression tests passed.');
