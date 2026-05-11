"use client";

import { useState, type FormEvent } from "react";
import { Send, Shield } from "lucide-react";

const serviceOptions = [
  "Website",
  "Lead intake",
  "Automation",
  "Existing site review",
  "Not sure yet",
];

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: Wire up to your preferred form handler (Formspree, Netlify Forms, API route, etc.)
    setSubmitted(true);
  };

  return (
    <section className="section-pad bg-[#0f1c40]" id="contact">
      <div className="container-max">
        <div className="grid lg:grid-cols-2 gap-14 items-start">
          {/* Left: Copy */}
          <div className="lg:pt-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400 mb-4">
              Get in touch
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-5 leading-tight">
              Ready to see where things stand?
            </h2>
            <p className="text-blue-100/70 leading-relaxed mb-8 text-lg">
              Send over your current website, Facebook page, Google listing, or a quick description
              of how you handle leads and jobs. I&rsquo;ll follow up within 1&ndash;2 business days
              with clear notes.
            </p>

            <div className="space-y-3">
              {[
                "No spam. No commitment.",
                "Response within 1–2 business days",
                "Plain language — no jargon",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-blue-200/60 text-sm">
                  <Shield size={14} className="text-blue-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-2xl p-7 md:p-8 shadow-2xl">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path
                      d="M6 14l6 6L22 8"
                      stroke="#16a34a"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#0f1c40] mb-2">Request received.</h3>
                <p className="text-slate-600">
                  I&rsquo;ll be in touch within 1&ndash;2 business days.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-lg font-semibold text-[#0f1c40] mb-5">
                  Request a free systems review
                </h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Your name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label htmlFor="business" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Business name
                    </label>
                    <input
                      id="business"
                      name="business"
                      type="text"
                      required
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                      placeholder="Smith Roofing"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Phone
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                      placeholder="(902) 555-1234"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Website or Facebook page
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                    placeholder="yoursite.ca or facebook.com/yourbusiness"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="businessType" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Business type
                    </label>
                    <input
                      id="businessType"
                      name="businessType"
                      type="text"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                      placeholder="Roofing, HVAC, landscaping…"
                    />
                  </div>
                  <div>
                    <label htmlFor="service" className="block text-sm font-medium text-slate-700 mb-1.5">
                      What do you need help with?
                    </label>
                    <select
                      id="service"
                      name="service"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition bg-white"
                    >
                      <option value="">Select one…</option>
                      {serviceOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Anything else to share?
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition resize-none"
                    placeholder="How do you currently handle leads and bookings? What's the biggest friction point?"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full btn-primary justify-center text-base py-3.5 mt-2"
                >
                  Request a free systems review
                  <Send size={16} />
                </button>

                <p className="text-center text-xs text-slate-400">
                  No spam. No commitment. Response within 1&ndash;2 business days.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
