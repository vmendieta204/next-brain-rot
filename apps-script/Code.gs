/**
 * Diagnóstico Brain Rot · NEXT
 * 1) Guarda cada lead como una fila en la pestaña "Leads".
 * 2) Le manda al papá un correo con su resultado.
 *
 * Propiedades del script (Configuración del proyecto > Propiedades del script):
 *   SECRET          (obligatoria) la misma clave que SHEETS_SECRET en Vercel
 *   REMITENTE       (opcional) nombre que ve el papá, por defecto "NEXT"
 *   RESPONDER_A     (opcional) correo al que llegan las respuestas
 *   ENVIAR_CORREO   (opcional) pon "no" para pausar los correos sin tocar el código
 *   LOGO_URL        (recomendada) https://TU-DOMINIO/brand/logo-next-email.png
 */
var SHEET_NAME = 'Leads';
var HEADERS = [
  'Fecha', 'Nombre', 'Correo', 'WhatsApp', 'Diagnóstico', 'Salud cerebral', 'Perfil', 'Segmento', 'Invitación',
  'Q1 horas', 'Q2 película', 'Q3 tareas', 'Q4 reacción', 'Q5 hora', 'Q6 memes', 'Q7 aburrimiento',
  'Q8 colegio', 'Q9 dispositivo', 'Q10 estímulos', 'Q11 meta', 'Q12 experiencias', 'Q13 preocupación', 'Q14 inversión',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'Página', 'Correo enviado'
];
var COL_EMAIL_STATUS = HEADERS.length; // última columna

var SUBJECTS = {
  creador: 'El cerebro de tu hijo está en modo creador ✨',
  intermitente: 'El cerebro de tu hijo tiene señal intermitente 📶',
  scroll: 'El cerebro de tu hijo está en scroll infinito 🌀',
  jefe: 'Brain rot nivel jefe final 🧟 Esto es lo primero que haría'
};

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var body, rowNumber, sheet;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'json' });
  }
  var secret = props.getProperty('SECRET');
  if (!secret || body.secret !== secret) return reply({ ok: false, error: 'unauthorized' });

  // 1) Guardar la fila
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    } else if (sheet.getRange(1, COL_EMAIL_STATUS).getValue() === '') {
      sheet.getRange(1, COL_EMAIL_STATUS).setValue(HEADERS[COL_EMAIL_STATUS - 1]).setFontWeight('bold');
    }
    var row = (body.row || []).slice(0, HEADERS.length - 1).map(clean);
    row[0] = new Date();
    while (row.length < HEADERS.length - 1) row.push('');
    row.push('Pendiente');
    sheet.appendRow(row);
    rowNumber = sheet.getLastRow();
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }

  // 2) Mandar el correo (si falla, el lead ya quedó guardado y la columna lo dice)
  var status = 'No';
  try {
    if (String(props.getProperty('ENVIAR_CORREO') || 'si').toLowerCase() === 'no') {
      status = 'Pausado';
    } else if (body.email && body.email.to) {
      sendResultEmail(body.email, props);
      status = 'Sí';
    }
  } catch (err) {
    status = 'Error: ' + String(err).slice(0, 200);
  }
  sheet.getRange(rowNumber, COL_EMAIL_STATUS).setValue(status);

  return reply({ ok: true, email: status });
}

function sendResultEmail(d, props) {
  var opts = {
    to: d.to,
    subject: SUBJECTS[d.key] || ('Resultado del diagnóstico: ' + d.title),
    htmlBody: buildEmailHtml(Object.assign({}, d, { logoUrl: props.getProperty('LOGO_URL') || d.logoUrl || '' })),
    body: buildEmailText(d),
    name: props.getProperty('REMITENTE') || 'NEXT'
  };
  var replyTo = props.getProperty('RESPONDER_A');
  if (replyTo) opts.replyTo = replyTo;
  MailApp.sendEmail(opts);
}

/* ---------------- Plantilla del correo ---------------- */

var C = { bg: '#ECEAEF', card: '#FBFAFC', ink: '#1A1A1A', ink2: '#525252', ink3: '#8A8794', hair: '#E2DFE8',
  lavanda: '#8377EC', malva: '#BE52D8', cielo: '#489BFF', dark: '#171d31' };
var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";
var MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

