import Link from "next/link";

export default function TiffinJeiwaPage() {
  return (
    <div className="w-full bg-white">
      {/* Hero Section */}
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <Link
          href="/partners"
          className="text-amber-700 hover:text-amber-800 font-semibold mb-4 inline-block"
        >
          ← Back to Partners
        </Link>
        <div className="mt-8">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-4">
            Tiffin JEIWA
          </h1>
          <p className="text-2xl text-amber-700 font-semibold mb-6">
            Art with Heart
          </p>
          <p className="text-xl text-gray-600 max-w-3xl">
            Hand-painted stainless steel tiffin carriers empowering women
            artisans across Malaysia.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="space-y-12">
          {/* Introduction */}
          <div className="border-l-4 border-amber-700 pl-8">
            <p className="text-lg text-gray-700 leading-relaxed">
              At Gembira Momento, we believe the best souvenirs are those that
              tell a story—not just of the place you visited, but of the people
              who call it home. We are proud to partner with Tiffin JEIWA, a
              Malaysian social enterprise that breathes new life into the
              timeless mangkuk tingkat (tiffin carrier).
            </p>
          </div>

          {/* Why We Love Them */}
          <div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-6 md:p-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                Why We Love Them
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed text-lg">
                <p>
                  More than just a beautiful kitchen essential, every Tiffin
                  JEIWA piece is a labor of love. Each stainless steel carrier
                  is meticulously hand-painted by women artisans—survivors and
                  resilient individuals striving for a new beginning.
                </p>
                <p>
                  When you choose a Tiffin JEIWA piece, you are not just taking
                  home a stunning, functional piece of Malaysian heritage; you
                  are directly contributing to the JEIWA Power House, an
                  integrated community center dedicated to empowering women
                  through training, education, and economic independence.
                </p>
              </div>
            </div>
          </div>

          {/* The Craft */}
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              The Craft
            </h2>
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 md:p-8">
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-2xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900 text-lg">
                      Artisan-Made
                    </span>
                    <p className="text-gray-700 mt-2">
                      Uniquely hand-painted, ensuring no two pieces are exactly
                      alike. Each design carries the individual touch and spirit
                      of the artisan who created it.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-2xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900 text-lg">
                      Premium & Safe
                    </span>
                    <p className="text-gray-700 mt-2">
                      Crafted from high-quality, food-grade stainless steel with
                      non-toxic, lead-free paints. Perfect for storing and
                      serving food with complete peace of mind.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-2xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900 text-lg">
                      Designed for Life
                    </span>
                    <p className="text-gray-700 mt-2">
                      Leak-proof, durable, and perfectly suited for the modern
                      traveler&apos;s lifestyle. Functional art that lasts for
                      generations.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* The Impact */}
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              The Impact
            </h2>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 md:p-8 space-y-4 text-gray-700 leading-relaxed text-lg">
              <p>
                Tiffin JEIWA is more than a product line—it&apos;s a movement.
                By choosing Tiffin JEIWA, you support:
              </p>
              <ul className="space-y-3 ml-4">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>
                    <strong>Economic Independence</strong> for women artisans
                    through fair wages and sustainable employment
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>
                    <strong>Community Development</strong> through the JEIWA
                    Power House, which provides training and educational
                    opportunities
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>
                    <strong>Cultural Preservation</strong> of traditional
                    Malaysian craftsmanship and heritage
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Closing Message */}
          <div className="bg-linear-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg p-6 md:p-8 space-y-4">
            <p className="text-2xl font-semibold text-slate-900 italic">
              Carry home more than a memory.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg">
              When you bring a Tiffin JEIWA into your home, you carry the spirit
              of Malaysian resilience and the joy of a community empowered.
              Every painted stroke tells a story of hope, creativity, and
              perseverance.
            </p>
            <p className="text-gray-600">
              Discover the collection in-store today and support the hands that
              paint them.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 pt-8">
            <Link
              href="/contact"
              className="px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition-colors text-center"
            >
              Visit Us In-Store
            </Link>
            <Link
              href="/partners"
              className="px-8 py-4 border-2 border-amber-700 text-amber-700 hover:bg-amber-50 font-semibold rounded-lg transition-colors text-center"
            >
              Explore Other Partners
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
