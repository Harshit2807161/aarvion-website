import { CategoryBento } from "@/components/home/category-bento";
import { OrderingSteps } from "@/components/home/ordering-steps";
import { QuickActions } from "@/components/home/quick-actions";
import { TrustStrip } from "@/components/home/trust-strip";
import { getCachedCategories, getCachedProducts } from "@/lib/catalogue/cached";
import { homeModel } from "@/lib/catalogue/home-model";

export default async function Home() {
  const [products, categories] = await Promise.all([getCachedProducts(), getCachedCategories()]);
  const model = homeModel(products, categories);
  return (
    <main id="main" className="home">
      <h1>Aarvion: coming soon</h1>
      <QuickActions />
      <TrustStrip />
      <CategoryBento model={model} />
      <OrderingSteps />
    </main>
  );
}
