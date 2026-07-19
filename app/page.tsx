"use client";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const greetings = [
    { text: "Selamat Datang", color: "text-amber-700" },
    { text: "Hello", color: "text-amber-700" },
    { text: "你好", color: "text-amber-700" },
    { text: "أهلاً وسهلاً", color: "text-amber-700" },
    { text: "Sawatdee", color: "text-amber-700" },
    { text: "Konnichiwa", color: "text-amber-700" },
  ];

  const pillars = [
    {
      icon: "🎨",
      number: "01",
      title: "For the Art Collectors",
      description:
        "Curated enamel pins, postcards, notebooks, and magnets by local creators like Mariari, inspired by Malaysian food, places, and daily life.",
    },
    {
      icon: "👜",
      number: "02",
      title: "For the Lifestyle Explorers",
      description:
        "Travel-friendly lifestyle picks including TaleSocks, handcrafted bags, leather card holders, and practical everyday accessories.",
    },
    {
      icon: "🏮",
      number: "03",
      title: "For the Tradition Seekers",
      description:
        "Malaysian heritage pieces from hand-painted Tiffin Jeiwa carriers to traditional décor and keepsakes rooted in local craftsmanship.",
    },
  ];

  const bestsellers = [
    {
      name: "Tiffin Jeiwa Collection",
      description:
        "Hand-painted tiffin carriers, mugs, and gift pieces that celebrate Malaysian heritage with artisan detail.",
      tag: "Heritage Favorite",
    },
    {
      name: "TaleSocks",
      description:
        "Breathable, premium socks with Malaysian-inspired designs made for comfort in a tropical climate.",
      tag: "Traveler's Favorite",
    },
    {
      name: "Mariari Gifts & Stationery",
      description:
        "Enamel pins, fragrance, notebooks, postcards, and magnets that turn everyday Malaysian icons into meaningful keepsakes.",
      tag: "Curated Pick",
    },
  ];

  return (
    <div className="flex flex-col bg-white">
      {/* ========== Hero Section ========== */}
      <section className="relative w-full h-screen min-h-160 flex items-center overflow-hidden">
        {/* Background image */}
        <Image
          src="/GM Front Image.webp"
          alt="Gembira Momento storefront"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Dark gradient overlay for contrast + subtle amber warmth */}
        <div className="absolute inset-0 bg-linear-to-r from-slate-950/90 via-slate-950/60 to-slate-950/20"></div>
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/80 via-transparent to-transparent"></div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
          <div className="max-w-2xl space-y-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-300/30 text-amber-300 text-xs font-semibold tracking-wide uppercase backdrop-blur-sm">
              ✦ Rubber Park @ KLCC, Kuala Lumpur
            </span>

            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight text-balance">
              Take a Happy Moment Home.
            </h1>

            <p className="text-lg md:text-2xl text-gray-200 leading-relaxed">
              Your Premium One-Stop Malaysian Souvenir Boutique, right in the
              heart of Kuala Lumpur.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="#curation">
                <button className="w-full sm:w-auto px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full font-semibold text-lg shadow-lg shadow-amber-900/30 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5">
                  Explore Our Curation
                </button>
              </Link>
              <a
                href="https://maps.app.goo.gl/5vWdi4qrUgKq91ff7"
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="w-full sm:w-auto px-8 py-4 border-2 border-white/40 text-white hover:bg-white/10 rounded-full font-semibold text-lg backdrop-blur-sm transition-all duration-200">
                  Get Directions
                </button>
              </a>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-xs tracking-widest uppercase animate-bounce">
          ↓ Scroll
        </div>
      </section>

      {/* ========== Multilingual Welcome Gateway ========== */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-14 text-center">
            {greetings.map((greeting, idx) => (
              <div
                key={idx}
                className={`text-base font-medium ${greeting.color} opacity-50 hover:opacity-100 transition-opacity`}
              >
                {greeting.text}
              </div>
            ))}
          </div>

          <div className="relative rounded-2xl bg-amber-50/60 border border-amber-100 py-16 px-8 md:px-16 space-y-6 text-center">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-5xl">
              ❝
            </span>
            <p className="text-xl md:text-2xl text-slate-900 font-semibold leading-relaxed">
              Step out of the bustling streets of KL and into a sanctuary
              curated for the global traveler.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
              Traditional souvenir stalls can feel loud and chaotic. At Gembira
              Momento, we invite you to browse comfortably in a contemporary,
              gallery-inspired space where Malaysian heritage meets modern
              elegance.
            </p>
          </div>
        </div>
      </section>

      {/* ========== The Curated Pillars (Product Grid) ========== */}
      <section id="curation" className="py-28 px-6 bg-amber-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-amber-700 font-semibold text-sm uppercase tracking-widest">
              The Curation
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-3 mb-6">
              Crafted for Every Traveler
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Thoughtfully selected collections for every traveler.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pillars.map((pillar, idx) => (
              <div
                key={idx}
                className="group cursor-pointer transition-all duration-300 hover:-translate-y-1 p-8 bg-white rounded-2xl shadow-sm hover:shadow-xl border border-amber-100"
              >
                <div className="w-16 h-16 flex items-center justify-center rounded-xl bg-amber-100 text-4xl mb-6 group-hover:bg-amber-200 transition-colors">
                  {pillar.icon}
                </div>
                <div className="text-xs font-bold text-amber-700 mb-2 tracking-widest">
                  {pillar.number}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {pillar.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== Social Proof / Bestsellers ========== */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-amber-700 font-semibold text-sm uppercase tracking-widest">
              Fan Favorites
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-3 mb-6">
              What Travelers Are Loving Right Now
            </h2>
            <p className="text-lg text-gray-600">
              Discover our current bestsellers and customer favorites.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {bestsellers.map((item, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl p-8 bg-linear-to-b from-white to-amber-50/50 border border-gray-200 hover:border-amber-400 hover:shadow-lg transition-all duration-200"
              >
                <div className="inline-block px-4 py-1.5 bg-amber-700 text-white text-xs font-bold rounded-full mb-6">
                  {item.tag}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {item.name}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== Gembira Corporate Bridge ========== */}
      <section className="py-28 px-6 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <p className="text-amber-400 font-semibold text-sm uppercase tracking-widest mb-3">
                  The B2B Bridge
                </p>
                <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                  Elevate Your Corporate Gifting
                </h2>
              </div>

              <p className="text-xl text-gray-300 leading-relaxed">
                Premium Malaysian Curation for VIPs, Events, & International
                Guests.
              </p>

              <p className="text-gray-400 leading-relaxed">
                Moving away from generic, mass-produced merchandise, Gembira
                Corporate crafts custom corporate gift packages. We bundle our
                signature local treats, artisanal goods, and custom artwork into
                elegant, minimalist wooden gift boxes that leave a lasting
                impression.
              </p>

              <div>
                <Link href="/contact">
                  <button className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full font-semibold text-lg shadow-lg shadow-amber-900/30 transition-all duration-200 hover:-translate-y-0.5">
                    Download Digital Premium Catalog
                  </button>
                </Link>
              </div>
            </div>

            <div className="bg-linear-to-br from-amber-800 to-amber-600 rounded-2xl p-10 md:p-12 text-white shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest mb-6 text-amber-100">
                Corporate Packages Include
              </p>
              <ul className="space-y-5 text-gray-50">
                <li className="flex items-start gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm">
                    ✓
                  </span>
                  <span>Signature Malaysian delicacies & artisanal goods</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm">
                    ✓
                  </span>
                  <span>Custom artwork & personalization options</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm">
                    ✓
                  </span>
                  <span>Elegant wooden gift boxes with branding</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-none w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm">
                    ✓
                  </span>
                  <span>Volume discounts for bulk orders</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Info & CTA Section ========== */}
      <section className="py-28 px-6 bg-amber-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <span className="text-amber-700 font-semibold text-sm uppercase tracking-widest">
                  Visit Us
                </span>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-3">
                  Plan Your Visit
                </h2>
              </div>

              <div className="space-y-6 bg-white rounded-2xl p-8 shadow-sm border border-amber-100">
                <div className="flex gap-4">
                  <span className="flex-none w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg">
                    ⏰
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                      Hours of Operation
                    </p>
                    <p className="text-lg text-gray-900 mt-1">
                      Weekdays: 1:00 PM – 11:00 PM
                      <br />
                      Weekends: 11:00 AM – 11:00 PM
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <span className="flex-none w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg">
                    📍
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                      Location
                    </p>
                    <p className="text-lg text-gray-900 mt-1 font-semibold">
                      Rubber Park @ KLCC
                    </p>
                    <p className="text-base text-gray-600 mt-0.5">
                      No. 3, 148, Jln Ampang, Kampung Baru, 50450 Kuala Lumpur
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/contact">
                  <button className="w-full sm:w-auto px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white rounded-full font-semibold text-lg shadow-md transition-all duration-200 hover:-translate-y-0.5">
                    Get in Touch
                  </button>
                </Link>
                <a
                  href="https://maps.app.goo.gl/5vWdi4qrUgKq91ff7"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <button className="w-full sm:w-auto px-8 py-4 border-2 border-amber-700 text-amber-700 hover:bg-amber-100 rounded-full font-semibold text-lg transition-colors duration-200">
                    Get Directions
                  </button>
                </a>
              </div>
            </div>

            <div className="w-full h-96 rounded-2xl overflow-hidden shadow-xl border-4 border-white">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3984.6920508831!2d101.71327!3d3.157396!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31cc33e4b2e0e0e5%3A0x8c3c3c3c3c3c3c3c!2sSuria%20KLCC%2C%20Kuala%20Lumpur!5e0!3m2!1sen!2smy!4v1234567890"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
