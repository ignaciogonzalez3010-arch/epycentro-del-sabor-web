document.getElementById("year").textContent = new Date().getFullYear();

const navToggle = document.getElementById("navToggle");
const mainNav = document.getElementById("mainNav");

navToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", isOpen);
});

mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

const clubForm = document.getElementById("clubForm");

if (clubForm) {
  const clubMsg = document.getElementById("clubFormMsg");
  const clubBtn = clubForm.querySelector(".club-submit");
  const clubBtnText = clubForm.querySelector(".club-submit-text");

  clubForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nombre = clubForm.nombre.value.trim();
    const email = clubForm.email.value.trim();
    const telefono = clubForm.telefono.value.trim();

    clubMsg.textContent = "";
    clubMsg.className = "club-form-msg";

    if (!nombre || !email || !telefono) {
      clubMsg.textContent = "Por favor completa todos los campos.";
      clubMsg.classList.add("club-form-msg-error");
      return;
    }

    clubBtn.disabled = true;
    clubBtnText.textContent = "Enviando...";

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, telefono }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error");
      }

      clubMsg.textContent = "¡Listo! Revisa tu correo, te enviamos tu código de descuento.";
      clubMsg.classList.add("club-form-msg-success");
      clubForm.reset();
    } catch (error) {
      clubMsg.textContent = "No pudimos procesar tu registro. Intenta nuevamente o escríbenos por WhatsApp.";
      clubMsg.classList.add("club-form-msg-error");
    } finally {
      clubBtn.disabled = false;
      clubBtnText.textContent = "Quiero mi 10% de descuento";
    }
  });
}
