import { Search, Wrench, TrendingUp } from "lucide-react";

const steps = [
  {
    number: "1",
    icon: Search,
    title: "Free systems review",
    body: "Send over what you have. I look at your online presence and how your operation currently handles leads and jobs — then send back a plain-language breakdown of where things stand.",
  },
  {
    number: "2",
    icon: Wrench,
    title: "Fix the right things first",
    body: "Start with whatever matters most right now: a new website, a cleaner contact flow, or a workflow that stops leads from going cold. No bloated scope, no unnecessary complexity.",
  },
  {
    number: "3",
    icon: TrendingUp,
    title: "Build from there",
    body: "As the business grows, the systems grow with it. More automation, better intake, cleaner tracking — added when the time is right, not forced all at once.",
  },
];

export default function HowItWorks() {
  return (
    <section className="section-pad bg-white" id="how-it-works">
      <div className="container-max">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <p className="section-eyebrow">The process</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#0f1c40] mb-4">
            A simple way to move forward.
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            No long onboarding calls. No surprises. Just a clear look at where things stand
            and a practical path forward.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line — desktop */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-gradient-to-r from-blue-100 via-blue-300 to-blue-100" />

          <div className="grid md:grid-cols-3 gap-10 md:gap-8">
            {steps.map(({ number, icon: Icon, title, body }) => (
              <div key={number} className="relative flex flex-col items-center md:items-start text-center md:text-left">
                {/* Circle with number */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-[#0f1c40] flex items-center justify-center shadow-md">
                    <Icon size={26} className="text-blue-400" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{number}</span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-[#0f1c40] mb-3">{title}</h3>
                <p className="text-slate-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center">
          <h3 className="text-xl font-bold text-[#0f1c40] mb-2">
            Ready to see where things stand?
          </h3>
          <p className="text-slate-600 mb-6">
            The free systems review is the starting point. No commitment, no pitch — just a clear
            picture of what&rsquo;s working and what isn&rsquo;t.
          </p>
          <a href="#contact" className="btn-primary text-base px-8 py-3.5 inline-flex">
            Get a free systems review
          </a>
        </div>
      </div>
    </section>
  );
}
