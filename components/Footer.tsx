import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-slate-900 text-white">
      {/* Main Footer Content */}
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand Section */}
          <div className="space-y-6">
            <div>
              <div className="text-2xl font-bold">Gembira</div>
              <div className="text-xs font-semibold text-amber-400 tracking-wider">
                MOMENTO
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Your Malaysian souvenir boutique in the heart of Kuala Lumpur.
              Curating joy since 2024.
            </p>
            <div className="flex gap-4 pt-4">
              <a
                href="https://maps.app.goo.gl/5vWdi4qrUgKq91ff7"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-amber-700 hover:bg-amber-600 flex items-center justify-center transition-colors text-lg"
              >
                🌐
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-amber-700 hover:bg-amber-600 flex items-center justify-center transition-colors text-lg"
              >
                📷
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Quick Links</h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <Link
                  href="#curation"
                  className="hover:text-amber-400 transition-colors"
                >
                  The Curation
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-amber-400 transition-colors"
                >
                  Our Story
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-amber-400 transition-colors"
                >
                  Corporate Gifting
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="hover:text-amber-400 transition-colors"
                >
                  Management Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Store Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Store Info</h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="text-amber-400">📍</span>
                <span>
                  Rubber Park @ KLCC
                  <br />
                  No. 3, 148, Jln Ampang
                  <br />
                  Kampung Baru, 50450 KL
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400">⏰</span>
                <span>
                  Weekdays: 1:00 PM – 11:00 PM
                  <br />
                  Weekends: 11:00 AM – 11:00 PM
                </span>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Contact</h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <a
                  href="mailto:gembiraceo@gmail.com"
                  className="hover:text-amber-400 transition-colors"
                >
                  📧 gembiraceo@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="tel:+60123883538"
                  className="hover:text-amber-400 transition-colors"
                >
                  📱 +6012-388 3538
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
            <div>
              © {new Date().getFullYear()} Gembira Momento. All Rights Reserved.
            </div>
            <div className="md:text-right space-x-4">
              <Link href="#" className="hover:text-amber-400 transition-colors">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link href="#" className="hover:text-amber-400 transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
