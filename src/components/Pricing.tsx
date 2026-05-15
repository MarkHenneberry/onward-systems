import { Check, ArrowRight } from "lucide-react";

type PricingTier = {
  name: string;
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
    name: "Free Systems Review",
    price: "$0",
    description: "A clear look at where things stand.",
    features: [
      "Online presence gaps identified",
      "Lead and follow-up issues noted",
      "Practical next steps",
      "Delivered within 1 to 2 business days",
    ],
    cta: "Request Free Review",
    ctaHref: "#contact",
  },
  {
    name: "Website Foundation",
    price: "$99",
    priceSub: "setup + $10/mo",
    description: "A simple online presence for local service businesses.",
    features: [
      "Mobile-friendly website",
      "Hosting and maintenance",
      "Contact form",
      "Basic SEO setup",
      "Domain connection support",
    ],
    cta: "Start With Website",
    ctaHref: "#contact",
  },
  {
    name: "Lead & Admin System",
    price: "$199",
    priceSub: "setup + $50/mo",
    description: "Lead handling and customer communication built into your website.",
    features: [
      "Everything in Website Foundation",
      "Lead storage system",
      "Email notifications",
      "Customer auto-replies",
      "Urgency tagging",
      "Simple admin organization",
    ],
    cta: "Build Lead System",
    ctaHref: "#contact",
    highlight: true,
    tag: "Most requested",
  },
  {
    name: "Full Systems Package",
    price: "From $499",
    priceSub: "setup + $75/mo",
    description: "Custom systems built around how your business actually operates.",
    features: [
      "Custom website structure",
      "Advanced intake and workflow setup",
      "Operational organization tools",
      "Customer communication systems",
      "AI-assisted follow-ups and lead handling",
      "Scoped automations tailored to your business",
    ],
    cta: "Plan Full System",
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
            Simple, honest pricing.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            No surprises. Every project is scoped before any work begins. Monthly fees cover
            hosting, maintenance, monitoring, and ongoing system support.
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {tiers.map((tier) => (
            <PricingCard key={tier.name} tier={tier} />
          ))}
        </div>

        {/* Supporting note */}
        <p className="text-center text-sm text-slate-400 mt-8 max-w-2xl mx-auto leading-relaxed">
          All pricing reflects common starting points for local service businesses. Final scope
          depends on the business, the systems needed, and how much ongoing support is required.
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
          className={`text-base font-semibold mb-2 ${
            tier.highlight ? "text-white" : "text-[#0f1c40]"
          }`}
        >
          {tier.name}
        </h3>
        <div className="mb-1">
          <span
            className={`text-3xl font-bold ${
              tier.highlight ? "text-white" : "text-[#0f1c40]"
            }`}
          >
            {tier.price}
          </span>
          {tier.priceSub && (
            <span
              className={`text-sm ml-1.5 ${
                tier.highlight ? "text-blue-300/70" : "text-slate-400"
              }`}
            >
              {tier.priceSub}
            </span>
          )}
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
