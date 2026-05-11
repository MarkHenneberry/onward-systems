import Image from "next/image";
import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";

const navLinks = [
  { label: "Services", href: "#services" },
  { label: "Example Systems", href: "#examples" },
  { label: "Pricing", href: "#pricing" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export default function Footer() {
  return (
    <footer className="bg-[#0a1530] text-white">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-14">
        <div className="grid md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <Image
              src="/images/logo-transparent.png"
              alt="Onward Systems"
              width={200}
              height={98}
              className="h-10 w-auto mb-4"
            />
            <p className="text-blue-200/60 text-sm leading-relaxed mb-5">
              Simple systems that help your business move forward.
            </p>
            <p className="text-blue-200/45 text-xs leading-relaxed">
              Serving Halifax, Dartmouth, Bedford, Sackville, Cole Harbour,
              and surrounding HRM communities.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-400/70 mb-4">
              Navigation
            </div>
            <nav className="space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block text-sm text-blue-200/60 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Contact */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-blue-400/70 mb-4">
              Contact
            </div>
            <div className="space-y-3">
              <a
                href="tel:+19027189304"
                className="flex items-center gap-2.5 text-sm text-blue-200/60 hover:text-white transition-colors"
              >
                <Phone size={14} className="text-blue-400 shrink-0" />
                902-718-9304
              </a>
              <a
                href="mailto:markhenneberry@outlook.com"
                className="flex items-center gap-2.5 text-sm text-blue-200/60 hover:text-white transition-colors"
              >
                <Mail size={14} className="text-blue-400 shrink-0" />
                markhenneberry@outlook.com
              </a>
              <div className="flex items-center gap-2.5 text-sm text-blue-200/60">
                <MapPin size={14} className="text-blue-400 shrink-0" />
                Halifax, NS
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/8 pt-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-blue-200/40 text-xs">
            &copy; {new Date().getFullYear()} Onward Systems. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/privacy"
              className="text-xs text-blue-200/40 hover:text-blue-200/70 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-xs text-blue-200/40 hover:text-blue-200/70 transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
