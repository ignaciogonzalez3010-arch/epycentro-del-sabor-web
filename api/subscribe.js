const crypto = require("crypto");

const DISCOUNT_CODE = "BIENVENIDA10";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { nombre, email, telefono } = req.body || {};

  if (!nombre || !email || !telefono) {
    return res.status(400).json({ error: "Nombre, correo y teléfono son requeridos" });
  }

  if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "Correo electrónico inválido" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Epycentro del Sabor <onboarding@resend.dev>";
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!RESEND_API_KEY) {
    console.error("Falta configurar la variable de entorno RESEND_API_KEY");
    return res.status(500).json({ error: "Error de configuración del servidor" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Error de configuración del servidor" });
  }

  const safeNombre = String(nombre).trim().slice(0, 100);
  const safeTelefono = String(telefono).trim().slice(0, 30);

  try {
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/club_subscribers`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ nombre: safeNombre, email, telefono: safeTelefono }),
    });

    if (insertResponse.status === 409) {
      return res.status(200).json({ ok: true, yaRegistrado: true });
    }

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      console.error("Error al guardar en Supabase:", errorText);
      return res.status(502).json({ error: "No se pudo procesar tu registro" });
    }

    try {
      await appendToGoogleSheet(safeNombre, email, safeTelefono);
    } catch (sheetError) {
      console.error("Error al guardar en Google Sheets (no bloqueante):", sheetError);
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: "¡Bienvenido/a al Club Epycentro! Tu 10% de descuento",
        html: buildWelcomeEmailHtml(safeNombre),
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Error de Resend:", errorText);
      return res.status(502).json({ error: "No se pudo enviar el correo de bienvenida" });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error al procesar la suscripción al Club Epycentro:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getGoogleAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Falta configurar GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const assertion = `${unsigned}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`No se pudo obtener token de Google: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function appendToGoogleSheet(nombre, email, telefono) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Falta configurar GOOGLE_SHEETS_SPREADSHEET_ID");
  }

  const accessToken = await getGoogleAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:D:append?valueInputOption=RAW`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [[nombre, email, telefono, new Date().toISOString()]],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al escribir en Google Sheets: ${errorText}`);
  }
}

function buildWelcomeEmailHtml(nombre) {
  const saludo = nombre ? `¡Hola ${nombre}!` : "¡Hola!";

  return `
  <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #fafaf8;">
    <div style="background: #0a0a0a; padding: 28px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 1.4rem;">Epycentro del <span style="color: #ea580c;">Sabor</span></h1>
    </div>
    <div style="padding: 32px 28px; background: #ffffff;">
      <h2 style="color: #0a0a0a; margin-top: 0;">${saludo} 🎉</h2>
      <p style="color: #4b5563; line-height: 1.6;">
        Ya eres parte del <strong>Club Epycentro</strong>. Como bienvenida, tienes un
        <strong>10% de descuento</strong> en tu próximo pedido.
      </p>
      <div style="background: #fff4ed; border: 2px dashed #ea580c; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 6px; color: #4b5563; font-size: 0.85rem;">Tu código de descuento</p>
        <p style="margin: 0; color: #ea580c; font-size: 1.6rem; font-weight: 800; letter-spacing: 2px;">${DISCOUNT_CODE}</p>
      </div>
      <p style="color: #4b5563; line-height: 1.6;">
        Menciona este código al pedir por WhatsApp o Pedifast para aplicar tu descuento.
      </p>
      <div style="text-align: center; margin-top: 28px;">
        <a href="https://pedifast.app/epycentro-del-sabor" style="background: #ea580c; color: #ffffff; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: 800; display: inline-block;">
          Pedir ahora
        </a>
      </div>
    </div>
    <div style="padding: 20px 28px; text-align: center; color: #8a8580; font-size: 0.8rem;">
      Circunvalación 80, Viña del Mar, Chile
    </div>
  </div>`;
}
