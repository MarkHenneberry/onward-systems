"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Services", href: "#services" },
  { label: "Example Systems", href: "#examples" },
  { label: "Pricing", href: "#pricing" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-soft border-b border-slate-100"
    >
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0 bg-transparent border-0 outline-none">
            <Image
              src="/images/logo-transparent.png"
              alt="Onward Systems"
              width={220}
              height={108}
              className="h-11 w-auto bg-transparent border-0 outline-none"
              priority
              style={{ background: "transparent" }}
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center">
            <a href="#contact" className="btn-primary text-sm px-5 py-2.5">
              Free Systems Review
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t bg-white border-slate-100">
          <nav className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="font-medium py-3 px-2 border-b last:border-0 text-slate-700 hover:text-blue-600 border-slate-50 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#contact"
              onClick={() => setMenuOpen(false)}
              className="btn-primary mt-3 justify-center"
            >
              Free Systems Review
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
