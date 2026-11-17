# Test brain rot para padres · NEXT

Landing del lead magnet para papás: quiz de 14 preguntas con cerebro 3D, formulario y resultado filtrado por perfil. Cada lead se guarda como una fila en Google Sheets y recibe su resultado por correo.

## Estructura

- `index.html`: la landing completa (sin tablas de perfil; el navegador solo conoce cuánto mueve el cerebro cada respuesta de la 1 a la 7).
- `api/submit.js`: recibe respuestas y datos, calcula salud y perfil, guarda el lead en Google Sheets y responde qué invitación mostrar. Nunca devuelve el puntaje de perfil ni el segmento.
- `lib/scoring.js`: pesos, diagnósticos, plan de 3 pasos por diagnóstico y reglas de segmento. Es el único lugar donde se cambian.
- `apps-script/Code.gs`: el script que va dentro de la hoja de Google: escribe cada lead y le manda el correo con el resultado.
- `brand/logo-next-email.png`: logo que usa el correo.
- `brain-mesh.js`: malla real de la corteza cerebral (plantilla fsaverage5 de FreeSurfer). Se carga después de mostrar la página.
- `vendor/three.min.js`: three.js r128 servido desde el propio dominio.
- `brand/brain-still.webp`: imagen fija del cerebro que se ve al instante mientras carga el 3D.
- `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`: íconos de NEXT.
- `test.mjs`: pruebas del scoring (`npm test`).

## Conectar Google Sheets

1. Crea una hoja de Google nueva (por ejemplo "Leads Brain Rot").
2. Extensiones → Apps Script. Borra lo que haya y pega el contenido de `apps-script/Code.gs`. Guarda.
3. En Apps Script: Configuración del proyecto (engranaje) → Propiedades del script → agrega `SECRET` con una clave larga inventada.
4. Implementar → Nueva implementación → tipo "Aplicación web".
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   Autoriza los permisos y copia la URL que termina en `/exec`.
5. En el proyecto de la landing: Settings → Environment Variables:

| Variable | Valor |
|---|---|
| `SHEETS_WEBHOOK_URL` | la URL `/exec` del paso 4 |
| `SHEETS_SECRET` | la misma clave del paso 3 |
| `COMMUNITY_URL` | link de la comunidad (solo lo recibe el segmento A) |

6. Redeploy. La pestaña "Leads" se crea sola con la primera respuesta.

Si cambias el código de Apps Script, vuelve a implementar con Implementar → Administrar implementaciones → editar → Nueva versión, para que la URL siga siendo la misma.

## Correo con el resultado

Lo envía la hoja (Apps Script) desde la cuenta de Google que creó el script. Límite: 1.500 destinatarios externos al día con Google Workspace, 100 con Gmail personal.
Propiedades opcionales del script: `REMITENTE` (nombre visible, por defecto "NEXT"), `RESPONDER_A` (correo de respuesta), `ENVIAR_CORREO` = `no` para pausar.
La columna "Correo enviado" dice Sí, Pausado o el error.

## Qué pasa si falla

Si la hoja no responde o la clave no coincide, el papá ve "No pudimos enviar tus datos" y puede reintentar; el lead no se pierde en silencio. El error queda en los logs de la función.

## Ajustes rápidos

- Política de tratamiento de datos en la landing: en `index.html`, buscar `var POLICY_URL = '';` y poner la URL entre las comillas.
- Política en el correo: propiedad `POLITICA_URL` en Apps Script.
- Bloque "Qué sigue" (WhatsApp): en `index.html`, `var SHOW_WHATSAPP_NEXT = false;` y en Apps Script la propiedad `MOSTRAR_QUE_SIGUE`. Activar solo cuando el envío por WhatsApp funcione.
- Bajas: el enlace del correo agrega el correo a la pestaña "Bajas" y ya no se le envía nada.

## Columnas de la hoja

Fecha · Nombre · Correo · WhatsApp · Nivel · Salud cerebral · Puntaje oculto · Segmento · Invitación · Q1 a Q14 · UTM · Página · Correo enviado · Pausa (errores).

## Segmentos

- A: perfil ≥ 65 y no eligió "Menos de 100 USD" → ve la comunidad.
- B: perfil 40 a 64 (o ≥ 65 con menos de 100 USD) → Instagram, seguimiento.
- C: perfil < 40 → Instagram, fuera de ventas.

## HubSpot (opcional)

Si algún día se conecta, basta con agregar `HUBSPOT_PORTAL_ID` y `HUBSPOT_FORM_ID`; el lead se envía a los dos destinos.
