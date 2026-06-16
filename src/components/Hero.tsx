import { ArrowRight, MapPin, CheckCircle2, Calendar } from "lucide-react";
import { Boxes } from "@/components/ui/background-boxes";

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-[#0f1c40] overflow-hidden flex items-center">
      {/* Animated grid background */}
      <Boxes />

      {/* Readability veils — translucent (not solid) so the animated grid reads as
          one continuous background behind the entire hero. A uniform navy veil keeps
          the grid subtle everywhere; a soft left-anchored radial darkens behind the
          headline/subtext for contrast while leaving the grid visible elsewhere. */}
      <div className="absolute inset-0 z-[1] pointer-events-none bg-[#0f1c40]/45" />
      <div className="absolute inset-0 z-[1] pointer-events-none bg-[radial-gradient(ellipse_60%_70%_at_30%_50%,rgba(15,28,64,0.65),transparent_75%)]" />

      {/* Soft blue glow top-right */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none z-[2]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none z-[2]" />
      {/* Faint center glow behind content */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[400px] bg-blue-400/5 rounded-full blur-3xl pointer-events-none z-[2]" />

      {/* pointer-events-none lets mouse-move pass through empty content areas to the
          grid layer beneath, so the hover effect works across the whole hero.
          Interactive elements below re-enable pointer-events-auto. */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 pt-24 pb-16 lg:pt-28 lg:pb-20 w-full pointer-events-none" style={{ zIndex: 10 }}>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div>
            {/* Halifax badge */}
            <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/25 text-blue-300 text-sm font-medium px-4 py-2 rounded-full mb-8">
              <MapPin size={14} className="shrink-0" />
              Serving Halifax & HRM
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-white leading-[1.12] tracking-tight mb-6">
              Custom websites and lead systems that help your business{" "}
              <span className="text-blue-400">move forward.</span>
            </h1>

            <p className="text-lg text-blue-100/75 leading-[1.75] mb-10 max-w-lg">
              Onward Systems builds custom websites and practical lead systems for local service
              companies across Halifax and HRM.
              <span className="block mt-3">
                From cleaner lead intake and customer communication to AI-assisted admin
                tools, everything is built around your business and how it actually works —
                not a generic template.
              </span>
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <a href="#contact" className="btn-primary text-base px-7 py-3.5 pointer-events-auto">
                Build your custom system
                <ArrowRight size={18} />
              </a>
              <a href="#how-it-works" className="btn-ghost-white text-base px-7 py-3.5 pointer-events-auto">
                See how it works
              </a>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-blue-200/60">
              {[
                "No commitment required",
                "Response within 1–2 business days",
                "Built for service businesses",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right: System dashboard visual */}
          <div className="lg:flex justify-end hidden">
            <HeroDashboard />
          </div>
        </div>

        {/* Mobile dashboard — below copy */}
        <div className="mt-12 lg:hidden">
          <HeroDashboard />
        </div>
      </div>

      {/* Wave divider into next section */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none leading-[0] z-10">
        <svg
          viewBox="0 0 1440 72"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-16 md:h-[72px]"
        >
          <path
            d="M0,48 C240,0 480,72 720,40 C960,8 1200,64 1440,32 L1440,72 L0,72 Z"
            fill="#f8f7f4"
          />
        </svg>
      </div>
    </section>
  );
}

function HeroDashboard() {
  const navItems = [
    { label: "Inbox", badge: 2, active: false },
    { label: "Leads", active: true },
    { label: "Calendar", active: false },
  ];

  const leads = [
    { name: "Lead One", channel: "Website", channelClass: "bg-blue-500/20 text-blue-200", badge: "New", badgeClass: "bg-blue-500/20 text-blue-200" },
    { name: "Lead Two", channel: "Email", channelClass: "bg-amber-500/20 text-amber-200", badge: "Needs response", badgeClass: "bg-orange-500/20 text-orange-200", selected: true },
    { name: "Lead Three", channel: "Facebook", channelClass: "bg-indigo-500/20 text-indigo-200", badge: "New message", badgeClass: "bg-teal-500/20 text-teal-200" },
  ];

  return (
    <div className="w-full max-w-sm mx-auto lg:mx-0 pointer-events-auto">
      {/* Outer card */}
      <div className="bg-white/8 backdrop-blur-md border border-white/15 rounded-2xl p-3.5 shadow-2xl ring-1 ring-white/5">
        {/* Brand bar */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-white/55">Onward Systems</span>
          <span className="flex items-center gap-1.5 text-[11px] text-green-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        </div>

        {/* Mini top nav */}
        <div className="flex items-center gap-1 mb-3 border-b border-white/10 pb-2">
          {navItems.map((item) => (
            <span
              key={item.label}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                item.active ? "bg-white/10 text-white" : "text-white/45"
              }`}
            >
              {item.label}
              {item.badge && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </span>
          ))}
        </div>

        {/* Conversation / lead list */}
        <div className="space-y-1.5 mb-3">
          {leads.map((lead) => (
            <div
              key={lead.name}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
                lead.selected ? "bg-blue-500/20 border border-blue-400/25" : "bg-white/5 border border-white/5"
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{lead.name}</div>
                <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${lead.channelClass}`}>
                  {lead.channel}
                </span>
              </div>
              <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${lead.badgeClass}`}>
                {lead.badge}
              </span>
            </div>
          ))}
        </div>

        {/* Selected lead detail */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white">Lead Two</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200">New</span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-white/40">Urgency</span>
              <span className="text-white/75">Normal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Follow-up</span>
              <span className="text-white/75">Tomorrow</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/40 shrink-0">Notes</span>
              <span className="text-white/75 truncate">Quote requested</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-1.5 bg-blue-500/90 text-white text-xs font-semibold rounded-lg py-1.5">
            <Calendar size={12} />
            Schedule follow-up
          </div>
        </div>
      </div>

      {/* Caption below */}
      <p className="text-center text-xs text-blue-300/50 mt-3">
        Example custom lead dashboard
      </p>
    </div>
  );
}
