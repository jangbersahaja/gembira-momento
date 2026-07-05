import Link from "next/link";

export default function PartnersPage() {
  return (
    <div className="w-full bg-white">
      {/* Hero Section */}
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-4">
            Our Partners
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover the local creators and social enterprises we proudly curate
            at Gembira Momento.
          </p>
        </div>
      </div>

      {/* Tiffin JEIWA Partner Showcase */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="border-l-4 border-amber-700 pl-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Tiffin JEIWA — Art with Heart
          </h2>

          <div className="space-y-6 text-gray-700 leading-relaxed text-lg">
            <p>
              At Gembira Momento, we believe the best souvenirs are those that
              tell a story—not just of the place you visited, but of the people
              who call it home. We are proud to partner with Tiffin JEIWA, a
              Malaysian social enterprise that breathes new life into the
              timeless mangkuk tingkat (tiffin carrier).
            </p>

            {/* Why We Love Them */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-6 md:p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Why We Love Them
              </h3>
              <div className="space-y-4">
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

            {/* The Craft */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 md:p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">
                The Craft
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Artisan-Made
                    </span>
                    <p className="text-gray-700 mt-1">
                      Uniquely hand-painted, ensuring no two pieces are exactly
                      alike.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Premium &amp; Safe
                    </span>
                    <p className="text-gray-700 mt-1">
                      Crafted from high-quality, food-grade stainless steel with
                      non-toxic, lead-free paints.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Designed for Life
                    </span>
                    <p className="text-gray-700 mt-1">
                      Leak-proof, durable, and perfectly suited for the modern
                      traveler&apos;s lifestyle.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Closing Message */}
            <div className="bg-linear-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg p-6 md:p-8">
              <p className="text-xl font-semibold text-slate-900 italic mb-4">
                Carry home more than a memory.
              </p>
              <p className="text-gray-700">
                When you bring a Tiffin JEIWA into your home, you carry the
                spirit of Malaysian resilience and the joy of a community
                empowered.
              </p>
              <p className="text-gray-600 text-sm mt-4">
                Discover the collection in-store today and support the hands
                that paint them.
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link
              href="/contact"
              className="px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition-colors text-center"
            >
              Visit Us In-Store
            </Link>
            <Link
              href="/about"
              className="px-8 py-4 border-2 border-amber-700 text-amber-700 hover:bg-amber-50 font-semibold rounded-lg transition-colors text-center"
            >
              Our Curation Philosophy
            </Link>
          </div>
        </div>
      </div>

      {/* TaleSocks Partner Showcase */}
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="border-l-4 border-amber-700 pl-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            TaleSocks — Every Step Tells a Story
          </h2>

          <div className="space-y-6 text-gray-700 leading-relaxed text-lg">
            <p>
              At Gembria Momento, we believe that the best souvenirs are the
              ones that accompany you on your own journey. We are thrilled to
              partner with TaleSocks, a Malaysian lifestyle brand that
              transforms everyday essentials into wearable pieces of art.
            </p>

            {/* Why We Love Them */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-6 md:p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Why We Love Them
              </h3>
              <p>
                TaleSocks was founded on the idea that socks are more than just
                a garment—they are a medium for expression. Each pair is
                meticulously crafted from premium, breathable combed cotton,
                specifically engineered for the comfort needed in
                Malaysia&apos;s tropical climate.
              </p>
            </div>

            {/* Design Philosophy */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 md:p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                The Design Philosophy
              </h3>
              <p>
                Every TaleSocks design is an homage to Malaysia&apos;s vibrant
                soul. From the intricate geometry of traditional Batik and
                Songket to whimsical tributes to our iconic city skyline and
                local flora, their collection captures the essence of Kuala
                Lumpur in a way that is stylish, modern, and deeply authentic.
              </p>
            </div>

            {/* Why a Tale Belongs in Your Collection */}
            <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 md:p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">
                Why a &quot;Tale&quot; Belongs in Your Collection
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Narrative-Driven
                    </span>
                    <p className="text-gray-700 mt-1">
                      Just like our store, TaleSocks believes in the power of
                      storytelling. Their designs are conversation starters
                      meant to be shared.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Premium Quality
                    </span>
                    <p className="text-gray-700 mt-1">
                      Forget generic souvenirs. TaleSocks offers a high-end
                      feel, soft touch, and durable finish that travelers are
                      proud to wear or gift.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      The Perfect Gift
                    </span>
                    <p className="text-gray-700 mt-1">
                      Lightweight, compact, and uniquely Malaysian, they are the
                      ideal keepsake for any traveler looking to carry home a
                      piece of their journey without adding weight to their
                      luggage.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Closing Message */}
            <div className="bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 md:p-8">
              <p className="text-xl font-semibold text-slate-900 italic mb-4">
                Walk with us.
              </p>
              <p className="text-gray-700">
                Whether you are looking for a subtle nod to local heritage or a
                bold statement piece, TaleSocks offers a fresh, contemporary
                take on what it means to carry home a memory.
              </p>
              <p className="text-gray-600 text-sm mt-4">
                Discover the TaleSocks collection at Gembira Momento today—find
                the pattern that tells your story.
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link
              href="/contact"
              className="px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition-colors text-center"
            >
              Visit Us In-Store
            </Link>
            <Link
              href="/about"
              className="px-8 py-4 border-2 border-amber-700 text-amber-700 hover:bg-amber-50 font-semibold rounded-lg transition-colors text-center"
            >
              Our Curation Philosophy
            </Link>
          </div>
        </div>
      </div>

      {/* Mariari Partner Showcase */}
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="border-l-4 border-amber-700 pl-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Mariari — Capturing the Soul of Malaysia, One Detail at a Time
          </h2>

          <div className="space-y-6 text-gray-700 leading-relaxed text-lg">
            <p>
              At Gembira Momento, we believe souvenirs should do more than just
              mark a place on a map; they should capture the taste, the charm,
              and the spirit of the local experience. We are delighted to
              partner with Mariari, a Malaysian design house that finds beauty
              in the little things that make our country home.
            </p>

            {/* Why We Love Them */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-6 md:p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">
                Why We Love Them
              </h3>
              <p>
                Mariari transforms the everyday icons of Malaysia—our morning
                coffee, our favorite afternoon kuih, and the vibrant local food
                scene—into beautifully crafted lifestyle pieces. Whether
                it&apos;s an enamel pin of your favorite local snack or a
                notebook that brightens up your day, their products are designed
                to make you smile and spark fond memories of life in Malaysia.
              </p>
            </div>

            {/* The Mariari Aesthetic */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 md:p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">
                The Mariari Aesthetic
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Playfully Authentic
                    </span>
                    <p className="text-gray-700 mt-1">
                      Their designs are a love letter to local food and
                      heritage, capturing the warmth and nostalgia of Malaysian
                      culture with a clean, contemporary twist.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Thoughtful Keepsakes
                    </span>
                    <p className="text-gray-700 mt-1">
                      From their &quot;Nanyang Series&quot; fragrances to their
                      charming fridge magnets and stationery, each piece is
                      designed to be a functional, high-quality item that fits
                      seamlessly into your daily life.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Gift-Ready
                    </span>
                    <p className="text-gray-700 mt-1">
                      Compact, creative, and uniquely Malaysian, Mariari&apos;s
                      products are perfect gifts for travelers wanting to bring
                      home a slice of Malaysia that feels personal, artistic,
                      and true to heart.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Closing Message */}
            <div className="bg-linear-to-r from-rose-50 to-pink-50 border-2 border-rose-200 rounded-lg p-6 md:p-8">
              <p className="text-xl font-semibold text-slate-900 italic mb-4">
                Bring a memory home.
              </p>
              <p className="text-gray-700">
                When you choose a Mariari piece, you aren&apos;t just buying a
                souvenir—you are taking home a piece of Malaysia&apos;s vibrant,
                delicious, and joyful culture.
              </p>
              <p className="text-gray-600 text-sm mt-4">
                Explore the Mariari collection at Gembira Momento and discover
                your next favorite Malaysian keepsake.
              </p>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link
              href="/contact"
              className="px-8 py-4 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition-colors text-center"
            >
              Visit Us In-Store
            </Link>
            <Link
              href="/about"
              className="px-8 py-4 border-2 border-amber-700 text-amber-700 hover:bg-amber-50 font-semibold rounded-lg transition-colors text-center"
            >
              Our Curation Philosophy
            </Link>
          </div>
        </div>
      </div>

      {/* More Partners Coming Soon */}
      <div className="mx-auto max-w-5xl px-6 py-16 bg-gray-50 rounded-lg mb-20">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            More Partners Coming Soon
          </h3>
          <p className="text-gray-600 max-w-2xl mx-auto">
            We are constantly discovering exceptional Malaysian creators and
            social enterprises. Check back soon for more curated partnerships
            celebrating local artistry and impact.
          </p>
        </div>
      </div>
    </div>
  );
}
