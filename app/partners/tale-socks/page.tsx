import Link from "next/link";

export default function TaleSocksPage() {
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
            TaleSocks
          </h1>
          <p className="text-2xl text-amber-700 font-semibold mb-6">
            Every Step Tells a Story
          </p>
          <p className="text-xl text-gray-600 max-w-3xl">
            Premium socks featuring Malaysian-inspired designs, crafted for
            tropical comfort and wearable storytelling.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="space-y-12">
          {/* Introduction */}
          <div className="border-l-4 border-amber-700 pl-8">
            <p className="text-lg text-gray-700 leading-relaxed">
              At Gembria Momento, we believe that the best souvenirs are the
              ones that accompany you on your own journey. We are thrilled to
              partner with TaleSocks, a Malaysian lifestyle brand that
              transforms everyday essentials into wearable pieces of art.
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
                  TaleSocks was founded on the idea that socks are more than
                  just a garment—they are a medium for expression. Each pair is
                  meticulously crafted from premium, breathable combed cotton,
                  specifically engineered for the comfort needed in
                  Malaysia&apos;s tropical climate.
                </p>
                <p>
                  But TaleSocks isn&apos;t just about comfort. It&apos;s about
                  wearing your story, celebrating your heritage, and carrying a
                  piece of Malaysian culture with you wherever your journey
                  takes you.
                </p>
              </div>
            </div>
          </div>

          {/* Design Philosophy */}
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              The Design Philosophy
            </h2>
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 md:p-8 space-y-6">
              <p className="text-gray-700 leading-relaxed text-lg">
                Every TaleSocks design is an homage to Malaysia&apos;s vibrant
                soul. From the intricate geometry of traditional Batik and
                Songket to whimsical tributes to our iconic city skyline and
                local flora, their collection captures the essence of Kuala
                Lumpur in a way that is stylish, modern, and deeply authentic.
              </p>
              <div className="bg-blue-50 rounded p-4 border border-blue-200">
                <p className="text-slate-900 font-semibold mb-3">
                  Design Inspirations Include:
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      <strong>Traditional Patterns</strong> — Batik, Songket,
                      and Tenun weaving techniques
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      <strong>Local Landmarks</strong> — KL&apos;s iconic
                      skyline and architectural gems
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      <strong>Natural Flora</strong> — Native Malaysian plants,
                      flowers, and wildlife
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      <strong>Cultural Celebrations</strong> — Festive motifs
                      and traditional celebrations
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Why a Tale Belongs */}
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Why a &quot;Tale&quot; Belongs in Your Collection
            </h2>
            <div className="space-y-4">
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 md:p-8">
                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <span className="text-amber-700 font-bold text-2xl mt-1">
                      ✓
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900 text-lg">
                        Narrative-Driven
                      </span>
                      <p className="text-gray-700 mt-2">
                        Just like our store, TaleSocks believes in the power of
                        storytelling. Their designs are conversation starters
                        meant to be shared and admired.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-amber-700 font-bold text-2xl mt-1">
                      ✓
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900 text-lg">
                        Premium Quality
                      </span>
                      <p className="text-gray-700 mt-2">
                        Forget generic souvenirs. TaleSocks offers a high-end
                        feel, soft touch, and durable finish that travelers are
                        proud to wear or gift.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-amber-700 font-bold text-2xl mt-1">
                      ✓
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900 text-lg">
                        The Perfect Gift
                      </span>
                      <p className="text-gray-700 mt-2">
                        Lightweight, compact, and uniquely Malaysian, they are
                        the ideal keepsake for any traveler looking to carry
                        home a piece of their journey without adding weight to
                        their luggage.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="text-amber-700 font-bold text-2xl mt-1">
                      ✓
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900 text-lg">
                        Made for Malaysia
                      </span>
                      <p className="text-gray-700 mt-2">
                        Breathable combed cotton designed specifically for
                        tropical climates means you&apos;ll actually want to
                        wear them at home too.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Closing Message */}
          <div className="bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 md:p-8 space-y-4">
            <p className="text-2xl font-semibold text-slate-900 italic">
              Walk with us.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg">
              Whether you are looking for a subtle nod to local heritage or a
              bold statement piece, TaleSocks offers a fresh, contemporary take
              on what it means to carry home a memory. Every pair is a reminder
              of your connection to Malaysia and the unique stories that make
              this country extraordinary.
            </p>
            <p className="text-gray-600">
              Discover the TaleSocks collection at Gembira Momento today—find
              the pattern that tells your story.
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