var EVIDENCE = [
  'Un metaanálisis de 71 estudios con más de 98.000 personas, publicado en 2025 en Psychological Bulletin (Asociación Americana de Psicología), encontró que usar más videos cortos se asocia con peor atención y menos control de impulsos. Es una asociación: todavía no prueba que el scroll sea la causa.',
  'Entre los 13 y 18 años se necesitan de 8 a 10 horas de sueño, según la Academia Americana de Medicina del Sueño.',
  'La Academia Americana de Pediatría recomienda un plan de medios en familia, no usar pantallas 1 hora antes de dormir y no dormir con el celular en el cuarto.',
  'La Asociación Española de Pediatría sugiere menos de 2 horas diarias de pantallas entre los 13 y 16 años.'
];
var SOURCES = [
  ['Nguyen et al., Psychological Bulletin (2025)', 'https://doi.org/10.1037/bul0000498'],
  ['APA, Health Advisory (2023)', 'https://www.apa.org/news/press/releases/2023/05/adolescent-social-media-use-recommendations'],
  ['AAP, uso de medios en adolescentes', 'https://www.aafp.org/pubs/afp/issues/2017/0701/p56.html'],
  ['AASM, sueño en adolescentes', 'https://aasm.org/resources/pdf/pressroom/teen-sleep-duration-recommendation.pdf'],
  ['AEP, Plan Digital Familiar (2024)', 'https://aeped.es/sites/default/files/20241205_ndp_aep_actualizacion_plan_digital_familiar_def.pdf']
];
var RETOS = ['El celular duerme fuera del cuarto esta noche', 'Una comida en familia sin pantallas', 'Cambiar 30 minutos de scroll por crear algo con IA'];
var INSTAGRAM = 'https://www.instagram.com/next.fellowship/';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function firstName(n) { return esc(String(n || '').trim().split(/\s+/)[0] || ''); }

function button(label, url) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 4px"><tr>' +
    '<td style="border-radius:10px;background-color:' + C.lavanda + ';background-image:linear-gradient(135deg,' + C.malva + ' 0%,' + C.lavanda + ' 50%,' + C.cielo + ' 100%)">' +
    '<a href="' + esc(url) + '" target="_blank" style="display:inline-block;padding:14px 24px;font-family:' + FONT + ';font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">' + esc(label) + '</a>' +
    '</td></tr></table>';
}

function healthColor(h) { return h >= 80 ? '#1FA9C9' : h >= 55 ? C.lavanda : h >= 30 ? '#D9861C' : '#E0337E'; }

