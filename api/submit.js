import { score } from '../lib/scoring.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14'];
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'JSON inválido' }); }
  }
  const { name = '', email = '', phone = '', answers = {}, context = {} } = body || {};

  const lead = {
    name: String(name).trim().slice(0, 80),
    email: String(email).trim().toLowerCase().slice(0, 120),
    phone: String(phone).replace(/[^\d+]/g, '').slice(0, 20),
  };
  if (lead.name.length < 2 || !EMAIL_RE.test(lead.email) || lead.phone.replace(/\D/g, '').length < 8) {
    return res.status(400).json({ error: 'Datos de contacto incompletos' });
  }

  let result;
  try { result = score(answers); } catch { return res.status(400).json({ error: 'Faltan respuestas del quiz' }); }

  const { COMMUNITY_URL } = process.env;
  const invite = result.tier === 'A' && COMMUNITY_URL ? 'community' : 'instagram';
  const utm = context && typeof context.utm === 'object' && context.utm ? context.utm : {};

  const host = String(req.headers?.host || '').replace(/[^a-zA-Z0-9.:-]/g, '');
  const emailData = {
    to: lead.email, name: lead.name, key: result.diagnosis.key, title: result.diagnosis.title, emoji: result.diagnosis.emoji,
    text: result.diagnosis.text, steps: result.diagnosis.steps, health: result.health,
    invite, communityUrl: invite === 'community' ? COMMUNITY_URL : null,
    logoUrl: host ? `https://${host}/brand/logo-next-email.png` : '',
  };

  const saved = await Promise.all([
    saveToSheets(lead, result, invite, answers, utm, context, emailData),
    saveToHubSpot(lead, result, answers, utm, context),
  ]);

  // Si no se pudo guardar en ningún lado, el papá ve un error y puede reintentar: así no se pierde el lead.
  if (!saved.some(Boolean)) {
    return res.status(502).json({ error: 'No pudimos guardar tus datos' });
  }

  // El cliente nunca recibe el puntaje de perfil ni el segmento, solo qué invitación mostrar.
  return res.status(200).json({
    health: result.health,
    diagnosis: result.diagnosis,
    invite,
    communityUrl: invite === 'community' ? COMMUNITY_URL : null,
  });
}

async function saveToSheets(lead, result, invite, answers, utm, context, emailData) {
  const { SHEETS_WEBHOOK_URL, SHEETS_SECRET } = process.env;
  if (!SHEETS_WEBHOOK_URL || !SHEETS_SECRET) {
    console.warn('Google Sheets sin configurar: faltan SHEETS_WEBHOOK_URL o SHEETS_SECRET');
    return false;
  }
  const row = [
    '', lead.name, lead.email, lead.phone,
    `${result.diagnosis.title} ${result.diagnosis.emoji}`, result.health, result.profile, result.tier,
    invite === 'community' ? 'Comunidad' : 'Instagram',
    ...QUESTIONS.map((q) => (Array.isArray(answers[q]) ? answers[q].join(', ') : String(answers[q] ?? ''))),
    ...UTM.map((k) => String(utm[k] || '').slice(0, 200)),
    String(context.pageUri || '').slice(0, 500),
  ];
  try {
    const r = await fetch(SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: SHEETS_SECRET, row, email: emailData }),
      redirect: 'follow',
    });
    const text = await r.text();
    let data = {};
    try { data = JSON.parse(text); } catch { /* respuesta no JSON */ }
    if (!r.ok || !data.ok) {
      console.error('Google Sheets no guardó el lead', r.status, text.slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error enviando a Google Sheets', err);
    return false;
  }
}

// Opcional: solo corre si existen HUBSPOT_PORTAL_ID y HUBSPOT_FORM_ID.
async function saveToHubSpot(lead, result, answers, utm, context) {
  const { HUBSPOT_PORTAL_ID, HUBSPOT_FORM_ID } = process.env;
  if (!HUBSPOT_PORTAL_ID || !HUBSPOT_FORM_ID) return false;
  const fields = [
    { name: 'firstname', value: lead.name },
    { name: 'email', value: lead.email },
    { name: 'phone', value: lead.phone },
    { name: 'next_brain_health', value: String(result.health) },
    { name: 'next_brain_diagnosis', value: result.diagnosis.title },
    { name: 'next_profile_score', value: String(result.profile) },
    { name: 'next_lead_tier', value: result.tier },
    { name: 'next_quiz_answers', value: JSON.stringify(answers).slice(0, 1000) },
    ...UTM.filter((k) => utm[k]).map((k) => ({ name: k, value: String(utm[k]).slice(0, 200) })),
  ];
  const hsContext = { pageUri: String(context.pageUri || '').slice(0, 500), pageName: 'Diagnóstico Brain Rot NEXT' };
  if (/^[a-f0-9]{32}$/i.test(context.hutk || '')) hsContext.hutk = context.hutk;
  try {
    const r = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_ID}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields, context: hsContext }) }
    );
    if (!r.ok) { console.error('HubSpot respondió', r.status, await r.text()); return false; }
    return true;
  } catch (err) {
    console.error('Error enviando a HubSpot', err);
    return false;
  }
}
