import { Monitor, ClipboardList, Zap, ArrowRight } from "lucide-react";

const layers = [
  {
    number: "01",
    icon: Monitor,
    title: "Clear Online Presence",
    subtitle: "Your online home base",
    body: "A clear, mobile-friendly site that explains what you do, where you work, and how customers can reach you. Built around your services and service area, not a generic template.",
    highlights: ["Mobile-first design", "Clear service pages", "Contact & quote forms", "Google Business guidance"],
    color: "blue",
  },
  {
    number: "02",
    icon: ClipboardList,
    title: "Better Lead Capture",
    subtitle: "Capture every opportunity",
    body: "Cleaner quote forms and contact flows that collect the right details from customers and send them where they need to go. No lead falls through a missed message.",
    highlights: ["Quote & request forms", "Email notifications", "Customer confirmations", "Lead routing"],
    color: "indigo",
  },
  {
    number: "03",
    icon: Zap,
    title: "Organized Follow-up",
    subtitle: "Reduce the daily back-and-forth",
    body: "Simple tools that help cut down on missed leads, repetitive replies, and scattered customer communication. Built around how your operation actually runs.",
    highlights: ["Auto-replies & follow-ups", "Lead tracking", "Scheduling triggers", "Inbox organization"],
    color: "violet",
  },
];

const colorMap = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    icon: "text-blue-600",
    number: "text-blue-200",
    tag: "bg-blue-600",
  },
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    icon: "text-indigo-600",
    number: "text-indigo-200",
    tag: "bg-indigo-600",
  },
  violet: {
    bg: "bg-violet-50",
    border: "border-violet-100",
    icon: "text-violet-600",
    number: "text-violet-200",
    tag: "bg-violet-600",
  },
};

export default function Solution() {
  return (
    <section className="section-pad bg-white" id="solution">
      <div className="container-max">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <p className="section-eyebrow">The approach</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0f1c40] mb-4">
            Systems built around how your business actually works.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Every project starts with understanding how your business actually runs. Then we build
            the right piece, or all three, depending on where you are right now.
          </p>
        </div>

        {/* Layers */}
        <div className="grid md:grid-cols-3 gap-8">
          {layers.map((layer) => {
            const colors = colorMap[layer.color as keyof typeof colorMap];
            const Icon = layer.icon;
            return (
              <div key={layer.number} className="relative flex flex-col">
                {/* Number */}
                <div className={`text-7xl font-bold ${colors.number} leading-none mb-4 select-none`}>
                  {layer.number}
                </div>

                <div className={`card flex-1 border-2 ${colors.border}`}>
                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}>
                    <Icon size={20} className={colors.icon} />
                  </div>

                  <div className={`text-xs font-semibold uppercase tracking-widest mb-1 ${colors.icon}`}>
                    {layer.subtitle}
                  </div>
                  <h3 className="text-xl font-bold text-[#0f1c40] mb-3">{layer.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-5">{layer.body}</p>

                  <ul className="space-y-1.5">
                    {layer.highlights.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <ArrowRight size={13} className={colors.icon} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bridge CTA */}
        <div className="mt-14 text-center">
          <a href="#services" className="btn-primary text-base px-8 py-3.5 inline-flex">
            See what's included in each service
            <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}
