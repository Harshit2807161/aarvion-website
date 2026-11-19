import { HeroBanner } from "@/components/home/banner";
import { QuickActions } from "@/components/home/quick-actions";
import { TrustStrip } from "@/components/home/trust-strip";

/**
 * The store home (v2 prototype index.html), in the prototype's order: banner, quick actions,
 * trust strip. `.home` is the one root rule that sets the home's 1280px content width
 * (src/styles/quick-trust.css); the later sections land with UI plan Tasks 21–29.
 */
export default function Home() {
  return (
    <main id="home" className="home">
      <h1 className="sr-only">Aarvion Pharmaceuticals: buy Aarvion medicines online</h1>
      <HeroBanner />
      <QuickActions />
      <TrustStrip />
    </main>
  );
}
