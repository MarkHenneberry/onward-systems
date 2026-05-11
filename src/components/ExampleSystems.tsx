"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, HardHat, Wrench, Building2, ArrowRight, AlertCircle, Monitor } from "lucide-react";

type Example = {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  url: string;
  systems: string[];
  tags: string[];
  color: "amber" | "blue" | "slate";
};

const examples: Example[] = [
  {
    icon: HardHat,
    title: "Roofing Lead System",
    subtitle: "Built for roofing and exterior companies",
    description:
      "Inspection request form, emergency repair CTA, project gallery, storm damage section, service areas, and quote intake.",
    url: "https://roofing-mock.vercel.app/",
    systems: ["Quote intake form", "Emergency repair CTA", "Storm damage landing", "Project gallery", "Service area pages"],
    tags: ["Lead intake", "Quote forms", "Mobile-first", "Service area SEO"],
    color: "amber",
  },
  {
    icon: Wrench,
    title: "HVAC Service Website",
    subtitle: "Built for HVAC and mechanical service companies",
    description:
      "Emergency service CTA, maintenance plan section, service request form, financing section, and lead capture flow.",
    url: "https://hvac-mock.vercel.app/",
    systems: ["Emergency service CTA", "Maintenance plan page", "Service request form", "Financing section", "Lead capture flow"],
    tags: ["Lead intake", "Emergency CTA", "Service requests", "Mobile-first"],
    color: "blue",
  },
  {
    icon: Building2,
    title: "General Contractor Website",
    subtitle: "Built for general contractors and renovation companies",
    description:
      "Project gallery, quote qualification form, service area section, before/after showcase, and trust-building layout.",
    url: "https://general-contractor-mock.vercel.app/",
    systems: ["Project gallery", "Quote qualification form", "Service area section", "Before/after showcase", "Trust-building layout"],
    tags: ["Quote forms", "Project gallery", "Service areas", "Mobile-first"],
    color: "slate",
  },
];

const cardColors = {
  amber: {
    iconBg: "bg-amber-50 border-amber-100",
    icon: "text-amber-600",
    tagBg: "bg-amber-50 border-amber-100 text-amber-700",
    accent: "group-hover:border-amber-200",
    dot: "bg-amber-400",
    gradientFrom: "from-amber-900/40",
    gradientTo: "to-[#0f1c40]",
  },
  blue: {
    iconBg: "bg-blue-50 border-blue-100",
    icon: "text-blue-600",
    tagBg: "bg-blue-50 border-blue-100 text-blue-700",
    accent: "group-hover:border-blue-200",
    dot: "bg-blue-400",
    gradientFrom: "from-blue-900/40",
    gradientTo: "to-[#0f1c40]",
  },
  slate: {
    iconBg: "bg-slate-100 border-slate-200",
    icon: "text-slate-600",
    tagBg: "bg-slate-50 border-slate-200 text-slate-600",
    accent: "group-hover:border-slate-300",
    dot: "bg-slate-400",
    gradientFrom: "from-slate-700/40",
    gradientTo: "to-[#0f1c40]",
  },
};

export default function ExampleSystems() {
  const [active, setActive] = useState<Example | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const close = useCallback(() => setActive(null), []);

  const open = (example: Example) => {
    setIframeError(false);
    setIframeLoaded(false);
    setActive(example);
  };

  // Lock body scroll while modal is open
  useEffect(() => {
    if (active) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [active]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <section className="section-pad bg-white" id="examples">
      <div className="container-max">
        {/* Header */}
        <div className="max-w-2xl mb-14">
          <p className="section-eyebrow">Example systems</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0f1c40] mb-4">
            Built for local service businesses.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Here&rsquo;s what a complete system looks like for a few common business types.
            Click any example to preview the live site.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {examples.map((ex) => {
            const c = cardColors[ex.color];
            const Icon = ex.icon;
            return (
              <div
                key={ex.title}
                className={`group bg-white rounded-2xl border border-slate-100 shadow-soft hover:shadow-card-hover transition-all duration-300 flex flex-col overflow-hidden cursor-pointer hover:-translate-y-1 ${c.accent}`}
                onClick={() => open(ex)}
              >
                {/* Thumbnail */}
                <div className={`relative h-40 bg-gradient-to-br ${c.gradientFrom} ${c.gradientTo} flex flex-col`}>
                  {/* Browser chrome bar */}
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-black/20">
                    <span className="w-2 h-2 rounded-full bg-white/25" />
                    <span className="w-2 h-2 rounded-full bg-white/25" />
                    <span className="w-2 h-2 rounded-full bg-white/25" />
                    <div className="flex-1 mx-2 h-4 bg-white/10 rounded-md flex items-center px-2">
                      <span className="text-[9px] text-white/35 truncate">{ex.url}</span>
                    </div>
                  </div>
                  {/* Icon area */}
                  <div className="flex-1 flex items-center justify-center">
                    <Icon size={36} className="text-white/20" />
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30">
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                      <Monitor size={15} />
                      Preview site
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${c.iconBg}`}>
                      <Icon size={16} className={c.icon} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0f1c40] leading-tight">{ex.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{ex.subtitle}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed mb-4">{ex.description}</p>

                  {/* Systems list */}
                  <div className="flex-1 mb-5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                      Systems included
                    </div>
                    <ul className="space-y-1">
                      {ex.systems.slice(0, 4).map((s) => (
                        <li key={s} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={(e) => { e.stopPropagation(); open(ex); }}
                    className="inline-flex items-center justify-center gap-2 w-full text-sm font-semibold text-blue-600 hover:text-blue-700 border border-blue-100 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 py-2.5 rounded-xl transition-all duration-200"
                  >
                    View example
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {active && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-[#0f1c40]/70 backdrop-blur-sm"
              onClick={close}
            />

            {/* Modal panel */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed inset-x-4 inset-y-4 md:inset-x-6 md:inset-y-6 lg:inset-x-12 lg:inset-y-8 z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100 shrink-0">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-[#0f1c40] leading-tight">{active.title}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{active.subtitle}</p>
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {active.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-medium bg-blue-50 border border-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={close}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0 mt-0.5"
                  aria-label="Close preview"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Iframe area */}
              <div className="flex-1 relative bg-slate-50 min-h-0">
                {!iframeLoaded && !iframeError && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <svg className="animate-spin w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span className="text-sm">Loading preview…</span>
                    </div>
                  </div>
                )}
                {iframeError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 px-6 text-center">
                    <AlertCircle size={36} className="text-slate-300" />
                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Preview unavailable</p>
                      <p className="text-sm text-slate-500">This site can&rsquo;t be embedded in a preview. Use the button below to open it directly.</p>
                    </div>
                  </div>
                ) : (
                  <iframe
                    key={active.url}
                    src={active.url}
                    title={active.title}
                    className="w-full h-full border-0"
                    onLoad={() => setIframeLoaded(true)}
                    onError={() => setIframeError(true)}
                    allow="fullscreen"
                  />
                )}
              </div>

              {/* Modal footer */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
                {/* Systems */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {active.systems.slice(0, 4).map((s) => (
                    <span key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      {s}
                    </span>
                  ))}
                </div>
                {/* Open full site */}
                <a
                  href={active.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 shrink-0 bg-[#0f1c40] hover:bg-[#162444] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors duration-200"
                >
                  Open full site
                  <ExternalLink size={14} />
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
