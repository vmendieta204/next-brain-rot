import assert from 'assert';
import { score } from './lib/scoring.js';

const h = (x, extra = {}) => ({ q1: x, q2: x, q3: x, q4: x, q5: x, q6: 'b', q7: x === 'a' ? 'a' : x, ...extra });
const rich = { q8: 'bilingue', q9: 'iphone', q10: ['idiomas', 'deporte'], q11: 'exterior', q12: 'viajes', q13: 5, q14: 'mas_800' };
const poor = { q8: 'publico', q9: 'compartido', q10: ['nada'], q11: 'notas', q12: 'aun_no', q13: 1, q14: 'menos_100' };

// Niveles y límites
let r = score({ ...h('a'), ...rich, pulse: 0 });
assert.equal(r.health, 100); assert.equal(r.diagnosis.key, 'equilibrio'); assert.equal(r.tier, 'A');
assert.equal(score({ ...h('d'), ...rich, q7: 'c', pulse: 5 }).health, 5); // peor caso posible
assert.equal(score({ ...h('d'), ...rich }).diagnosis.key, 'piloto');
assert.equal(score({ ...h('b'), ...rich }).health, 100 - 7 - 5 - 5 - 5 - 6 - 4); // 68
assert.equal(score({ ...h('b'), ...rich }).diagnosis.key, 'ocasional');
assert.equal(score({ ...h('c'), ...rich }).diagnosis.key, 'fragmentada'); // 100-13-10-10-10-11-12 = 34
// Q1 "No sabría decirle" resta 8
assert.equal(score({ ...h('a'), ...rich, q1: 'e', pulse: 'skip' }).health, 100 + 3 * 4 - 8 > 100 ? 100 : 104);
assert.equal(score({ ...h('c'), ...rich, q1: 'e' }).health - score({ ...h('c'), ...rich, q1: 'c' }).health, 5);
// Q6 no cambia la salud
for (const v of ['a', 'b', 'c', 'd']) assert.equal(score({ ...h('c'), ...rich, q6: v }).health, 34);
assert.throws(() => score({ ...h('c'), ...rich, q6: 'z' }));
// Pausa: 0 errores +2, 1-2 = 0, 3+ -4, omitida 0
const base = score({ ...h('c'), ...rich }).health;
assert.equal(score({ ...h('c'), ...rich, pulse: 0 }).health, base + 2);
assert.equal(score({ ...h('c'), ...rich, pulse: 2 }).health, base);
assert.equal(score({ ...h('c'), ...rich, pulse: 3 }).health, base - 4);
assert.equal(score({ ...h('c'), ...rich, pulse: 'skip' }).health, base);
assert.throws(() => score({ ...h('c'), ...rich, pulse: 'hack' }));
// Segmentos
assert.equal(score({ ...h('a'), ...rich, q14: 'menos_100' }).tier, 'B');
assert.equal(score({ ...h('a'), ...rich, q14: 'conocer' }).tier, 'A');
assert.equal(score({ ...h('a'), ...poor }).tier, 'C');
assert.equal(score({ ...h('a'), ...rich, q10: ['idiomas', 'idiomas', 'deporte', 'arte'] }).profile, 100);
assert.throws(() => score({ ...h('a'), ...rich, q14: 'hack' }));
console.log('scoring ok');
