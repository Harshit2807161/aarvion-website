import { OrderingSteps } from "@/components/home/ordering-steps";
import { QuickActions } from "@/components/home/quick-actions";
import { TrustStrip } from "@/components/home/trust-strip";

export default function Home() {
  return (
    <main id="main" className="home">
      <h1>Aarvion: coming soon</h1>
      <QuickActions />
      <TrustStrip />
      <OrderingSteps />
    </main>
  );
}
