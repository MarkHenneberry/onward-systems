import { ArrowRight, MapPin, CheckCircle2 } from "lucide-react";
import { Boxes } from "@/components/ui/background-boxes";

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-[#0f1c40] overflow-hidden flex items-center">
      {/* Animated grid background */}
      <Boxes />

      {/* Radial gradient mask — fades boxes toward centre so text stays readable */}
      <div className="absolute inset-0 z-[1] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,transparent_30%,black_100%)] bg-[#0f1c40] pointer-events-none" />

      {/* Soft blue glow top-right */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none z-[2]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/8 rounded-full blur-3xl pointer-events-none z-[2]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 pt-24 pb-16 lg:pt-28 lg:pb-20 w-full" style={{ zIndex: 10 }}>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div>
            {/* Halifax badge */}
            <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/25 text-blue-300 text-sm font-medium px-4 py-2 rounded-full mb-8">
              <MapPin size={14} className="shrink-0" />
              Serving Halifax & HRM
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-white leading-[1.12] tracking-tight mb-6">
              Simple systems that help your business{" "}
              <span className="text-blue-400">move forward.</span>
            </h1>

            <p className="text-lg text-blue-100/75 leading-relaxed mb-10 max-w-lg">
              Onward Systems builds custom websites, lead intake systems, and practical
              automations for local service businesses across Halifax and HRM&mdash;so the
              online side of your operation runs the way the rest of it does.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <a href="#contact" className="btn-primary text-base px-7 py-3.5">
                Get a free systems review
                <ArrowRight size={18} />
              </a>
              <a href="#how-it-works" className="btn-ghost-white text-base px-7 py-3.5">
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
  return (
    <div className="w-full max-w-sm mx-auto lg:mx-0">
      {/* Outer card */}
      <div className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-4 shadow-2xl">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">Lead System</span>
          <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Active
          </span>
        </div>

        {/* Activity feed */}
        <div className="space-y-2.5 mb-4">
          {[
            { icon: "🟢", label: "New lead received", time: "just now", bold: true },
            { icon: "✉️", label: "Auto-reply sent", time: "just now" },
            { icon: "📋", label: "Lead logged", time: "just now" },
            { icon: "📅", label: "Follow-up scheduled", time: "just now" },
          ].map((item, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 ${
                i === 0
                  ? "bg-blue-500/20 border border-blue-400/20"
                  : "bg-white/5 border border-white/5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base leading-none">{item.icon}</span>
                <span
                  className={`text-sm ${
                    item.bold ? "text-white font-semibold" : "text-white/70"
                  }`}
                >
                  {item.label}
                </span>
              </div>
              <span className="text-xs text-white/35">{item.time}</span>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "24", label: "Leads this month" },
            { value: "18", label: "Quotes sent" },
            { value: "11", label: "Jobs booked" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/5 border border-white/8 rounded-xl p-3 text-center"
            >
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-[10px] text-white/45 mt-0.5 leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating label below */}
      <p className="text-center text-xs text-blue-300/50 mt-3">
        Example lead intake dashboard
      </p>
    </div>
  );
}
