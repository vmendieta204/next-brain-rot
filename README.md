# Diagnóstico Brain Rot · NEXT

Landing del lead magnet para papás: quiz de 14 preguntas con cerebro 3D, formulario y resultado filtrado por perfil.

## Estructura

- `index.html`: la landing completa (sin tablas de perfil; el navegador solo conoce cuánto mueve el cerebro cada respuesta de la 1 a la 7).
- `api/submit.js`: recibe respuestas y datos, calcula salud y perfil, envía el lead a HubSpot y responde qué invitación mostrar. Nunca devuelve el puntaje de perfil ni el segmento.
- `lib/scoring.js`: pesos, diagnósticos, plan de 3 pasos por diagnóstico y reglas de segmento. Es el único lugar donde se cambian.
- `brain-mesh.js`: malla real de la corteza cerebral (plantilla fsaverage5 de FreeSurfer, promedio de resonancias), con la superficie externa, la de sustancia blanca y la profundidad de surcos. El deterioro adelgaza la corteza entre ambas superficies.
- `test.mjs`: pruebas del scoring (`npm test`).

## Variables de entorno

| Variable | Qué es |
|---|---|
| `HUBSPOT_PORTAL_ID` | ID de la cuenta de HubSpot |
| `HUBSPOT_FORM_ID` | GUID del formulario |
| `COMMUNITY_URL` | Link de la comunidad (solo lo recibe el segmento A) |

Si falta `COMMUNITY_URL`, todos ven la invitación a Instagram.

## Propiedades en HubSpot

Crea estas propiedades de contacto y agrégalas al formulario como campos ocultos, junto a `firstname`, `email` y `phone`:

- `next_brain_health` (número): salud cerebral 0 a 100
- `next_brain_diagnosis` (texto): nombre del diagnóstico
- `next_profile_score` (número): perfil oculto 0 a 100
- `next_lead_tier` (texto o selección A/B/C)
- `next_quiz_answers` (texto multilínea): respuestas en JSON

Con un workflow sobre `next_lead_tier`: A → lead calificado para ventas, B → secuencia de correo/WhatsApp, C → fuera de ventas.
Las UTM del anuncio también se envían si existen esas propiedades.

## Segmentos

- A: perfil ≥ 65 y no eligió "Menos de 100 USD" → ve la comunidad.
- B: perfil 40 a 64 (o ≥ 65 con menos de 100 USD) → Instagram, seguimiento.
- C: perfil < 40 → Instagram, fuera de ventas.

Si HubSpot falla, el papá igual ve su resultado y el error queda en los logs de la función.
