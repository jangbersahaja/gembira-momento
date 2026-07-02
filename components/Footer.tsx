export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-200 bg-white/60">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold">Gembira Momento</div>
            <div className="text-sm text-gray-600">
              In front of KLCC, Kuala Lumpur
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <div>Open: Everyday 11:00 AM — 11:00 PM</div>
            <div className="mt-1">Email: hello@gembiramomento.my</div>
          </div>
        </div>
        <div className="mt-6 text-xs text-gray-500">
          © {new Date().getFullYear()} Gembira Momento
        </div>
      </div>
    </footer>
  );
}
