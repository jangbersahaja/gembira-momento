export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <h1 className="text-3xl font-semibold">Contact & Visit</h1>
      <p className="mt-4 text-gray-600">
        Rubber Park @ KLCC, No. 3, 148, Jln Ampang, Kampung Baru, 50450 Kuala
        Lumpur.
      </p>
      <div className="mt-6 space-y-2 text-sm text-gray-700">
        <div>
          Phone:{" "}
          <a href="tel:+60123883538" className="underline">
            +6012-388 3538
          </a>
        </div>
        <div>
          Email:{" "}
          <a href="mailto:gembiraceo@gmail.com" className="underline">
            gembiraceo@gmail.com
          </a>
        </div>
        <div>
          Hours: Weekdays 1:00 PM – 11:00 PM · Weekends 11:00 AM – 11:00 PM
        </div>
        <div>
          Directions:{" "}
          <a
            href="https://maps.app.goo.gl/5vWdi4qrUgKq91ff7"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Open in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
