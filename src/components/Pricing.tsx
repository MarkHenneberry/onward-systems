import { Check, ArrowRight } from "lucide-react";

type PricingTier = {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
  tag?: string;
};

const tiers: PricingTier[] = [
  {
    name: "Free Review",
    price: "$0",
    description: "A clear look at where things stand.",
    features: [
      "Online presence gaps identified",
      "Lead and follow-up issues noted",
      "Practical next steps",
      "Delivered within 1–2 business days",
    ],
    cta: "Request free review",
    ctaHref: "#contact",
  },
  {
    name: "Website Foundation",
    price: "From $250",
    description: "A professional site built for your trade.",
    features: [
      "Mobile-first design",
      "Contact or quote form included",
      "Google Business setup guidance",
      "Self-hosted: $250 one-time",
      "Fully managed: $100 + $25/mo",
    ],
    cta: "Get started",
    ctaHref: "#contact",
  },
  {
    name: "Lead & Admin System",
    price: "From $500",
    description: "Fix what's leaking leads and time.",
    features: [
      "Scoping call included",
      "Quote forms and lead routing",
      "Customer confirmations",
      "Follow-up tools",
      "Handoff or managed setup",
    ],
    cta: "Get started",
    ctaHref: "#contact",
    highlight: true,
    tag: "Most requested",
  },
  {
    name: "Full Systems Package",
    price: "From $1,500",
    description: "Website, intake, and operations built together.",
    features: [
      "Custom website",
      "Lead intake setup",
      "Customer communication tools",
      "Core admin tooling",
      "Scoped to your business",
    ],
    cta: "Get started",
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
            No surprises. No retainers you didn&rsquo;t ask for. Every project is scoped
            before any work begins.
          </p>
        </div>

        {/* Grid */}
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {tiers.map((tier) => (
            <PricingCard key={tier.name} tier={tier} />
          ))}
        </div>

        {/* Managed Retainer — secondary/optional */}
        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-100 rounded-2xl px-6 py-4">
          <div>
            <span className="text-sm font-semibold text-[#0f1c40]">Managed Retainer</span>
            <span className="text-slate-400 text-sm mx-2">&middot;</span>
            <span className="text-sm text-slate-500">From $300/mo</span>
            <p className="text-xs text-slate-400 mt-0.5">
              Hosting, monitoring, updates, and a monthly check-in so everything keeps running.
            </p>
          </div>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors shrink-0"
          >
            Ask about this
            <ArrowRight size={13} />
          </a>
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
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
