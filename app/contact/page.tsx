export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <h1 className="text-3xl font-semibold">Contact & Visit</h1>
      <p className="mt-4 text-gray-600">
        We are located in front of KLCC, Kuala Lumpur.
      </p>
      <div className="mt-6 space-y-2 text-sm text-gray-700">
        <div>Phone: +60 12-345 6789</div>
        <div>Email: hello@gembiramomento.my</div>
        <div>
          Directions:{" "}
          <a href="https://maps.google.com?q=KLCC" className="underline">
            Open in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
