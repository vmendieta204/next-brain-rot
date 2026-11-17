// Puntajes del diagnóstico brain rot de NEXT.
// En producción este archivo solo corre en el servidor (api/submit.js).

// Preguntas de salud: cuánto sube o baja la salud cerebral (arranca en 100, se limita a 0..100).
// La Q6 es un acertijo sin puntaje; la pausa de atención ajusta +2 / 0 / -4.
export const HEALTH_DELTA = {
  q1: { a: 3, b: -7, c: -13, d: -18, e: -8 },
  q2: { a: 3, b: -5, c: -10, d: -15 },
  q3: { a: 3, b: -5, c: -10, d: -15 },
  q4: { a: 3, b: -5, c: -10, d: -15 },
  q5: { a: 3, b: -6, c: -11, d: -16 },
  q7: { a: 0, b: -4, c: -12, d: -6 },
};

// Preguntas que se responden pero no suman puntos.
export const UNSCORED = { q6: ['a', 'b', 'c', 'd'] };

export function pulseAdjust(p) {
  if (p === undefined || p === null || p === 'skip') return 0;
  const n = Number(p);
  if (!Number.isInteger(n) || n < 0 || n > 30) throw new Error('Pausa inválida');
  return n === 0 ? 2 : n <= 2 ? 0 : -4;
}

// Preguntas 8 a 14: perfil oculto (máximo 100).
export const PROFILE = {
  q8: { bilingue: 25, exterior: 25, privado: 15, casa: 8, publico: 3 },
  q9: { iphone: 15, android: 5, compartido: 0 },
  q10: { idiomas: 5, deporte: 5, arte: 5, nada: 0 }, // selección múltiple, máx 15
  q11: { exterior: 10, proyecto: 7, ia: 7, notas: 2 },
  q12: { viajes: 10, campamentos: 7, aun_no: 0 },
  q13: { 1: 0, 2: 1, 3: 2, 4: 4, 5: 5 },
  q14: { mas_800: 20, '300_800': 15, '100_300': 7, conocer: 5, menos_100: 0 },
};

export const MULTI = { q10: 15 };

const STEPS = [
  ['Empiece usted.', 'Muéstrele a su hijo su propio tiempo de pantalla antes de pedirle el suyo. Conversar desde el ejemplo funciona mejor que imponer reglas.'],
  ['Proteja el descanso.', 'Eviten las pantallas durante la hora previa a dormir y dejen los celulares cargando fuera de las habitaciones, como recomienda la Academia Americana de Pediatría.'],
  ['Converse sin reproches.', 'Pregúntele qué contenido ve y por qué le gusta. La Asociación Americana de Psicología recomienda acompañar y conversar más que vigilar.'],
];

export const DIAGNOSES = [
  {
    key: 'equilibrio', min: 80, title: 'Cerebro en equilibrio', emoji: '🟢',
    text: 'Su hijo conserva una buena capacidad de atención y todavía sabe aburrirse, lo cual es una ventaja. El reto es que esa energía se convierta en proyectos propios.',
    steps: STEPS,
  },
  {
    key: 'ocasional', min: 55, title: 'Scroll ocasional', emoji: '🟡',
    text: 'Las pantallas ya tienen un horario fijo en su hogar. Con algunos ajustes pequeños y sin confrontaciones es posible recuperar tiempo para otras actividades.',
    steps: STEPS,
  },
  {
    key: 'fragmentada', min: 30, title: 'Atención fragmentada', emoji: '🟠',
    text: 'El celular está ocupando parte del tiempo de tareas, descanso y conversación. Hay margen claro para mejorar con hábitos sencillos y constantes.',
    steps: STEPS,
  },
  {
    key: 'piloto', min: 0, title: 'Scroll en piloto automático', emoji: '🔵',
    text: 'Hoy el contenido corto marca buena parte de la rutina de su hijo. La buena noticia es que los hábitos se pueden cambiar sin quitarle el celular de golpe: el primer paso es que ese mismo celular le sirva para crear.',
    steps: STEPS,
  },
];

function pick(table, value, id) {
  if (!Object.prototype.hasOwnProperty.call(table, value)) throw new Error('Respuesta inválida en ' + id);
  return table[value];
}

export function score(answers) {
  if (!answers || typeof answers !== 'object') throw new Error('Sin respuestas');

  let health = 100;
  for (const id of Object.keys(HEALTH_DELTA)) health += pick(HEALTH_DELTA[id], answers[id], id);
  for (const id of Object.keys(UNSCORED)) {
    if (!UNSCORED[id].includes(answers[id])) throw new Error('Respuesta inválida en ' + id);
  }
  health += pulseAdjust(answers.pulse);
  health = Math.max(0, Math.min(100, health));

  let profile = 0;
  for (const id of Object.keys(PROFILE)) {
    if (MULTI[id]) {
      const list = Array.isArray(answers[id]) ? [...new Set(answers[id])] : [];
      if (!list.length) throw new Error('Respuesta inválida en ' + id);
      const sum = list.reduce((s, v) => s + pick(PROFILE[id], v, id), 0);
      profile += Math.min(MULTI[id], sum);
    } else {
      profile += pick(PROFILE[id], String(answers[id]), id);
    }
  }

  const tier = profile >= 65 && answers.q14 !== 'menos_100' ? 'A' : profile >= 40 ? 'B' : 'C';
  const d = DIAGNOSES.find((x) => health >= x.min);
  const diagnosis = { key: d.key, title: d.title, emoji: d.emoji, text: d.text, steps: d.steps };
  return { health, profile, tier, diagnosis };
}
