import { Check, ArrowRight } from "lucide-react";

type PricingTier = {
  name: string;
  label: string;
  price: string;
  priceSub?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
  tag?: string;
};

const tiers: PricingTier[] = [
  {
    name: "Minimum Package",
    label: "Website Foundation",
    price: "$299 setup",
    priceSub: "+ $29/year for domain",
    description:
      "A simple custom website foundation for local service businesses that need a clean, professional online presence.",
    features: [
      "Custom mobile-friendly website",
      "Contact form",
      "Basic SEO setup",
      "Hosting and maintenance setup",
      "Domain connection support",
      "Built around your business, not a generic template",
    ],
    cta: "Start With Website",
    ctaHref: "#contact",
  },
  {
    name: "Premium System Package",
    label: "Lead & Admin System",
    price: "$299 setup",
    priceSub: "+ $49/month",
    description:
      "A custom lead and admin system built into your website so customer inquiries, follow-ups, scheduling, and messages are easier to manage.",
    features: [
      "Everything in Minimum Package (no extra setup cost)",
      "Backend admin dashboard",
      "Lead handling and status tracking",
      "Calendar and follow-up scheduling",
      "Messaging / inbox integration",
      "Notes and customer history",
      "Built around your actual workflow",
    ],
    cta: "Build Lead System",
    ctaHref: "#contact",
    highlight: true,
    tag: "Most requested",
  },
  {
    name: "Superior System Package",
    label: "Custom AI & Integrations",
    price: "From $749 setup",
    priceSub: "+ $99/month",
    description:
      "A custom system package for businesses that need more automation, AI assistance, or integrations tailored to how they operate.",
    features: [
      "Everything in Premium System Package included",
      "AI-assisted lead handling or follow-up support",
      "Custom workflow automations",
      "Advanced intake and routing",
      "Custom integrations upon request",
      "Built around your business process",
      "Scoped before work begins",
    ],
    cta: "Plan Custom System",
    ctaHref: "#contact",
  },
];

export default function Pricing() {
  return (
    <section className="section-pad bg-[#f8f7f4]" id="pricing">
      <div className="container-max">
        {/* Header */}
        <div className="max-w-2xl mb-12">
          <p className="section-eyebrow">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0f1c40] mb-4">
            Custom systems, honest pricing.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            No surprises. Every project is scoped before any work begins, and each system is
            built around the business and workflow. Monthly fees cover hosting, maintenance,
            monitoring, and ongoing support.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tiers.map((tier) => (
            <PricingCard key={tier.name} tier={tier} />
          ))}
        </div>

        {/* Supporting note */}
        <p className="text-center text-sm text-slate-400 mt-8 max-w-2xl mx-auto leading-relaxed">
          Pricing is based on common starting points for local service businesses. Every setup is
          scoped before work begins, and systems are customized around the business, workflow, and
          level of ongoing support required.
        </p>
      </div>
    </section>
  );
}

function PricingCard({ tier }: { tier: PricingTier }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${
        tier.highlight
          ? "bg-[#0f1c40] text-white shadow-xl ring-2 ring-blue-500/30"
          : "bg-white border border-slate-100 shadow-soft hover:shadow-card"
      }`}
    >
      {tier.tag && (
        <div className="absolute -top-3 left-6">
          <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {tier.tag}
          </span>
        </div>
      )}

      <div className="mb-5">
        <h3
          className={`text-base font-semibold ${
            tier.highlight ? "text-white" : "text-[#0f1c40]"
          }`}
        >
          {tier.name}
        </h3>
        <p
          className={`text-xs font-medium uppercase tracking-widest mb-3 ${
            tier.highlight ? "text-blue-300/80" : "text-blue-600/80"
          }`}
        >
          {tier.label}
        </p>
        <div>
          <span
            className={`text-3xl font-bold ${
              tier.highlight ? "text-white" : "text-[#0f1c40]"
            }`}
          >
            {tier.price}
          </span>
        </div>
        {tier.priceSub && (
          <div
            className={`text-sm mt-0.5 ${
              tier.highlight ? "text-blue-300/70" : "text-slate-400"
            }`}
          >
            {tier.priceSub}
          </div>
        )}
        <p
          className={`text-sm leading-snug mt-3 ${
            tier.highlight ? "text-blue-200/70" : "text-slate-500"
          }`}
        >
          {tier.description}
        </p>
      </div>

      <ul className="space-y-2 flex-1 mb-6">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check
              size={15}
              className={`shrink-0 mt-0.5 ${
                tier.highlight ? "text-blue-400" : "text-blue-600"
              }`}
            />
            <span className={tier.highlight ? "text-blue-100/80" : "text-slate-600"}>
              {f}
            </span>
          </li>
        ))}
      </ul>

      <a
        href={tier.ctaHref}
        className={`inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 ${
          tier.highlight
            ? "bg-blue-500 hover:bg-blue-400 text-white"
            : "border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 hover:bg-blue-50"
        }`}
      >
        {tier.cta}
        <ArrowRight size={15} />
      </a>
    </div>
  );
}
