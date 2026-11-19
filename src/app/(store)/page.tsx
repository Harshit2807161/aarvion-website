import { HeroBanner } from "@/components/home/banner";

/**
 * The store home (v2 prototype index.html). `.home` sets the store's 1280px content width and
 * the section rhythm for every home section (banner.css); the sections after the banner land
 * with UI plan Tasks 20–29.
 */
export default function Home() {
  return (
    <main id="home" className="home">
      <h1 className="sr-only">Aarvion Pharmaceuticals: buy Aarvion medicines online</h1>
      <HeroBanner />
    </main>
  );
}
