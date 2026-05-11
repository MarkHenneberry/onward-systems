import { Check, ArrowRight } from "lucide-react";

type PricingTier = {
  name: string;
  price: string;
  priceNote?: string;
  tag?: string;
  tagColor?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
};

const tiers: PricingTier[] = [
  {
    name: "Free Systems Review",
    price: "$0",
    description: "A clear look at where things stand.",
    features: [
      "Online presence gaps identified",
      "Workflow & automation opportunities",
      "Specific next steps",
      "Delivered within 1–2 business days",
    ],
    cta: "Request free review",
    ctaHref: "#contact",
  },
  {
    name: "Website Foundation",
    price: "From $250",
    description: "Custom site that works on every device.",
    features: [
      "Mobile-first design",
      "Contact or quote form included",
      "Google Business setup guidance",
      "You handle hosting: $250 one-time",
      "We handle everything: $100 + $25/mo",
    ],
    cta: "Get started",
    ctaHref: "#contact",
  },
  {
    name: "Workflow Buildout",
    price: "From $500",
    description: "Fix what's leaking time and money.",
    features: [
      "Scoping call",
      "Integration with existing tools",
      "Customer confirmations",
      "Follow-up automations",
      "Handoff or managed setup",
    ],
    cta: "Get started",
    ctaHref: "#contact",
    highlight: true,
    tag: "Most requested",
    tagColor: "blue",
  },
  {
    name: "Systems Package",
    price: "From $1,500",
    description: "Website, intake flow, and automation built together.",
    features: [
      "Custom website",
      "Lead intake system",
      "Tracking setup",
      "Core workflow automation",
      "Scoped to your business",
    ],
    cta: "Get started",
    ctaHref: "#contact",
  },
  {
    name: "Managed Retainer",
    price: "From $300/mo",
    description: "Keep systems running without thinking about it.",
    features: [
      "Workflow monitoring",
      "Updates as needed",
      "Hosting & API costs handled (if applicable)",
      "Monthly check-in",
    ],
    cta: "Learn more",
    ctaHref: "#contact",
  },
];

export default function Pricing() {
  return (
    <section className="section-pad bg-[#f8f7f4]" id="pricing">
      <div className="container-max">
        {/* Header */}
        <div className="max-w-2xl mb-4">
          <p className="section-eyebrow">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0f1c40] mb-4">
            Simple, honest pricing.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            No surprises. No retainers you didn&rsquo;t ask for. Every project is scoped before
            any work begins.
          </p>
        </div>

        {/* Grid */}
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tiers.map((tier) => (
            <PricingCard key={tier.name} tier={tier} />
          ))}
        </div>

        <p className="text-center text-sm text-slate-400 mt-10">
          All projects are scoped before any work begins. Prices are starting points, not maximums.
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
          className={`text-base font-semibold mb-1 ${
            tier.highlight ? "text-white" : "text-[#0f1c40]"
          }`}
        >
          {tier.name}
        </h3>
        <div
          className={`text-3xl font-bold mb-1 ${
            tier.highlight ? "text-white" : "text-[#0f1c40]"
          }`}
        >
          {tier.price}
        </div>
        <p
          className={`text-sm leading-snug ${
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
