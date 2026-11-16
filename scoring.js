// Puntajes del diagnóstico brain rot de NEXT.
// En producción este archivo solo corre en el servidor (api/submit.js).

// Preguntas 1 a 7: cuánto sube o baja la salud cerebral (arranca en 100).
export const HEALTH_DELTA = {
  q1: { a: 3, b: -7, c: -13, d: -18 },
  q2: { a: 3, b: -5, c: -10, d: -15 },
  q3: { a: 3, b: -5, c: -10, d: -15 },
  q4: { a: 3, b: -5, c: -10, d: -15 },
  q5: { a: 3, b: -6, c: -11, d: -16 },
  q6: { a: 2, b: -3, c: -7, d: -12 },
  q7: { a: 3, b: -5, c: -10, d: -15 },
};

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

export const DIAGNOSES = [
  {
    key: 'creador', min: 80, title: 'Cerebro en modo creador', emoji: '✨',
    text: 'Su atención está en buena forma. Puede sostener el foco, esperar y terminar lo que empieza, que es justo lo que se necesita para aprender cosas difíciles y crear proyectos propios.',
    steps: [
      'Hagan un plan digital en familia con horarios y lugares sin pantalla, como recomienda la Academia Americana de Pediatría.',
      'Cuiden el sueño: entre 8 y 10 horas a esta edad y el celular fuera del cuarto en la noche.',
      'Denle un reto donde use la tecnología para crear algo propio, como una app, un video o un negocio pequeño.',
    ],
  },
  {
    key: 'intermitente', min: 55, title: 'Señal intermitente', emoji: '📶',
    text: 'Tiene buena base, pero el scroll ya le roba foco a ratos. En los estudios, quienes más usan videos cortos muestran peor atención y menos control de impulsos. Es buen momento para ajustar hábitos antes de que se vuelvan rutina.',
    steps: [
      'Apaguen pantallas al menos 1 hora antes de dormir y carguen el celular fuera del cuarto.',
      'Definan momentos sin celular para toda la familia, como las comidas y las tareas.',
      'Cambien una parte del scroll por un proyecto semanal que pueda mostrarles terminado.',
    ],
  },
  {
    key: 'scroll', min: 30, title: 'Scroll infinito', emoji: '🌀',
    text: 'El celular está marcando el ritmo de su día. Le cuesta sostener la atención, se aburre rápido y probablemente duerme menos de lo que necesita. Son señales que vale la pena atender ya.',
    steps: [
      'Armen juntos un plan con límite diario de pantallas para ocio. La Asociación Española de Pediatría sugiere menos de 2 horas al día entre los 13 y 16 años.',
      'Celular fuera del cuarto en la noche, sin excepciones entre semana.',
      'Reemplacen 1 hora de scroll por una actividad que exija foco y deje un resultado que se pueda ver.',
    ],
  },
  {
    key: 'jefe', min: 0, title: 'Brain rot nivel jefe final', emoji: '🧟',
    text: 'Atención corta, noches largas y mucha dependencia del celular. Es el perfil donde más se notan los efectos que describen los estudios, pero los hábitos se pueden cambiar con un plan claro y acompañamiento.',
    steps: [
      'Hablen sin regaños: pregúntale qué ve, cuánto tiempo y cómo se siente después. La Asociación Americana de Psicología recomienda estar atentos a señales de uso problemático.',
      'Recuperen el sueño primero: nada de pantallas 1 hora antes de dormir y el celular fuera del cuarto.',
      'Si notas que afecta su ánimo, sus notas o su sueño, consulta con su pediatra o con un psicólogo.',
    ],
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
