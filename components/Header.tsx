import Link from "next/link";

export default function Header() {
  return (
    <header className="w-full border-b border-gray-200 bg-white/60 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-semibold text-foreground">
          Gembira Momento
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/about" className="hover:underline">
            About
          </Link>
          <Link href="/contact" className="hover:underline">
            Contact
          </Link>
          <Link
            href="https://maps.google.com?q=KLCC"
            target="_blank"
            rel="noreferrer"
            className="ml-4 rounded-md bg-foreground px-3 py-1 text-background text-sm"
          >
            Visit Us
          </Link>
        </nav>
      </div>
    </header>
  );
}
