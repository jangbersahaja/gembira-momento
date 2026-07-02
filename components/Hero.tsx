export default function Hero() {
  return (
    <section className="py-12" aria-labelledby="hero-title">
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex flex-col gap-4">
          <h2 id="hero-title" className="text-2xl font-semibold tracking-tight">
            Souvenirs & Keepsakes
          </h2>
          <p className="text-sm text-gray-600 max-w-2xl">
            Quietly curated gifts in front of KLCC — small-batch keepsakes and
            local designs. In-store pickup only.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a href="/about" className="text-sm text-gray-600 hover:underline">
              About
            </a>
            <a
              href="/contact"
              className="text-sm text-gray-600 hover:underline"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
