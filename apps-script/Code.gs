/**
 * Test brain rot · NEXT
 * 1) Guarda cada lead como una fila en la pestaña "Leads".
 * 2) Envía al padre o la madre un correo con su resultado.
 * 3) Atiende el enlace para darse de baja (pestaña "Bajas").
 *
 * Propiedades del script (Configuración del proyecto > Propiedades del script):
 *   SECRET          (obligatoria) la misma clave que SHEETS_SECRET en Vercel
 *   LOGO_URL        (recomendada) https://next-brain-rot.vercel.app/brand/logo-next-email.png
 *   POLITICA_URL    (obligatoria para publicar) URL de la política de tratamiento de datos de NEXT
 *   REMITENTE       (opcional) nombre que ve el destinatario, por defecto "NEXT"
 *   RESPONDER_A     (opcional) correo al que llegan las respuestas
 *   ENVIAR_CORREO   (opcional) "no" para pausar los correos sin tocar el código
 *   MOSTRAR_QUE_SIGUE (opcional) "si" solo cuando el envío por WhatsApp de la guía esté activo
 */
var SHEET_NAME = 'Leads';
var BAJAS_NAME = 'Bajas';
var HEADERS = [
  'Fecha', 'Nombre', 'Correo', 'WhatsApp', 'Nivel', 'Salud cerebral', 'Puntaje oculto', 'Segmento', 'Invitación',
  'Q1 horas (estimación)', 'Q2 película', 'Q3 tareas', 'Q4 sin el celular', 'Q5 hora', 'Q6 acertijo', 'Q7 expresiones en casa',
  'Q8 colegio', 'Q9 dispositivo', 'Q10 estímulos', 'Q11 meta', 'Q12 experiencias', 'Q13 preocupación', 'Q14 inversión',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'Página', 'Correo enviado', 'Pausa (errores)'
];
var COL_EMAIL_STATUS = 30;
var COL_PULSE = 31;

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
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    var row = (body.row || []).slice(0, COL_EMAIL_STATUS - 1).map(clean);
    while (row.length < COL_EMAIL_STATUS - 1) row.push('');
    row[0] = new Date();
    row.push('Pendiente');
    row.push(body.pulse === undefined || body.pulse === 'skip' ? 'Omitida' : clean(body.pulse));
    sheet.appendRow(row);
    rowNumber = sheet.getLastRow();
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }

  // 2) Enviar el correo (si falla, el lead ya quedó guardado y la columna lo indica)
  var status = 'No';
  try {
    if (String(props.getProperty('ENVIAR_CORREO') || 'si').toLowerCase() === 'no') {
      status = 'Pausado';
    } else if (body.email && body.email.to) {
      if (isUnsubscribed(body.email.to)) status = 'Dado de baja';
      else { sendResultEmail(body.email, props); status = 'Sí'; }
    }
  } catch (err) {
    status = 'Error: ' + String(err).slice(0, 200);
  }
  sheet.getRange(rowNumber, COL_EMAIL_STATUS).setValue(status);

  return reply({ ok: true, email: status });
}

/* ---------------- Darse de baja ---------------- */

function unsubToken(email) {
  var secret = PropertiesService.getScriptProperties().getProperty('SECRET') || '';
  var sig = Utilities.computeHmacSha256Signature(String(email).toLowerCase(), secret);
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '').slice(0, 24);
}

function unsubscribeUrl(email) {
  var base = ScriptApp.getService().getUrl();
  if (!base) return '';
  return base + '?baja=1&e=' + encodeURIComponent(email) + '&t=' + unsubToken(email);
}

function isUnsubscribed(email) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BAJAS_NAME);
  if (!sh || sh.getLastRow() < 2) return false;
  var target = String(email).toLowerCase();
  var vals = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).toLowerCase() === target) return true;
  return false;
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.baja === '1' && p.e && p.t && p.t === unsubToken(p.e)) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(BAJAS_NAME) || ss.insertSheet(BAJAS_NAME);
    if (sh.getLastRow() === 0) sh.appendRow(['Fecha', 'Correo']);
    if (!isUnsubscribed(p.e)) sh.appendRow([new Date(), String(p.e).toLowerCase()]);
    return page('Listo', 'No le enviaremos más correos sobre el test brain rot de NEXT a ' + esc(p.e) + '.');
  }
  return page('Enlace no válido', 'Este enlace para darse de baja no es válido o está incompleto.');
}