function buildEmailHtml(d) {
  var h = Math.max(0, Math.min(100, Number(d.health) || 0));
  var steps = (d.steps || []).map(function (s, i) {
    return '<tr><td valign="top" style="padding:0 14px 14px 0;width:34px">' +
      '<div style="width:34px;height:34px;line-height:34px;border-radius:17px;text-align:center;color:#fff;font-family:' + MONO + ';font-size:12px;font-weight:600;background-color:' + C.lavanda + ';background-image:linear-gradient(135deg,' + C.malva + ',' + C.lavanda + ',' + C.cielo + ')">0' + (i + 1) + '</div></td>' +
      '<td valign="top" style="padding:6px 0 14px;font-family:' + FONT + ';font-size:15px;line-height:1.5;color:' + C.ink2 + '">' + esc(s) + '</td></tr>';
  }).join('');
  var evidence = EVIDENCE.map(function (t) { return '<li style="margin:0 0 8px">' + esc(t) + '</li>'; }).join('');
  var sources = SOURCES.map(function (s) { return '<a href="' + s[1] + '" style="color:' + C.lavanda + '">' + esc(s[0]) + '</a>'; }).join(' · ');

  var closing;
  if (d.invite === 'community' && d.communityUrl) {
    var retos = RETOS.map(function (r, i) {
      return '<tr><td style="padding:6px 0;font-family:' + FONT + ';font-size:14px;color:#E4E4F2">' +
        '<span style="display:inline-block;font-family:' + MONO + ';font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#fff;background:' + C.lavanda + ';padding:4px 8px;border-radius:6px;margin-right:10px">Reto ' + (i + 1) + '</span>' + esc(r) + '</td></tr>';
    }).join('');
    closing = '<td style="background:' + C.dark + ';border-radius:18px;padding:26px">' +
      '<div style="font-family:' + MONO + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A9AFD6">Comunidad de papás NEXT</div>' +
      '<div style="font-family:' + FONT + ';font-size:22px;font-weight:800;color:#fff;margin:8px 0 10px;letter-spacing:-.3px">Únete a nuestra comunidad</div>' +
      '<div style="font-family:' + FONT + ';font-size:15px;line-height:1.55;color:#C9CCE4">Allí Andrés Bilbao, cofundador de Rappi, manda cada día un reto corto para ayudarte a mejorar los hábitos de tu hijo con el celular. Son 5 a 10 minutos al día.</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px">' + retos + '</table>' +
      button('Entrar a la comunidad', d.communityUrl) + '</td>';
  } else {
    closing = '<td style="background:' + C.card + ';border:1px solid ' + C.hair + ';border-radius:18px;padding:26px">' +
      '<div style="font-family:' + FONT + ';font-size:20px;font-weight:800;color:' + C.ink + ';margin:0 0 8px;letter-spacing:-.3px">Síguenos en Instagram</div>' +
      '<div style="font-family:' + FONT + ';font-size:15px;line-height:1.55;color:' + C.ink2 + '">En @next.fellowship mostramos cómo adolescentes de Latinoamérica usan la IA para crear sus propios proyectos.</div>' +
      button('Seguir a @next.fellowship', INSTAGRAM) + '</td>';
  }

  var logo = d.logoUrl
    ? '<img src="' + esc(d.logoUrl) + '" alt="NEXT" height="30" style="display:block;height:30px;width:auto;border:0">'
    : '<span style="font-family:' + FONT + ';font-size:22px;font-weight:800;color:' + C.ink + '">NEXT</span>';

  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:' + C.bg + '">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + C.bg + '"><tr><td align="center" style="padding:28px 14px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">' +
    '<tr><td style="padding:0 6px 18px">' + logo + '</td></tr>' +
    '<tr><td style="background:' + C.card + ';border:1px solid ' + C.hair + ';border-radius:18px;padding:30px 26px">' +
      '<div style="font-family:' + MONO + ';font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:' + C.ink3 + '"><span style="color:' + C.lavanda + '">◇</span>&nbsp; Resultado del diagnóstico</div>' +
      '<div style="font-family:' + FONT + ';font-size:16px;color:' + C.ink2 + ';margin:16px 0 4px">Hola ' + firstName(d.name) + ', este es el resultado:</div>' +
      '<div style="font-family:' + FONT + ';font-size:30px;line-height:1.1;font-weight:800;color:' + C.ink + ';letter-spacing:-.6px;margin:6px 0 16px">' + esc(d.title) + ' ' + esc(d.emoji) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td style="font-family:' + MONO + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + C.ink3 + '">Salud cerebral</td>' +
        '<td align="right" style="font-family:' + FONT + ';font-size:26px;font-weight:800;color:' + healthColor(h) + '">' + h + '%</td></tr>' +
        '<tr><td colspan="2" style="padding-top:8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E6E3EC;border-radius:6px"><tr>' +
          '<td width="' + Math.max(2, h) + '%" style="height:10px;line-height:10px;font-size:0;border-radius:6px;background:' + healthColor(h) + '">&nbsp;</td>' +
          (h < 100 ? '<td style="height:10px;line-height:10px;font-size:0">&nbsp;</td>' : '') +
        '</tr></table></td></tr></table>' +
      '<div style="font-family:' + FONT + ';font-size:16px;line-height:1.6;color:' + C.ink2 + ';margin:20px 0 6px">' + esc(d.text) + '</div>' +
      '<div style="font-family:' + FONT + ';font-size:19px;font-weight:800;color:' + C.ink + ';margin:22px 0 14px;letter-spacing:-.3px">Tu plan para esta semana</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0">' + steps + '</table>' +
    '</td></tr>' +
    '<tr><td style="height:16px;font-size:0">&nbsp;</td></tr>' +
    '<tr>' + closing + '</tr>' +
    '<tr><td style="padding:22px 6px 0;font-family:' + FONT + ';font-size:13px;line-height:1.55;color:' + C.ink2 + '">' +
      '<div style="font-family:' + MONO + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + C.lavanda + ';margin-bottom:8px">Qué dice la evidencia</div>' +
      '<ul style="margin:0;padding-left:18px">' + evidence + '</ul>' +
      '<div style="font-size:12px;color:' + C.ink3 + ';margin-top:8px">Fuentes: ' + sources + '</div>' +
      '<div style="font-size:12px;color:' + C.ink3 + ';margin-top:14px">Este diagnóstico es orientativo y no reemplaza la evaluación de un profesional de salud. Recibes este correo porque hiciste el diagnóstico de brain rot de NEXT.</div>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function buildEmailText(d) {
  var lines = ['Hola ' + (String(d.name || '').trim().split(/\s+/)[0] || '') + ', este es el resultado del diagnóstico:', '',
    d.title + ' ' + d.emoji + ' · Salud cerebral: ' + d.health + '%', '', d.text, '', 'Tu plan para esta semana:'];
  (d.steps || []).forEach(function (s, i) { lines.push((i + 1) + '. ' + s); });
  lines.push('');
  if (d.invite === 'community' && d.communityUrl) {
    lines.push('Únete a nuestra comunidad de papás NEXT. Allí Andrés Bilbao, cofundador de Rappi, manda cada día un reto corto para ayudarte a mejorar los hábitos de tu hijo con el celular: ' + d.communityUrl);
  } else {
    lines.push('Síguenos en Instagram: ' + INSTAGRAM);
  }
  lines.push('', 'Qué dice la evidencia:');
  EVIDENCE.forEach(function (t) { lines.push('- ' + t); });
  lines.push('', 'Este diagnóstico es orientativo y no reemplaza la evaluación de un profesional de salud.');
  return lines.join('\n');
}

/* ---------------- Utilidades ---------------- */

// Evita que un texto como "=..." o "+57..." se interprete como fórmula o número.
function clean(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  var s = String(v).slice(0, 1000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Corre esta función una vez desde el editor para autorizar los permisos y recibir un correo de prueba.
function probarCorreo() {
  var to = Session.getActiveUser().getEmail();
  sendResultEmail({
    to: to, name: 'Prueba', key: 'scroll', title: 'Scroll infinito', emoji: '🌀', health: 42,
    text: 'El celular está marcando el ritmo de su día. Le cuesta sostener la atención, se aburre rápido y probablemente duerme menos de lo que necesita.',
    steps: ['Paso uno de prueba.', 'Paso dos de prueba.', 'Paso tres de prueba.'],
    invite: 'community', communityUrl: 'https://example.com'
  }, PropertiesService.getScriptProperties());
  Logger.log('Correo de prueba enviado a ' + to);
}
