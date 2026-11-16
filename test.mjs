import assert from 'assert';
import { score } from './lib/scoring.js';

const h = (x) => ({ q1: x, q2: x, q3: x, q4: x, q5: x, q6: x, q7: x });
const rich = { q8: 'bilingue', q9: 'iphone', q10: ['idiomas', 'deporte'], q11: 'exterior', q12: 'viajes', q13: 5, q14: 'mas_800' };

let r = score({ ...h('a'), ...rich });
assert.equal(r.health, 100); assert.equal(r.diagnosis.key, 'creador'); assert.equal(r.profile, 95); assert.equal(r.tier, 'A');
assert.equal(score({ ...h('b'), ...rich }).diagnosis.key, 'intermitente');
assert.equal(score({ ...h('d'), ...rich }).health, 0);
// Perfil alto pero menos de 100 USD: nunca A
r = score({ ...h('c'), ...rich, q14: 'menos_100' }); assert.equal(r.profile, 75); assert.equal(r.tier, 'B');
// Una sola señal fuerte no alcanza A
r = score({ ...h('a'), q8: 'bilingue', q9: 'android', q10: ['nada'], q11: 'notas', q12: 'aun_no', q13: 3, q14: 'mas_800' });
assert.equal(r.profile, 54); assert.equal(r.tier, 'B');
r = score({ ...h('a'), q8: 'publico', q9: 'compartido', q10: ['nada'], q11: 'notas', q12: 'aun_no', q13: 2, q14: '100_300' });
assert.equal(r.tier, 'C');
// q10 tope 15 y duplicados
assert.equal(score({ ...h('a'), ...rich, q10: ['idiomas', 'idiomas', 'deporte', 'arte'] }).profile, 100);
assert.throws(() => score({ ...h('a'), ...rich, q14: 'hack' }));
assert.throws(() => score({ ...h('a'), ...rich, q10: [] }));
console.log('scoring ok');
