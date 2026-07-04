import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-6">
        {/* Top Info Bar */}
        <div className="hidden md:flex items-center justify-between text-xs text-gray-600 border-b border-gray-100 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-amber-700 font-semibold">📍</span>
              <span>Rubber Park @ KLCC • Kampung Baru, KL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-700 font-semibold">⏰</span>
              <span>Open Daily: 11:00 AM – 11:00 PM</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://share.google/FuUQcoGAe3SJJBGbm"
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-700 transition-colors"
            >
              Google Business
            </a>
            <span className="text-gray-300">|</span>
            <a
              href="mailto:hello@gembiramomento.my"
              className="hover:text-amber-700 transition-colors"
            >
              Email
            </a>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex flex-col items-start gap-0">
            <div className="text-2xl font-bold text-slate-900">Gembira</div>
            <div className="text-xs font-semibold text-amber-700 tracking-wider">
              MOMENTO
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link
              href="#curation"
              className="text-gray-700 hover:text-amber-700 transition-colors"
            >
              The Curation
            </Link>
            <Link
              href="/about"
              className="text-gray-700 hover:text-amber-700 transition-colors"
            >
              Our Story
            </Link>
            <Link
              href="/contact"
              className="text-gray-700 hover:text-amber-700 transition-colors"
            >
              Corporate Gifting
            </Link>
            <Link
              href="#"
              className="text-gray-700 hover:text-amber-700 transition-colors"
            >
              Find Us
            </Link>
          </nav>

          {/* Right CTA - Dashboard Access */}
          <div className="flex items-center gap-4">
            <a
              href="https://share.google/FuUQcoGAe3SJJBGbm"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-full transition-colors duration-200 text-sm"
            >
              Plan Your Visit
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-slate-900 text-2xl">☰</button>
        </div>
      </div>
    </header>
  );
}
