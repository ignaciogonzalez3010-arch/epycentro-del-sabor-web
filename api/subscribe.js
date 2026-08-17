const DISCOUNT_CODE = "BIENVENIDA10";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!RESEND_API_KEY) {
    console.error("Falta configurar la variable de entorno RESEND_API_KEY");
    return res.status(500).json({ error: "Error de configuración del servidor" });
  }

  const safeNombre = String(nombre).trim().slice(0, 100);

  try {
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
