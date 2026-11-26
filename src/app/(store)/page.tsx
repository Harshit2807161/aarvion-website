import { HeroBanner } from "@/components/home/banner";
import { CategoryBento } from "@/components/home/category-bento";
import { Close } from "@/components/home/close";
import { Faq } from "@/components/home/faq";
import { OrderingSteps } from "@/components/home/ordering-steps";
import { Rails } from "@/components/home/rails";
import { QuickActions } from "@/components/home/quick-actions";
import { TrustStrip } from "@/components/home/trust-strip";
import { getCachedCategories, getCachedProducts } from "@/lib/catalogue/cached";
import { homeModel } from "@/lib/catalogue/home-model";

/**
 * The store home (v2 prototype index.html), in the prototype's order: banner, quick actions,
 * trust strip, shop by category, the product rails, how ordering works, the questions and the
 * closing act. `.home` is the one root rule that sets the home's 1280px content width and
 * section rhythm (src/styles/quick-trust.css); the remaining sections land with UI plan Tasks 23–29.
 */
export default async function Home() {
  const [products, categories] = await Promise.all([getCachedProducts(), getCachedCategories()]);
  const model = homeModel(products, categories);
  return (
    <main id="home" className="home">
      <h1 className="sr-only">Aarvion Pharmaceuticals: buy Aarvion medicines online</h1>
      <HeroBanner />
      <QuickActions />
      <TrustStrip />
      <CategoryBento model={model} />
      <Rails model={model} />
      <OrderingSteps />
      <Faq allRx={model.allRx} />
      <Close />
    </main>
  );
}
