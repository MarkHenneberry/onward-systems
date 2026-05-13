import { Monitor, ClipboardList, MessageSquare, Settings, ArrowRight } from "lucide-react";

const services = [
  {
    icon: Monitor,
    title: "Custom Website",
    tag: "Foundation",
    body: "A professional site built around your services, service area, and the way customers find you. Fast, mobile-first, and built to turn visitors into quote requests.",
    features: [
      "Service and location pages",
      "Contact and quote form",
      "Google Business setup guidance",
      "Mobile-first, fast loading",
    ],
    href: "#contact",
  },
  {
    icon: ClipboardList,
    title: "Lead Intake System",
    tag: "Intake",
    body: "Quote forms, request flows, email notifications, and customer confirmations all wired together. Every request gets captured and sent where it needs to go.",
    features: [
      "Custom quote & request forms",
      "Auto-confirmations to customers",
      "Lead routing to your inbox",
      "CRM or spreadsheet logging",
    ],
    href: "#contact",
  },
  {
    icon: MessageSquare,
    title: "Lead & Admin System",
    tag: "Operations",
    body: "Practical tools that reduce repetitive admin work, help follow up with leads, and keep customer communication organized. Built around the tools you already use.",
    features: [
      "Scoping call included",
      "Follow-up and reply tools",
      "Integration with existing tools",
      "Handoff or managed setup",
    ],
    href: "#contact",
  },
  {
    icon: Settings,
    title: "Managed Systems",
    tag: "Ongoing",
    body: "Ongoing support, hosting, updates, and monitoring so everything keeps running without you having to think about it.",
    features: [
      "Monitoring and updates",
      "Hosting & third-party costs handled",
      "Changes as your business grows",
      "Monthly check-in",
    ],
    href: "#pricing",
  },
];

export default function Services() {
  return (
    <section className="section-pad bg-[#f8f7f4]" id="services">
      <div className="container-max">
        {/* Header */}
        <div className="max-w-2xl mb-14">
          <p className="section-eyebrow">Services</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0f1c40] mb-4">
            What we build.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Each service is scoped to your operation. We help local service businesses capture
            leads, organize customer communication, reduce repetitive admin, and improve
            day-to-day operations. No jargon, no bloated proposals.
          </p>
        </div>

        {/* Service cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {services.map(({ icon: Icon, title, tag, body, features, href }) => (
            <div
              key={title}
              className="card hover:shadow-card-hover transition-all duration-300 flex flex-col group"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Icon size={22} className="text-blue-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                  {tag}
                </span>
              </div>

              <h3 className="text-xl font-bold text-[#0f1c40] mb-2">{title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-5 flex-1">{body}</p>

              <ul className="space-y-1.5 mb-6">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <ArrowRight size={13} className="text-blue-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={href}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Learn more
                <ArrowRight size={14} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
