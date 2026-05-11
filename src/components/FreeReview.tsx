import { ArrowRight, Search, AlertCircle, Zap, Map } from "lucide-react";

const deliverables = [
  { icon: Search, text: "Where your online presence has gaps" },
  { icon: AlertCircle, text: "Where you might be losing leads without realizing it" },
  { icon: Zap, text: "Where repetitive tasks could be automated" },
  { icon: Map, text: "Clear next steps — no fluff" },
];

export default function FreeReview() {
  return (
    <section className="section-pad bg-[#0f1c40]" id="free-review">
      <div className="container-max">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-400 mb-4">
              Free offer
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-5 leading-tight">
              Not sure where to start?
              <br className="hidden sm:block" />
              I&rsquo;ll take a look for free.
            </h2>
            <p className="text-blue-100/70 text-lg leading-relaxed mb-8">
              Send over your website, Facebook page, Google listing, or a quick description
              of how you currently handle leads and jobs. I&rsquo;ll send back clear notes
              within 1&ndash;2 business days.
            </p>

            <ul className="space-y-3 mb-10">
              {deliverables.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-400/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={15} className="text-blue-400" />
                  </div>
                  <span className="text-blue-100/80 leading-snug pt-1">{text}</span>
                </li>
              ))}
            </ul>

            <p className="text-blue-300/60 text-sm italic mb-8">
              No commitment. No sales pitch. Just a straight answer on where things stand.
            </p>

            <a href="#contact" className="btn-primary text-base px-8 py-3.5 inline-flex">
              Request your free review
              <ArrowRight size={18} />
            </a>
          </div>

          {/* Right: Visual card */}
          <div className="lg:flex justify-center hidden">
            <div className="bg-white/6 backdrop-blur-sm border border-white/10 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/20 flex items-center justify-center">
                  <Search size={18} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">Systems Review</div>
                  <div className="text-blue-300/50 text-xs">Delivered in 1–2 business days</div>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  "Online presence gaps identified",
                  "Lead flow analysis",
                  "Automation opportunities noted",
                  "Specific next steps provided",
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-400/20 flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-white/70 text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-5 border-t border-white/8 text-center">
                <span className="text-2xl font-bold text-white">$0</span>
                <span className="text-blue-300/50 text-sm ml-2">No commitment required</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
