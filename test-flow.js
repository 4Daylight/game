const fs = require('fs');
let code = fs.readFileSync('data.js', 'utf8');
// const 在 vm 沙箱里不可见, 转 globalThis
code = code.replace(/^const /gm, 'globalThis.');
eval(code);

const SCENES = globalThis.SCENES;

function walk(sceneId, depth, visited, path) {
  if (depth > 30) return;
  const key = sceneId + '/' + path.join(',');
  if (visited.has(key)) return;
  visited.add(key);
  const scene = SCENES[sceneId];
  if (!scene) { console.log('MISSING:', sceneId); return; }
  if (scene.type === 'summary') { console.log('summary via', path.length, 'steps'); return; }
  if (scene.type === 'ending') { console.log('END ['+scene.label+']  steps:', path.length); return; }
  if (scene.choices) scene.choices.forEach(ch => walk(ch.next, depth + 1, visited, [...path, sceneId + ':' + ch.label]));
  else if (scene.next) walk(scene.next, depth + 1, visited, [...path, sceneId]);
  else console.log('DEAD at', sceneId);
}

console.log('--- cabinet 出发 (3选→分支) ---');
walk('cabinet', 0, new Set(), []);
console.log('\n--- branch_choice 出发 (3主线) ---');
walk('branch_choice', 0, new Set(), []);
console.log('\n总场景数:', Object.keys(SCENES).length);
console.log('9 结局齐全:', 
['m1_end_a','m1_end_b','m1_end_c','m2_end_a','m2_end_b','m2_end_c','m3_end_a','m3_end_b','m3_end_c']
.every(k => SCENES[k] && SCENES[k].type === 'ending'));
