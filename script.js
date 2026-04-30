const currentYear = document.querySelector("[data-year]");
if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const contactForm = document.querySelector("[data-contact-form]");
const formStatus = document.querySelector("[data-form-status]");
const submitBtn = document.querySelector("[data-submit-btn]");

// TODO: Replace YOUR_FORM_ID with your Formspree form ID (e.g. "xpwzgkqr").
// Sign up free at https://formspree.io, create a form, and paste the ID here.
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

if (contactForm && formStatus) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const originalLabel = submitBtn ? submitBtn.textContent : null;

    if (submitBtn) {
      submitBtn.textContent = "Sending…";
      submitBtn.disabled = true;
    }

    formStatus.textContent = "";
    formStatus.className = "form-status";

    // Dev mode: Formspree ID not yet configured — show a preview of the success state.
    if (FORMSPREE_ENDPOINT.includes("YOUR_FORM_ID")) {
      setTimeout(() => {
        formStatus.textContent =
          "Form preview — connect Formspree by replacing YOUR_FORM_ID in script.js.";
        formStatus.classList.add("form-status--success");
        if (submitBtn) {
          submitBtn.textContent = originalLabel;
          submitBtn.disabled = false;
        }
      }, 800);
      return;
    }

    try {
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        contactForm.reset();
        formStatus.textContent =
          "Thanks — I'll be in touch within 48 hours.";
        formStatus.classList.add("form-status--success");
      } else {
        formStatus.textContent =
          "Something went wrong. Please try again or email mark@onward-systems.ca directly.";
        formStatus.classList.add("form-status--error");
      }
    } catch {
      formStatus.textContent =
        "Something went wrong. Please try again or email mark@onward-systems.ca directly.";
      formStatus.classList.add("form-status--error");
    } finally {
      if (submitBtn) {
        submitBtn.textContent = originalLabel;
        submitBtn.disabled = false;
      }
    }
  });
}
