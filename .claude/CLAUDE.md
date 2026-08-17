# Epycentro del Sabor — sitio web

Landing page estática (sin framework/build): `index.html`, `styles.css`, `script.js`, assets en `assets/`.
Un endpoint serverless en `api/subscribe.js` (Vercel) para el formulario del Club Epycentro.

## Estado actual (2026-08-16)

Secciones de la página: header con nav sticky + menú hamburguesa, hero, franja promocional
(banda con link a Pedifast como botón), menú (grid de tarjetas: hamburguesas, completos,
papas fritas, empanadas, sushi, sandwiches), **Club Epycentro** (formulario de suscripción),
ubicación (mapa embebido de Google Maps + horarios), contacto (botón de WhatsApp) y footer.

- Pedidos online: Pedifast (`https://pedifast.app/epycentro-del-sabor`), enlazado en varios
  botones (nav, hero, franja promo, menú).
- WhatsApp de contacto: `+56 9 4267 0890`.
- Dirección: Circunvalación 80, Viña del Mar, Valparaíso, Chile.
- Horarios: Lun–Jue 17:30–23:00, Vie–Sáb 18:00–00:00.

### Club Epycentro (formulario + correo de bienvenida)

- Sección `#club` en `index.html`: formulario con nombre, correo y teléfono
  (`clubForm` en `script.js`).
- Al enviarse, hace `POST /api/subscribe` (JSON: `nombre`, `email`, `telefono`).
- `api/subscribe.js` es una función serverless de **Vercel** (Node, CommonJS, sin
  dependencias npm) que llama a la API REST de **Resend** (`https://api.resend.com/emails`)
  para mandar un correo de bienvenida con el código de descuento fijo `BIENVENIDA10` (10%).
- Requiere desplegar en Vercel (no funciona en GitHub Pages, que es solo estático) y
  configurar variables de entorno en el proyecto de Vercel:
  - `RESEND_API_KEY` (obligatoria) — API key de Resend.
  - `RESEND_FROM_EMAIL` (opcional) — remitente; si no se define usa
    `Epycentro del Sabor <onboarding@resend.dev>` (dominio de pruebas de Resend).
    Para producción conviene verificar un dominio propio en Resend y usarlo acá.
- **Decisión (2026-08-16):** por ahora se usa el remitente de pruebas `onboarding@resend.dev`
  a propósito (no tienen dominio propio todavía). **Limitación importante:** con este
  remitente, Resend solo permite enviar correos a la dirección con la que se creó la
  cuenta de Resend — un cliente real que llene el formulario con otro correo NO va a
  recibir el mail (Resend lo rechaza). Sirve para probar el flujo, pero no funciona para
  clientes reales hasta verificar un dominio propio en Resend y setear `RESEND_FROM_EMAIL`.
- El código de descuento (`BIENVENIDA10`) está hardcodeado en `api/subscribe.js`
  (constante `DISCOUNT_CODE`); es el mismo para todos los que se suscriban.
- **Persistencia de leads (Supabase):** `api/subscribe.js` guarda cada suscripción en la
  tabla `club_subscribers` de **Supabase** antes de mandar el correo. Esquema en
  `supabase/schema.sql` (correrlo en el SQL Editor del proyecto de Supabase).
  - Columnas: `id` (uuid), `nombre`, `email` (**único**), `telefono`, `created_at`.
  - RLS activado sin policies: la tabla solo es accesible con la `service_role` key
    (usada server-side en `api/subscribe.js`); las keys públicas (`publishable`/`anon`)
    no tienen acceso.
  - Variables de entorno adicionales en Vercel: `SUPABASE_URL` y
    `SUPABASE_SERVICE_ROLE_KEY` (esta última nunca debe usarse en código de frontend).
  - Si el correo ya existe (insert choca con el `unique`), la API responde
    `{ ok: true, yaRegistrado: true }`, **no reenvía el correo de bienvenida**, y el
    formulario muestra "ese correo ya está registrado" (`club-form-msg-info` en
    `script.js`/`styles.css`) en vez del mensaje de éxito.
  - Proyecto de Supabase, ref `qiojigkgnthpopczccnb` → URL `https://qiojigkgnthpopczccnb.supabase.co`.

## Despliegue

- Desplegado en **Vercel**, proyecto `epycentro-del-sabor-web`, conectado al repo de GitHub
  `ignaciogonzalez3010-arch/epycentro-del-sabor-web` (rama `main`, deploy automático en cada push).
- `RESEND_API_KEY` ya está configurada en Vercel → Settings → Environment Variables (ambiente
  Production) y **verificada funcionando**: el formulario del Club Epycentro se probó
  end-to-end el 2026-08-16 y el correo de bienvenida con `BIENVENIDA10` llegó correctamente.
- Recordatorio para futuros problemas con variables de entorno en Vercel: al guardar una
  variable "Sensitive", el campo Value puede *parecer* que tiene un valor (texto gris tipo
  `re_aBcDe…`) cuando en realidad está vacío — eso es un placeholder, no el valor guardado.
  Si una función se queja de que falta una env var que "sí está" en la lista, revisar que el
  campo Value tenga contenido real (no solo el placeholder) y hacer Redeploy después de
  guardar (las env vars nuevas no aplican a deployments ya existentes).

## Últimos cambios (commits)

- `8907566` — Formulario "Club Epycentro" (10% dcto.) + función serverless
  `api/subscribe.js` que envía correo de bienvenida vía Resend. Desplegado en Vercel y
  probado funcionando.
- `153735a` — Texto de la franja promocional actualizado y el link de Pedifast convertido en botón.
- `0ce0661` — Commit inicial del sitio (landing responsive con menú, ubicación, horarios, contacto).

## Notas

- El sitio estático no tiene build ni dependencias; se edita HTML/CSS/JS directo.
- `api/subscribe.js` sí depende de estar desplegado en una plataforma con funciones
  serverless (Vercel); usa `fetch` nativo de Node, sin paquetes npm adicionales.
- Sin tests ni linter configurados en el repo.
- Cuando se pida una modificación, actualizar esta sección de "Estado actual" al terminar
  para que quede como referencia de la próxima sesión.