function page(title, text) {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#1A1A1A">' +
    '<h2 style="margin:0 0 12px">' + esc(title) + '</h2><p style="color:#525252;line-height:1.5">' + text + '</p></div>'
  ).setTitle(title);
}

/* ---------------- Envío ---------------- */

function sendResultEmail(d, props) {
  var logoUrl = props.getProperty('LOGO_URL') || d.logoUrl || '';
  var inline = null;
  // El logo va adjunto dentro del correo (cid), así se ve aunque el cliente bloquee imágenes externas.
  if (logoUrl) {
    try {
      var r = UrlFetchApp.fetch(logoUrl, { muteHttpExceptions: true });
      if (r.getResponseCode() === 200) inline = { logo: r.getBlob().setName('logo-next.png') };
    } catch (e) {}
  }
  var data = Object.assign({}, d, {
    logoUrl: inline ? 'cid:logo' : logoUrl,
    unsubscribeUrl: unsubscribeUrl(d.to),
    policyUrl: props.getProperty('POLITICA_URL') || '',
    showNextUp: String(props.getProperty('MOSTRAR_QUE_SIGUE') || 'no').toLowerCase() === 'si'
  });
  var opts = {
    to: d.to,
    subject: firstNamePlain(d.name) + ', este es el resultado del test brain rot de su hogar',
    htmlBody: buildEmailHtml(data),
    body: buildEmailText(data),
    name: props.getProperty('REMITENTE') || 'NEXT'
  };
  if (inline) opts.inlineImages = inline;
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
  'Un metaanálisis de 71 estudios con más de 98.000 participantes, publicado en 2025 en Psychological Bulletin (revista de la Asociación Americana de Psicología), encontró que un mayor uso de videos cortos se asocia con menor atención y menor control de impulsos. Se trata de una asociación; no demuestra que el contenido corto sea la causa.',
  'Entre los 13 y 18 años se necesitan de 8 a 10 horas de sueño, según la Academia Americana de Medicina del Sueño.',
  'La Academia Americana de Pediatría recomienda un plan de medios en familia, no usar pantallas la hora previa a dormir y no dormir con el celular en la habitación.',
  'La Asociación Española de Pediatría sugiere menos de 2 horas diarias de pantallas entre los 13 y 16 años.'
];
var SOURCES = [
  ['Nguyen et al., Psychological Bulletin (2025)', 'https://doi.org/10.1037/bul0000498'],
  ['APA, Health Advisory (2023)', 'https://www.apa.org/news/press/releases/2023/05/adolescent-social-media-use-recommendations'],
  ['AAP, uso de medios en adolescentes', 'https://www.aafp.org/pubs/afp/issues/2017/0701/p56.html'],
  ['AASM, sueño en adolescentes', 'https://aasm.org/resources/pdf/pressroom/teen-sleep-duration-recommendation.pdf'],
  ['AEP, Plan Digital Familiar (2024)', 'https://aeped.es/sites/default/files/20241205_ndp_aep_actualizacion_plan_digital_familiar_def.pdf']
];
var INSTAGRAM = 'https://www.instagram.com/next.fellowship/';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function firstNamePlain(n) { return String(n || '').trim().split(/\s+/)[0] || 'Hola'; }
function firstName(n) { return esc(firstNamePlain(n)); }

function button(label, url, ghost) {
  var bg = ghost ? 'background-color:#ffffff;border:1px solid ' + C.hair : 'background-color:' + C.lavanda + ';background-image:linear-gradient(135deg,' + C.malva + ' 0%,' + C.lavanda + ' 50%,' + C.cielo + ' 100%)';
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 4px"><tr>' +
    '<td style="border-radius:10px;' + bg + '">' +
    '<a href="' + esc(url) + '" target="_blank" style="display:inline-block;padding:14px 24px;font-family:' + FONT + ';font-size:16px;font-weight:600;color:' + (ghost ? C.ink : '#ffffff') + ';text-decoration:none;border-radius:10px">' + esc(label) + '</a>' +
    '</td></tr></table>';
}

