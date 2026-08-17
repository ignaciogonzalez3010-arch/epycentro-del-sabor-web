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
- **Persistencia de leads (Google Sheets), agregado 2026-08-17:** además de Supabase (se
  mantienen los dos a propósito, decisión del usuario), `api/subscribe.js` escribe cada
  suscripción nueva en una fila de Google Sheets vía la API REST de Sheets, autenticado con
  una **cuenta de servicio de Google Cloud** (JWT firmado a mano con `crypto` de Node,
  sin librerías npm — mismo patrón zero-dependency que el resto del proyecto).
  - Hoja: "Club Epycentro - Suscriptores", creada por el usuario (no por la cuenta de
    servicio — **las cuentas de servicio sin Google Workspace no tienen cuota de Drive
    propia y no pueden crear archivos nuevos**, solo editar archivos existentes que se
    les compartan). Compartida con Editor a la cuenta de servicio.
  - Spreadsheet ID: `1JyToEgVFeXZTzNPMvcJZTAx01OMzvzm63WiGuooP3hU`. Columnas en fila 1:
    `Nombre | Correo | Telefono | Fecha`.
  - Proyecto de Google Cloud: `careful-sun-344518`. Cuenta de servicio:
    `epycentro@careful-sun-344518.iam.gserviceaccount.com`. APIs habilitadas: **Google
    Sheets API** y **Google Drive API** (esta última hace falta aunque solo se use Sheets,
    si no se habilita da error 403 "The caller does not have permission" al intentar
    operar sobre el archivo).
  - Variables de entorno en Vercel: `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
    `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (el PEM completo; el código acepta tanto saltos
    de línea reales como `\n` literales), `GOOGLE_SHEETS_SPREADSHEET_ID`.
  - La escritura a Sheets es **best-effort / no bloqueante**: si falla o si las env vars no
    están configuradas, solo se registra un `console.error` y el flujo sigue (Supabase +
    correo de bienvenida no se ven afectados).
  - El archivo JSON de la cuenta de servicio (con la private key) quedó descargado en
    `C:\Users\ignac\Downloads\careful-sun-344518-9e2a3c3e8ad1.json` — **no está en el
    repo**, solo se usó localmente para extraer las credenciales y cargarlas a Vercel.
  - Se escribe con `valueInputOption=RAW` (no `USER_ENTERED`): con `USER_ENTERED`, Sheets
    interpreta el `+` inicial de los teléfonos como parte de una fórmula/número y lo pierde
    (`+56912345678` quedaba guardado como `56912345678`). Con `RAW` se guarda el texto tal
    cual se manda.

## Despliegue

- Desplegado en **Vercel**, proyecto `epycentro-del-sabor-web` (id `prj_WyVvqyTYjKdcb6Xmep4uCjIRuN1S`,
  team `team_XXRDTUWm7ErEH6VFRKeZY3NL`), conectado al repo de GitHub
  `ignaciogonzalez3010-arch/epycentro-del-sabor-web` (rama `main`, en teoría deploy
  automático en cada push — ver aviso abajo). Dominio de producción:
  `epycentro-del-sabor-web.vercel.app`.
- **⚠️ Pendiente de revisar:** el 2026-08-17 dos pushes seguidos a `main` (commits `57bf2e6`
  y `b36d36f`) **no dispararon un deploy automático** en Vercel (el último deployment
  quedaba pegado en el commit anterior). Hubo que crear el deployment a mano vía la API de
  Vercel (`POST /v13/deployments` con `gitSource`) las dos veces. Vale la pena revisar la
  integración de Git del proyecto en Vercel (Settings → Git) por si el webhook de GitHub se
  desconectó o perdió permisos — si no se soluciona, futuros pushes van a quedar sin
  desplegar hasta que alguien dispare el deploy manualmente (desde el dashboard de Vercel
  con "Redeploy", o pidiéndomelo).
- Variables de entorno configuradas en Vercel (Production), todas **verificadas funcionando**:
  - `RESEND_API_KEY` — probada end-to-end el 2026-08-16 (correo con `BIENVENIDA10` llegó bien).
  - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` — agregadas y probadas el 2026-08-17
    (insert/delete de prueba en `club_subscribers` vía API funcionó correctamente).
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`,
    `GOOGLE_SHEETS_SPREADSHEET_ID` — agregadas y probadas el 2026-08-17 end-to-end contra
    `/api/subscribe` en producción (con `RAW` ya corregido).
- Recordatorio para futuros problemas con variables de entorno en Vercel: al guardar una
  variable "Sensitive" desde el dashboard, el campo Value puede *parecer* que tiene un valor
  (texto gris tipo `re_aBcDe…`) cuando en realidad está vacío — eso es un placeholder, no el
  valor guardado. Si una función se queja de que falta una env var que "sí está" en la lista,
  revisar que el campo Value tenga contenido real y hacer Redeploy después de guardar (las
  env vars nuevas no aplican a deployments ya existentes). Crear/editar variables por la API
  de Vercel (como se hizo el 2026-08-17) evita este problema de raíz.

## Últimos cambios (commits)

- `b36d36f` — Fix: usar `RAW` en vez de `USER_ENTERED` al escribir en Google Sheets (el `+`
  de los teléfonos se perdía).
- `57bf2e6` — `api/subscribe.js` también guarda cada suscripción en Google Sheets (además de
  Supabase), vía cuenta de servicio de Google Cloud. Desplegado y probado en producción.
- `a1debab` — `api/subscribe.js` guarda cada suscripción en Supabase (`club_subscribers`)
  antes de mandar el correo; si el correo ya existe, no reenvía y el formulario avisa
  "ya estás registrado". Desplegado y probado en producción.
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
