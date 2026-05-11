import Image from "next/image";
import { Phone, Mail, MapPin, Check } from "lucide-react";

const bullets = [
  "Built for service businesses",
  "No jargon, no fluff",
  "Local to Halifax/HRM",
  "Practical systems, not vague marketing",
];

export default function About() {
  return (
    <section className="section-pad bg-[#f8f7f4]" id="about">
      <div className="container-max">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Left: Photo */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative">
              <div className="w-72 h-80 md:w-80 md:h-96 rounded-2xl overflow-hidden shadow-card">
                <Image
                  src="/images/headshot.png"
                  alt="Mark Henneberry, Founder of Onward Systems"
                  width={320}
                  height={384}
                  className="w-full h-full object-cover object-top"
                  priority
                />
              </div>
              {/* Name card overlay */}
              <div className="absolute -bottom-5 -right-5 bg-white border border-slate-100 rounded-xl px-5 py-3.5 shadow-card">
                <div className="font-semibold text-[#0f1c40]">Mark Henneberry</div>
                <div className="text-sm text-slate-500">Founder, Onward Systems</div>
              </div>
            </div>
          </div>

          {/* Right: Copy */}
          <div>
            <p className="section-eyebrow">About</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#0f1c40] mb-5 leading-tight">
              Local, practical, and focused on systems that keep work moving.
            </h2>

            <p className="text-slate-600 leading-relaxed mb-4">
              I started Onward Systems to help local service businesses in Halifax and HRM improve
              the practical systems that keep their operation running: websites, contact flows, lead
              tracking, and automation that cuts repetitive admin work.
            </p>
            <p className="text-slate-600 leading-relaxed mb-8">
              The work is custom-built, not templated. Every system is built around how your business
              actually works, not a generic version of it. Everything is explained in plain language
              with no unnecessary complexity.
            </p>

            {/* Feature bullets */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-8">
              {bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-slate-700 text-sm">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-blue-600" />
                  </div>
                  {b}
                </li>
              ))}
            </ul>

            {/* Contact info */}
            <div className="space-y-2.5">
              <a
                href="tel:+19027189304"
                className="flex items-center gap-3 text-slate-600 hover:text-blue-600 transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Phone size={15} className="text-blue-600" />
                </div>
                <span className="text-sm font-medium">902-718-9304</span>
              </a>
              <a
                href="mailto:markhenneberry@outlook.com"
                className="flex items-center gap-3 text-slate-600 hover:text-blue-600 transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Mail size={15} className="text-blue-600" />
                </div>
                <span className="text-sm font-medium">markhenneberry@outlook.com</span>
              </a>
              <div className="flex items-center gap-3 text-slate-600">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <MapPin size={15} className="text-blue-600" />
                </div>
                <span className="text-sm font-medium">Halifax, Nova Scotia</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