function healthColor(h) { return h >= 80 ? '#1FA9C9' : h >= 55 ? C.lavanda : h >= 30 ? '#D9861C' : '#E0337E'; }

function stepParts(s) { return Array.isArray(s) ? s : ['', String(s)]; }

function buildEmailHtml(d) {
  var h = Math.max(0, Math.min(100, Number(d.health) || 0));
  var isA = d.invite === 'community' && d.communityUrl;
  var steps = (d.steps || []).map(function (s, i) {
    var p = stepParts(s);
    return '<tr><td valign="top" style="padding:0 14px 14px 0;width:34px">' +
      '<div style="width:34px;height:34px;line-height:34px;border-radius:17px;text-align:center;color:#fff;font-family:' + MONO + ';font-size:12px;font-weight:600;background-color:' + C.lavanda + ';background-image:linear-gradient(135deg,' + C.malva + ',' + C.lavanda + ',' + C.cielo + ')">0' + (i + 1) + '</div></td>' +
      '<td valign="top" style="padding:6px 0 14px;font-family:' + FONT + ';font-size:15px;line-height:1.5;color:' + C.ink2 + '"><b style="color:' + C.ink + '">' + esc(p[0]) + '</b> ' + esc(p[1]) + '</td></tr>';
  }).join('');
  var evidence = EVIDENCE.map(function (t) { return '<li style="margin:0 0 8px">' + esc(t) + '</li>'; }).join('');
  var sources = SOURCES.map(function (s) { return '<a href="' + s[1] + '" style="color:' + C.lavanda + '">' + esc(s[0]) + '</a>'; }).join(' · ');

  var closing;
  if (isA) {
    closing = '<td style="background:' + C.dark + ';border-radius:18px;padding:26px">' +
      '<div style="font-family:' + MONO + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A9AFD6">Lista VIP de padres NEXT</div>' +
      '<div style="font-family:' + FONT + ';font-size:22px;font-weight:800;color:#fff;margin:8px 0 10px;letter-spacing:-.3px">Únase a la Lista VIP de padres NEXT</div>' +
      '<div style="font-family:' + FONT + ';font-size:15px;line-height:1.55;color:#C9CCE4">En la Lista VIP, Andrés Bilbao, fundador de NEXT y cofundador de Rappi, compartirá retos breves para hacer en casa con su hijo y mejorar sus hábitos con el celular. Los miembros también tendrán acceso anticipado a la oferta de Black Friday.</div>' +
      button('Unirme a la Lista VIP', d.communityUrl) + '</td>';
  } else {
    closing = '<td style="background:' + C.card + ';border:1px solid ' + C.hair + ';border-radius:18px;padding:26px">' +
      '<div style="font-family:' + FONT + ';font-size:20px;font-weight:800;color:' + C.ink + ';margin:0 0 8px;letter-spacing:-.3px">Siga a NEXT en Instagram</div>' +
      '<div style="font-family:' + FONT + ';font-size:15px;line-height:1.55;color:' + C.ink2 + '">En @next.fellowship mostramos cómo adolescentes de Latinoamérica usan la inteligencia artificial para crear sus propios proyectos.</div>' +
      button('Ver @next.fellowship', INSTAGRAM) + '</td>';
  }

  var nextUp = d.showNextUp
    ? '<div style="margin:20px 0 0;padding:16px 18px;border-radius:14px;background:#F1EFF8;font-family:' + FONT + ';font-size:15px;line-height:1.55;color:' + C.ink2 + '"><b style="color:' + C.ink + '">Qué sigue.</b> En los próximos minutos recibirá por WhatsApp una guía práctica para su nivel y una idea de negocio pensada según los intereses de su hijo.</div>'
    : '';
  var share = d.shareUrl
    ? '<tr><td style="padding:16px 6px 0">' + button('Compartir mi resultado', d.shareUrl, true) + '</td></tr>'
    : '';

  var logo = d.logoUrl
    ? '<img src="' + esc(d.logoUrl) + '" alt="NEXT" height="30" style="display:block;height:30px;width:auto;border:0;font-family:Arial,sans-serif;font-size:20px;font-weight:800;color:#1A1A1A">'
    : '<span style="font-family:' + FONT + ';font-size:22px;font-weight:800;color:' + C.ink + '">NEXT</span>';

  var unsub = d.unsubscribeUrl ? '<a href="' + esc(d.unsubscribeUrl) + '" style="color:' + C.lavanda + '">darse de baja aquí</a>' : 'darse de baja respondiendo a este correo';
  var policy = d.policyUrl ? '<a href="' + esc(d.policyUrl) + '" style="color:' + C.lavanda + '">política de tratamiento de datos</a>' : 'política de tratamiento de datos';

  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:' + C.bg + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Incluye tres recomendaciones prácticas para esta semana.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:' + C.bg + '"><tr><td align="center" style="padding:28px 14px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">' +
    '<tr><td style="padding:0 6px 18px">' + logo + '</td></tr>' +
    '<tr><td style="background:' + C.card + ';border:1px solid ' + C.hair + ';border-radius:18px;padding:30px 26px">' +
      '<div style="font-family:' + MONO + ';font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:' + C.ink3 + '"><span style="color:' + C.lavanda + '">◇</span>&nbsp; Su resultado · Test brain rot de NEXT</div>' +
      '<div style="font-family:' + FONT + ';font-size:16px;color:' + C.ink2 + ';margin:16px 0 4px">Hola, ' + firstName(d.name) + '. Este es el resultado de su hogar:</div>' +
      '<div style="font-family:' + FONT + ';font-size:30px;line-height:1.1;font-weight:800;color:' + C.ink + ';letter-spacing:-.6px;margin:6px 0 16px">' + esc(d.title) + ' ' + esc(d.emoji) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td style="font-family:' + MONO + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + C.ink3 + '">Salud cerebral</td>' +
        '<td align="right" style="font-family:' + FONT + ';font-size:26px;font-weight:800;color:' + healthColor(h) + '">' + h + '%</td></tr>' +
        '<tr><td colspan="2" style="padding-top:8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E6E3EC;border-radius:6px"><tr>' +
          '<td width="' + Math.max(2, h) + '%" style="height:10px;line-height:10px;font-size:0;border-radius:6px;background:' + healthColor(h) + '">&nbsp;</td>' +
          (h < 100 ? '<td style="height:10px;line-height:10px;font-size:0">&nbsp;</td>' : '') +
        '</tr></table></td></tr></table>' +
      '<div style="font-family:' + FONT + ';font-size:16px;line-height:1.6;color:' + C.ink2 + ';margin:20px 0 6px">' + esc(d.text) + '</div>' +
      nextUp +
      '<div style="font-family:' + FONT + ';font-size:19px;font-weight:800;color:' + C.ink + ';margin:22px 0 14px;letter-spacing:-.3px">Su plan para esta semana</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0">' + steps + '</table>' +
    '</td></tr>' +
    '<tr><td style="height:16px;font-size:0">&nbsp;</td></tr>' +
    '<tr>' + closing + '</tr>' +
    share +
    '<tr><td style="padding:22px 6px 0;font-family:' + FONT + ';font-size:13px;line-height:1.55;color:' + C.ink2 + '">' +
      '<div style="font-family:' + MONO + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + C.lavanda + ';margin-bottom:8px">Qué dice la evidencia</div>' +
      '<ul style="margin:0;padding-left:18px">' + evidence + '</ul>' +
      '<div style="font-size:12px;color:' + C.ink3 + ';margin-top:8px">Fuentes: ' + sources + '</div>' +
      '<div style="font-size:12px;color:' + C.ink3 + ';margin-top:14px">Si le preocupa el estado de ánimo o el descanso de su hijo, consulte con un profesional de su confianza.</div>' +
      '<div style="font-size:12px;color:' + C.ink3 + ';margin-top:10px">Usted recibe este correo porque realizó el test brain rot de NEXT y autorizó el envío de su resultado. Si no desea recibir más mensajes, puede ' + unsub + '. Consulte nuestra ' + policy + '.</div>' +
      '<div style="font-size:12px;color:' + C.ink3 + ';margin-top:10px">Este test es orientativo y no constituye una evaluación médica ni psicológica.</div>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function buildEmailText(d) {
  var isA = d.invite === 'community' && d.communityUrl;
  var lines = ['Hola, ' + firstNamePlain(d.name) + '. Este es el resultado de su hogar:', '',
    d.title + ' ' + d.emoji + ' · Salud cerebral: ' + d.health + '%', '', d.text, '', 'Su plan para esta semana:'];
  (d.steps || []).forEach(function (s, i) { var p = stepParts(s); lines.push((i + 1) + '. ' + (p[0] ? p[0] + ' ' : '') + p[1]); });
  lines.push('');
  if (isA) {
    lines.push('Únase a la Lista VIP de padres NEXT. Allí, Andrés Bilbao, fundador de NEXT y cofundador de Rappi, compartirá retos breves para hacer en casa con su hijo y mejorar sus hábitos con el celular. Los miembros también tendrán acceso anticipado a la oferta de Black Friday. Entre aquí: ' + d.communityUrl);
  } else {
    lines.push('Siga a NEXT en Instagram: ' + INSTAGRAM);
  }
  if (d.shareUrl) lines.push('', 'Compartir mi resultado: ' + d.shareUrl);
  lines.push('', 'Qué dice la evidencia:');
  EVIDENCE.forEach(function (t) { lines.push('- ' + t); });
  lines.push('', 'Si le preocupa el estado de ánimo o el descanso de su hijo, consulte con un profesional de su confianza.');
  lines.push('Usted recibe este correo porque realizó el test brain rot de NEXT y autorizó el envío de su resultado.' +
    (d.unsubscribeUrl ? ' Para darse de baja: ' + d.unsubscribeUrl : '') + (d.policyUrl ? ' Política de tratamiento de datos: ' + d.policyUrl : ''));
  lines.push('Este test es orientativo y no constituye una evaluación médica ni psicológica.');
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

/* ---------------- Pruebas desde el editor ---------------- */

var TEST_STEPS = [
  ['Empiece usted.', 'Muéstrele a su hijo su propio tiempo de pantalla antes de pedirle el suyo.'],
  ['Proteja el descanso.', 'Eviten las pantallas durante la hora previa a dormir.'],
  ['Converse sin reproches.', 'Pregúntele qué contenido ve y por qué le gusta.']
];
function testData(invite) {
  return {
    to: Session.getActiveUser().getEmail(), name: 'Prueba', key: 'fragmentada', title: 'Atención fragmentada', emoji: '🟠', health: 42,
    text: 'El celular está ocupando parte del tiempo de tareas, descanso y conversación. Hay margen claro para mejorar con hábitos sencillos y constantes.',
    steps: TEST_STEPS, invite: invite, communityUrl: invite === 'community' ? 'https://example.com' : null,
    shareUrl: 'https://next-brain-rot.vercel.app/?nivel=fragmentada&salud=42'
  };
}
// Correo como lo recibe el segmento A (con Lista VIP).
function probarCorreoA() { sendResultEmail(testData('community'), PropertiesService.getScriptProperties()); Logger.log('Correo A enviado'); }
// Correo como lo reciben B y C (con Instagram, sin Lista VIP).
function probarCorreoBC() { sendResultEmail(testData('instagram'), PropertiesService.getScriptProperties()); Logger.log('Correo B/C enviado'); }

function revisarLogo() {
  var url = PropertiesService.getScriptProperties().getProperty('LOGO_URL');
  Logger.log('LOGO_URL = ' + url);
  if (!url) { Logger.log('La propiedad LOGO_URL no existe o está vacía'); return; }
  var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log('Respuesta: ' + r.getResponseCode() + ' · tipo: ' + r.getHeaders()['Content-Type']);
}
