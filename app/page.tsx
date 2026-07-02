import Hero from "../components/Hero";

export default function Home() {
  return (
    <div className="flex flex-col">
      <Hero />

      {/* Hero wallpaper placeholder — replace with `public/images/hero.jpg` */}
      <section className="mt-6">
        <div className="mx-auto max-w-7xl px-6">
          <div className="hero-wallpaper-placeholder relative rounded-lg overflow-hidden">
            <div className="hero-wallpaper-content absolute inset-0 flex flex-col items-start justify-center p-8">
              <h2 className="text-2xl font-semibold text-foreground">
                Souvenirs & Keepsakes — locally made
              </h2>
              <p className="mt-2 text-sm text-gray-600 max-w-lg">
                Small-batch, thoughtfully selected souvenirs in front of KLCC.
              </p>
              <div className="mt-4">
                <a
                  href="/about"
                  className="inline-block rounded-md bg-foreground px-4 py-2 text-background text-sm"
                >
                  Learn more
                </a>
              </div>
            </div>

            <div className="hero-wallpaper-note absolute right-4 bottom-4 text-xs text-gray-400">
              Placeholder — drop `/public/images/hero.jpg` and set as background
            </div>
          </div>
        </div>
      </section>

      {/* Compact info row (keeps page scannable; footer holds contact details) */}
      <section className="py-8">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-700">
            <div className="rounded-md border p-4">
              <div className="font-medium text-foreground">Location</div>
              <div className="mt-1">In front of KLCC</div>
            </div>
            <div className="rounded-md border p-4">
              <div className="font-medium text-foreground">Hours</div>
              <div className="mt-1">Everyday 11:00 — 22:00</div>
            </div>
            <div className="rounded-md border p-4">
              <div className="font-medium text-foreground">Policy</div>
              <div className="mt-1">
                In-store pickup only — contact for holds
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery placeholders */}
      <section className="py-8">
        <div className="mx-auto max-w-5xl px-6">
          <h3 className="text-sm font-medium text-foreground">Photos</h3>
          <p className="text-xs text-gray-500 mt-1">
            Replace with shop/product images in `public/images/`
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="image-placeholder">
              /public/images/gallery-1.jpg
            </div>
            <div className="image-placeholder">
              /public/images/gallery-2.jpg
            </div>
            <div className="image-placeholder">
              /public/images/gallery-3.jpg
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
