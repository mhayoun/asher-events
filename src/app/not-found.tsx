import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-6xl">🎵</p>
      <h1 className="mt-4 font-display text-3xl font-bold">האירוע לא נמצא</h1>
      <Link href="/" className="mt-6 inline-block text-gold hover:underline">
        חזרה לכל האירועים
      </Link>
    </div>
  );
}
