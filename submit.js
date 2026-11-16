import { score } from '../lib/scoring.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

  const cleanName = String(name).trim().slice(0, 80);
  const cleanEmail = String(email).trim().toLowerCase().slice(0, 120);
  const cleanPhone = String(phone).replace(/[^\d+]/g, '').slice(0, 20);
  if (cleanName.length < 2 || !EMAIL_RE.test(cleanEmail) || cleanPhone.replace(/\D/g, '').length < 8) {
    return res.status(400).json({ error: 'Datos de contacto incompletos' });
  }

  let result;
  try { result = score(answers); } catch { return res.status(400).json({ error: 'Faltan respuestas del quiz' }); }

  const { HUBSPOT_PORTAL_ID, HUBSPOT_FORM_ID, COMMUNITY_URL } = process.env;

  if (HUBSPOT_PORTAL_ID && HUBSPOT_FORM_ID) {
    const utm = context && typeof context.utm === 'object' ? context.utm : {};
    const fields = [
      { name: 'firstname', value: cleanName },
      { name: 'email', value: cleanEmail },
      { name: 'phone', value: cleanPhone },
      { name: 'next_brain_health', value: String(result.health) },
      { name: 'next_brain_diagnosis', value: result.diagnosis.title },
      { name: 'next_profile_score', value: String(result.profile) },
      { name: 'next_lead_tier', value: result.tier },
      { name: 'next_quiz_answers', value: JSON.stringify(answers).slice(0, 1000) },
      ...['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .filter((k) => utm[k])
        .map((k) => ({ name: k, value: String(utm[k]).slice(0, 200) })),
    ];
    const hsContext = { pageUri: String(context.pageUri || '').slice(0, 500), pageName: 'Diagnóstico Brain Rot NEXT' };
    if (/^[a-f0-9]{32}$/i.test(context.hutk || '')) hsContext.hutk = context.hutk;

    try {
      const r = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_ID}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields, context: hsContext }) }
      );
      if (!r.ok) console.error('HubSpot respondió', r.status, await r.text());
    } catch (err) {
      console.error('Error enviando a HubSpot', err);
    }
  } else {
    console.warn('HubSpot sin configurar: faltan HUBSPOT_PORTAL_ID o HUBSPOT_FORM_ID');
  }

  // El cliente nunca recibe el puntaje de perfil ni el segmento, solo qué invitación mostrar.
  const invite = result.tier === 'A' && COMMUNITY_URL ? 'community' : 'instagram';
  return res.status(200).json({
    health: result.health,
    diagnosis: result.diagnosis,
    invite,
    communityUrl: invite === 'community' ? COMMUNITY_URL : null,
  });
}
