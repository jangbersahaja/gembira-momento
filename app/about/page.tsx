import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="w-full bg-white">
      {/* Hero Section */}
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-4">
            Taking a Happy Moment Home.
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            The Spirit of Gembira Momento
          </p>
        </div>
      </div>

      {/* Chapter 1: The Meaning Behind the Name */}
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="border-l-4 border-amber-700 pl-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Chapter 1: The Meaning Behind the Name
          </h2>
          <div className="space-y-4 text-gray-700 leading-relaxed text-lg">
            <p>
              Every traveler crosses oceans not just to see new places, but to
              collect moments. Moments of awe as they look up at a towering
              architectural marvel. Moments of joy as they taste a flavor
              completely new to their palate.
            </p>
            <p>
              In Malaysia, we call this feeling{" "}
              <span className="font-semibold text-amber-700">Gembira</span>{" "}
              (Happiness).
            </p>
            <p>
              Gembira Momento was born from a simple but passionate idea: a
              souvenir shouldn't just be an object you throw into a suitcase. It
              should be a beautifully preserved capsule of your happiest travel
              memories. We wanted to create a place where your journey in
              Malaysia doesn't end when you leave—it lives on through the
              objects you take home.
            </p>
          </div>
        </div>
      </div>

      {/* Chapter 2: A Sanctuary in the Heart of KL */}
      <div className="mx-auto max-w-5xl px-6 py-16 bg-gray-50">
        <div className="border-l-4 border-amber-700 pl-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Chapter 2: A Sanctuary in the Heart of KL
          </h2>
          <div className="space-y-4 text-gray-700 leading-relaxed text-lg">
            <p>
              Nestled directly in front of the majestic Petronas Twin Towers
              (KLCC), where the energy of modern Kuala Lumpur pulses day and
              night, you will find our doors. Step out of the bustling city
              streets and into our sanctuary of warm wood tones, clean white
              aesthetics, and soft, welcoming lights.
            </p>
            <p>
              We explicitly designed Gembira Momento to break away from the
              chaotic, plastic-cluttered stalls of traditional souvenir markets.
              We believe that Malaysian culture, art, and craftsmanship are
              rich, elegant, and worthy of a premium boutique experience.
              Walking through our aisles isn't just shopping; it's an immersive,
              multilingual journey celebrating the warmth of Malaysian
              hospitality.
            </p>
            <p className="text-sm text-gray-600 mt-4">
              <span className="font-semibold">📍 Location:</span> Rubber Park @
              KLCC, No. 3, 148, Jln Ampang, Kampung Baru, 50450 KL
              <br />
              <span className="font-semibold">⏰ Hours:</span> Open Daily 11:00
              AM – 11:00 PM
            </p>
          </div>
        </div>
      </div>

      {/* Chapter 3: Artistry, Taste, and Local Soul */}
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="border-l-4 border-amber-700 pl-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Chapter 3: Artistry, Taste, and Local Soul
          </h2>
          <div className="space-y-6 text-gray-700 leading-relaxed text-lg">
            <p className="font-semibold italic text-amber-700">
              We don't mass-produce. We curate.
            </p>
            <p>
              At Gembira Momento, every single item on our shelves tells a piece
              of the Malaysian story. We bridge the gap between brilliant local
              creators and global travelers.
            </p>

            {/* Three Pillars */}
            <div className="space-y-8 mt-8">
              <div className="bg-amber-50 p-6 rounded-lg">
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  🎨 For the Art Collectors
                </h3>
                <p>
                  Our custom-designed postcards, notebooks, and intricate 3D
                  skyline memorabilia are carefully illustrated to showcase the
                  heart and soul of KL's landscape, serving as a lasting
                  testament to the sights you fell in love with.
                </p>
              </div>

              <div className="bg-amber-50 p-6 rounded-lg">
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  👜 For the Lifestyle Explorers
                </h3>
                <p>
                  We proudly partner with independent Malaysian brands to offer
                  premium, locally inspired accessories and textiles that bring
                  contemporary Malaysian style to the global stage.
                </p>
              </div>

              <div className="bg-amber-50 p-6 rounded-lg">
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  🏮 For the Tradition Seekers
                </h3>
                <p>
                  We celebrate the heritage and cultural richness of Malaysia
                  through carefully curated pieces that honor our traditions.
                  From artisanal crafts to cultural symbols, each item connects
                  you to the authentic soul of our nation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter 4: Beyond Retail */}
      <div className="mx-auto max-w-5xl px-6 py-16 bg-gray-50">
        <div className="border-l-4 border-amber-700 pl-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Chapter 4: Beyond Retail—Gembira Corporate
          </h2>
          <div className="space-y-4 text-gray-700 leading-relaxed text-lg">
            <p>
              Our passion for authentic local curation extends far beyond the
              traveler's suitcase. Today, Gembira Momento acts as a premium
              gifting partner for businesses and organizations. Through our
              corporate gifting wing, we bundle our signature local treats,
              artisanal goods, and custom artwork into elegant, minimalist
              wooden gift boxes—allowing corporate clients to share a premium,
              authentic taste of Malaysia with VIPs, international guests, and
              teams worldwide.
            </p>
            <p className="mt-6">
              <Link
                href="/contact"
                className="inline-block px-6 py-3 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition-colors"
              >
                Explore Corporate Gifting
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Our Promise */}
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="bg-linear-to-r from-amber-50 to-yellow-50 p-12 rounded-lg border-2 border-amber-200 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Our Promise to You
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-8">
            Whether you are visiting us from across the globe or looking for the
            perfect homegrown gift, our team is here to welcome you in your
            native language with an open smile.
          </p>
          <p className="text-2xl font-semibold text-amber-700 italic">
            Don't just buy a keepsake. Take a happy moment home.
          </p>
        </div>
      </div>

      {/* Call to Action */}
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h3 className="text-2xl font-bold text-slate-900 mb-6">
          Ready to Visit?
        </h3>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <a
            href="https://share.google/FuUQcoGAe3SJJBGbm"
            target="_blank"
            rel="noreferrer"
            className="px-8 py-3 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg transition-colors"
          >
            Get Directions
          </a>
          <a
            href="mailto:hello@gembiramomento.my"
            className="px-8 py-3 border-2 border-amber-700 text-amber-700 hover:bg-amber-50 font-semibold rounded-lg transition-colors"
          >
            Contact Us
          </a>
        </div>
      </div>
    </div>
  );
}
