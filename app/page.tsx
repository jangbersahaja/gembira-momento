"use client";

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [activeLanguage, setActiveLanguage] = useState("en");

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
      icon: "🍫",
      number: "01",
      title: "For the Food Lovers",
      description:
        "Authentic, rich heritage tastes. Bold local durian treats, artisanal chocolates, and smooth, comforting traditional white coffee.",
    },
    {
      icon: "🎨",
      number: "02",
      title: "For the Art Collectors",
      description:
        "Custom-designed postcards, notebooks, and intricate 3D skyline memorabilia illustrating the soul of KL's landscape.",
    },
    {
      icon: "👜",
      number: "03",
      title: "For the Lifestyle Explorers",
      description:
        "Premium, locally inspired accessories and contemporary textiles in partnership with independent Malaysian creators.",
    },
  ];

  const bestsellers = [
    {
      name: "Aesthetic KL KLCC Acrylic Magnets",
      description: "Premium custom illustrations you cannot buy at traditional flea markets.",
      tag: "Bestseller Bundle - 5 for RM 50",
    },
    {
      name: "Artisanal Durian Chocolate Bars",
      description: "A luxurious sweet treat celebrating the king of tropical fruits.",
      tag: "Premium Selection",
    },
    {
      name: "Hand-Drawn Landmark Postcards",
      description: "Thick, texture-rich matte prints perfect for mailing across oceans.",
      tag: "Traveler's Favorite",
    },
  ];

  return (
    <div className="flex flex-col bg-white">
      {/* ========== Hero Section ========== */}
      <section className="relative w-full h-screen flex items-center justify-center overflow-hidden bg-linear-to-b from-amber-50 via-white to-white">
        {/* Background image placeholder with overlay */}
        <div className="absolute inset-0 bg-cover bg-center opacity-20" 
             style={{backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1200 800%22%3E%3Crect fill=%22%238C6239%22 width=%221200%22 height=%22800%22/%3E%3C/svg%3E)'"}}>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
          <h1 className="text-6xl md:text-7xl font-bold text-slate-900 leading-tight">
            Take a Happy Moment Home.
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
            Your Premium One-Stop Malaysian Souvenir Boutique, right in the heart of Kuala Lumpur.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link href="#curation">
              <button className="px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white rounded-full font-semibold text-lg transition-colors duration-200">
                Explore Our Curation
              </button>
            </Link>
            <a href="https://maps.app.goo.gl/suria-klcc" target="_blank" rel="noopener noreferrer">
              <button className="px-8 py-4 border-2 border-amber-700 text-amber-700 hover:bg-amber-50 rounded-full font-semibold text-lg transition-colors duration-200">
                Get Directions (KLCC)
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* ========== Multilingual Welcome Gateway ========== */}
      <section className="py-32 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-12 text-center">
            {greetings.map((greeting, idx) => (
              <div key={idx} className={`text-sm font-light ${greeting.color} opacity-40 hover:opacity-100 transition-opacity`}>
                {greeting.text}
              </div>
            ))}
          </div>

          <div className="border-t border-b border-gray-200 py-16 space-y-6">
            <p className="text-xl text-gray-900 font-semibold leading-relaxed">
              Step out of the bustling streets of KL and into a sanctuary curated for the global traveler.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Traditional souvenir stalls can feel loud and chaotic. At Gembira Momento, we invite you to browse comfortably in a contemporary, gallery-inspired space where Malaysian heritage meets modern elegance.
            </p>
          </div>
        </div>
      </section>

      {/* ========== The Curated Pillars (Product Grid) ========== */}
      <section id="curation" className="py-32 px-6 bg-amber-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-slate-900 mb-6">Our Curation</h2>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              Thoughtfully selected collections for every traveler.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {pillars.map((pillar, idx) => (
              <div
                key={idx}
                className="group cursor-pointer transform transition-all duration-300 hover:shadow-lg p-8 bg-white rounded-lg hover:bg-amber-50"
              >
                <div className="text-6xl mb-6">{pillar.icon}</div>
                <div className="text-sm font-semibold text-amber-700 mb-2">
                  {pillar.number}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">
                  {pillar.title}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== Social Proof / Bestsellers ========== */}
      <section className="py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-slate-900 mb-6">
              What Travelers Are Loving Right Now
            </h2>
            <p className="text-lg text-gray-700">
              Discover our current bestsellers and customer favorites.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {bestsellers.map((item, idx) => (
              <div
                key={idx}
                className="border-2 border-gray-200 rounded-lg p-8 hover:border-amber-700 transition-colors duration-200"
              >
                <div className="inline-block px-4 py-2 bg-amber-100 text-amber-700 text-xs font-bold rounded-full mb-6">
                  {item.tag}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  {item.name}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== Gembira Corporate Bridge ========== */}
      <section className="py-32 px-6 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <p className="text-amber-700 font-semibold text-lg mb-2">
                  The B2B Bridge
                </p>
                <h2 className="text-5xl font-bold text-white">
                  Elevate Your Corporate Gifting
                </h2>
              </div>
              
              <p className="text-xl text-gray-300 leading-relaxed">
                Premium Malaysian Curation for VIPs, Events, & International Guests.
              </p>

              <p className="text-gray-400 leading-relaxed">
                Moving away from generic, mass-produced merchandise, Gembira Corporate crafts custom corporate gift packages. We bundle our signature local treats, artisanal goods, and custom artwork into elegant, minimalist wooden gift boxes that leave a lasting impression.
              </p>

              <div>
                <Link href="/contact">
                  <button className="px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white rounded-full font-semibold text-lg transition-colors duration-200">
                    Download Digital Premium Catalog
                  </button>
                </Link>
              </div>
            </div>

            <div className="bg-linear-to-br from-amber-900 to-amber-700 rounded-lg p-12 text-white">
              <p className="text-sm font-semibold uppercase tracking-wide mb-4">
                Corporate Packages Include
              </p>
              <ul className="space-y-4 text-gray-100">
                <li className="flex items-start gap-3">
                  <span className="text-amber-300">✓</span>
                  <span>Signature Malaysian delicacies & artisanal goods</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-300">✓</span>
                  <span>Custom artwork & personalization options</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-300">✓</span>
                  <span>Elegant wooden gift boxes with branding</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-300">✓</span>
                  <span>Volume discounts for bulk orders</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ========== Info & CTA Section ========== */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl font-bold text-slate-900">
                Plan Your Visit
              </h2>
              
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                    Hours of Operation
                  </p>
                  <p className="text-xl text-gray-900 mt-2">
                    Open Daily, 11:00 AM – 11:00 PM
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                    Location
                  </p>
                  <p className="text-xl text-gray-900 mt-2">
                    Suria KLCC, In Front of Petronas Twin Towers
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
                    Languages Spoken
                  </p>
                  <p className="text-xl text-gray-900 mt-2">
                    English, Mandarin, Malay, Arabic
                  </p>
                </div>
              </div>

              <Link href="/contact">
                <button className="px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white rounded-full font-semibold text-lg transition-colors duration-200">
                  Get in Touch
                </button>
              </Link>
            </div>

            <div className="w-full h-96 bg-gray-200 rounded-lg overflow-hidden">
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
