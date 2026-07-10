import Link from "next/link";

export default function MariariPage() {
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
            Mariari
          </h1>
          <p className="text-2xl text-amber-700 font-semibold mb-6">
            Capturing the Soul of Malaysia, One Detail at a Time
          </p>
          <p className="text-xl text-gray-600 max-w-3xl">
            Playful enamel pins, stationery, and fragrance celebrating Malaysian
            food, heritage, and daily joy.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="space-y-12">
          {/* Introduction */}
          <div className="border-l-4 border-amber-700 pl-8">
            <p className="text-lg text-gray-700 leading-relaxed">
              At Gembira Momento, we believe souvenirs should do more than just
              mark a place on a map; they should capture the taste, the charm,
              and the spirit of the local experience. We are delighted to
              partner with Mariari, a Malaysian design house that finds beauty
              in the little things that make our country home.
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
                  Mariari transforms the everyday icons of Malaysia—our morning
                  coffee, our favorite afternoon kuih, and the vibrant local
                  food scene—into beautifully crafted lifestyle pieces. Whether
                  it&apos;s an enamel pin of your favorite local snack or a
                  notebook that brightens up your day, their products are
                  designed to make you smile and spark fond memories of life in
                  Malaysia.
                </p>
                <p>
                  What makes Mariari special is their deep appreciation for the
                  mundane made meaningful. They celebrate the small joys—the
                  kopi tiam breakfast, the street food scene, the cozy corners
                  of KL—and turn them into collectible art.
                </p>
              </div>
            </div>
          </div>

          {/* The Mariari Aesthetic */}
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              The Mariari Aesthetic
            </h2>
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6 md:p-8 space-y-6">
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-2xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900 text-lg">
                      Playfully Authentic
                    </span>
                    <p className="text-gray-700 mt-2">
                      Their designs are a love letter to local food and
                      heritage, capturing the warmth and nostalgia of Malaysian
                      culture with a clean, contemporary twist that feels both
                      timeless and modern.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-2xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900 text-lg">
                      Thoughtful Keepsakes
                    </span>
                    <p className="text-gray-700 mt-2">
                      From their &quot;Nanyang Series&quot; fragrances to their
                      charming fridge magnets and stationery, each piece is
                      designed to be a functional, high-quality item that fits
                      seamlessly into your daily life.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-amber-700 font-bold text-2xl mt-1">
                    ✓
                  </span>
                  <div>
                    <span className="font-semibold text-slate-900 text-lg">
                      Diverse Product Range
                    </span>
                    <p className="text-gray-700 mt-2">
                      Whether you love enamel pins, notebooks, fragrances, or
                      home décor, Mariari has something to celebrate your unique
                      connection to Malaysia.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Product Categories */}
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              What You&apos;ll Find at Gembira Momento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-linear-to-br from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200">
                <p className="font-bold text-slate-900 mb-3">🎨 Enamel Pins</p>
                <p className="text-gray-700 text-sm">
                  Collectible pins featuring Malaysian food, landmarks, and
                  cultural icons—perfect for your bag, jacket, or pin
                  collection.
                </p>
              </div>
              <div className="bg-linear-to-br from-pink-50 to-rose-50 rounded-lg p-6 border border-pink-200">
                <p className="font-bold text-slate-900 mb-3">📔 Stationery</p>
                <p className="text-gray-700 text-sm">
                  Notebooks, postcards, and journals designed to brighten your
                  desk and inspire your daily writing.
                </p>
              </div>
              <div className="bg-linear-to-br from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-200">
                <p className="font-bold text-slate-900 mb-3">🌸 Fragrances</p>
                <p className="text-gray-700 text-sm">
                  Scents inspired by Malaysia&apos;s heritage and
                  nature—capturing the essence of a moment in a bottle.
                </p>
              </div>
              <div className="bg-linear-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                <p className="font-bold text-slate-900 mb-3">🏠 Home Décor</p>
                <p className="text-gray-700 text-sm">
                  Magnets, prints, and decorative items that turn your space
                  into a celebration of Malaysian culture.
                </p>
              </div>
            </div>
          </div>

          {/* Gift-Ready */}
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-8">
              Why Mariari is Gift-Ready
            </h2>
            <div className="bg-linear-to-r from-rose-50 to-pink-50 border-2 border-rose-200 rounded-lg p-6 md:p-8 space-y-4">
              <p className="text-gray-700 leading-relaxed text-lg">
                Mariari&apos;s products are the perfect souvenir because
                they&apos;re:
              </p>
              <ul className="space-y-3 ml-4 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="text-rose-600 font-bold">•</span>
                  <span>
                    <strong>Compact</strong> — Easy to pack without weighing
                    down your luggage
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-600 font-bold">•</span>
                  <span>
                    <strong>Personal</strong> — Each piece tells a unique story
                    about Malaysia
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-600 font-bold">•</span>
                  <span>
                    <strong>Shareable</strong> — Perfect for sharing with
                    friends and family back home
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-600 font-bold">•</span>
                  <span>
                    <strong>Memorable</strong> — Functional pieces that remind
                    you of your journey every day
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Closing Message */}
          <div className="bg-linear-to-r from-rose-50 to-pink-50 border-2 border-rose-200 rounded-lg p-6 md:p-8 space-y-4">
            <p className="text-2xl font-semibold text-slate-900 italic">
              Bring a memory home.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg">
              When you choose a Mariari piece, you aren&apos;t just buying a
              souvenir—you are taking home a piece of Malaysia&apos;s vibrant,
              delicious, and joyful culture. You&apos;re supporting a design
              house that celebrates the everyday beauty of this country and
              shares it with the world.
            </p>
            <p className="text-gray-600">
              Explore the Mariari collection at Gembira Momento and discover
              your next favorite Malaysian keepsake.
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
