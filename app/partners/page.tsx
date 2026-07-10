import Link from "next/link";

export default function PartnersPage() {
  const partnersByCategory = [
    {
      category: "Heritage & Tradition",
      description: "Artisans preserving Malaysian craftsmanship and heritage",
      partners: [
        {
          name: "Tiffin JEIWA",
          tagline: "Art with Heart",
          description:
            "Hand-painted stainless steel tiffin carriers empowering women artisans",
          href: "/partners/tiffin-jeiwa",
        },
      ],
    },
    {
      category: "Lifestyle & Fashion",
      description: "Contemporary brands celebrating Malaysian culture",
      partners: [
        {
          name: "TaleSocks",
          tagline: "Every Step Tells a Story",
          description:
            "Premium socks featuring Malaysian-inspired designs for tropical comfort",
          href: "/partners/tale-socks",
        },
      ],
    },
    {
      category: "Art & Design",
      description: "Creative minds capturing Malaysia's vibrant soul",
      partners: [
        {
          name: "Mariari",
          tagline: "Capturing the Soul of Malaysia",
          description:
            "Playful enamel pins, stationery, and fragrance celebrating local icons",
          href: "/partners/mariari",
        },
      ],
    },
  ];

  return (
    <div className="w-full bg-white">
      {/* Hero Section */}
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-4">
            Our Partners
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            At Gembira Momento, partnerships are built on shared values:
            authenticity, quality, and a commitment to celebrating Malaysian
            creativity and heritage.
          </p>
        </div>
      </div>

      {/* Partnership Philosophy */}
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <div className="border-l-4 border-amber-700 pl-8 space-y-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Why We Partner
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              We don&apos;t just stock products—we curate relationships. Every
              partner at Gembira Momento represents something larger than
              commerce. Whether they&apos;re empowering communities through
              employment, preserving traditional crafts, or telling
              Malaysia&apos;s story through innovative design, our partners are
              catalysts for meaningful change.
            </p>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-4">
              Our Partnership Philosophy
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <span className="text-amber-700 font-bold text-xl mt-1">✓</span>
                <div>
                  <span className="font-semibold text-slate-900">
                    Authenticity First
                  </span>
                  <p className="text-gray-700 mt-1">
                    We partner with makers who are deeply rooted in their craft,
                    not mass-produced alternatives. Every piece tells a true
                    story.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-amber-700 font-bold text-xl mt-1">✓</span>
                <div>
                  <span className="font-semibold text-slate-900">
                    Impact Matters
                  </span>
                  <p className="text-gray-700 mt-1">
                    Our partners create positive change—whether through fair
                    wages, community empowerment, cultural preservation, or
                    sustainable practices.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-amber-700 font-bold text-xl mt-1">✓</span>
                <div>
                  <span className="font-semibold text-slate-900">
                    Quality Over Quantity
                  </span>
                  <p className="text-gray-700 mt-1">
                    We celebrate craftsmanship and attention to detail. Our
                    partners share our belief that the best souvenirs are built
                    to last.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-amber-700 font-bold text-xl mt-1">✓</span>
                <div>
                  <span className="font-semibold text-slate-900">
                    Malaysia at Its Best
                  </span>
                  <p className="text-gray-700 mt-1">
                    From heritage preservation to contemporary innovation, our
                    partners capture the multifaceted richness of Malaysian
                    culture and creativity.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Featured Partners */}
      <div className="bg-amber-50 py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Meet Our Partners
            </h2>
            <p className="text-lg text-gray-700">
              Explore the makers and visionaries behind our curated collections.
            </p>
          </div>

          <div className="space-y-16">
            {partnersByCategory.map((section, idx) => (
              <div key={idx}>
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">
                    {section.category}
                  </h3>
                  <p className="text-gray-600">{section.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                  {section.partners.map((partner, pIdx) => (
                    <Link key={pIdx} href={partner.href} className="group">
                      <div className="bg-white rounded-lg p-8 border-2 border-transparent hover:border-amber-700 transition-all duration-200 cursor-pointer h-full">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="text-2xl font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                              {partner.name}
                            </h4>
                            <p className="text-amber-700 font-semibold mt-1">
                              {partner.tagline}
                            </p>
                          </div>
                          <span className="text-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                            →
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">
                          {partner.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Growing Network */}
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <div className="border-l-4 border-amber-700 pl-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Growing Our Network
          </h2>
          <div className="space-y-6 text-gray-700 leading-relaxed text-lg">
            <p>
              We are constantly on the hunt for the next exceptional Malaysian
              creator, artisan collective, or social enterprise that embodies
              our values. If you believe your work deserves a place at Gembira
              Momento, we&apos;d love to hear from you.
            </p>
            <p>
              Our partnerships are built on genuine relationships and shared
              vision. Whether you&apos;re an established maker or an emerging
              talent, if your story resonates with ours, let&apos;s connect.
            </p>

            <div className="mt-8">
              <Link
                href="/contact"
                className="inline-block px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition-colors"
              >
                Inquire About Partnerships
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Closing CTA */}
      <div className="bg-amber-50 py-16 md:py-20 rounded-lg mb-20 mx-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-6">
            <h3 className="text-3xl font-bold text-slate-900">
              Discover Our Partners In-Store
            </h3>
            <p className="text-lg text-gray-700">
              Visit Gembira Momento to explore our full partner collection and
              meet the teams behind these incredible brands.
            </p>
            <Link
              href="/contact"
              className="inline-block px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition-colors"
            >
              Visit Us Today
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
