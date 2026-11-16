import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { CatalogueJson } from "../src/server/catalogue/schema.ts";

export type ManifestImage = {
  src: string;
  width: number;
  height: number;
  /** Exact repo-relative source path, as written in data/products.json. */
  from: string;
};
export type ImageManifest = Record<
  string,
  { photos: ManifestImage[]; cutout: ManifestImage | null }
>;

async function describeImage(
  root: string,
  slug: string,
  from: string,
  prefix: string,
): Promise<ManifestImage> {
  const buf = await readFile(resolve(root, from));
  const hash8 = createHash("sha256").update(buf).digest("hex").slice(0, 8);
  const { width, height } = await sharp(buf).metadata();
  if (!width || !height) throw new Error(`cannot read dimensions of ${from}`);
  return { src: `/products/${slug}/${prefix}${hash8}.webp`, width, height, from };
}

export async function planImageSync(
  catalogue: CatalogueJson,
  repoRoot: string,
): Promise<{
  manifest: ImageManifest;
  copies: { from: string; to: string }[];
}> {
  const manifest: ImageManifest = {};
  const copies = new Map<string, string>();
  const add = (img: ManifestImage) => copies.set(`public${img.src}`, img.from);

  for (const p of catalogue.products) {
    const photos: ManifestImage[] = [];
    for (const from of p.images) {
      const img = await describeImage(repoRoot, p.slug, from, "");
      photos.push(img);
      add(img);
    }
    const cutoutFrom = `assets/products/cutout/${p.slug}.webp`;
    let cutout: ManifestImage | null = null;
    if (existsSync(resolve(repoRoot, cutoutFrom))) {
      cutout = await describeImage(repoRoot, p.slug, cutoutFrom, "cutout-");
      add(cutout);
    }
    manifest[p.slug] = { photos, cutout };
  }
  return {
    manifest,
    copies: [...copies].map(([to, from]) => ({ from, to })),
  };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const catalogue = CatalogueJson.parse(
    JSON.parse(await readFile(resolve(root, "data/products.json"), "utf8")),
  );
  const { manifest, copies } = await planImageSync(catalogue, root);

  for (const c of copies) {
    const to = resolve(root, c.to);
    if (existsSync(to)) continue;
    await mkdir(dirname(to), { recursive: true });
    await copyFile(resolve(root, c.from), to);
  }

  const wanted = new Set(copies.map((c) => resolve(root, c.to)));
  const productsDir = resolve(root, "public/products");
  if (existsSync(productsDir)) {
    for (const slugDir of await readdir(productsDir, { withFileTypes: true })) {
      const dir = resolve(productsDir, slugDir.name);
      if (!slugDir.isDirectory() || !(slugDir.name in manifest)) {
        await rm(dir, { recursive: true, force: true });
        continue;
      }
      for (const f of await readdir(dir)) {
        if (!wanted.has(resolve(dir, f))) await rm(resolve(dir, f), { force: true });
      }
    }
  }

  await writeFile(
    resolve(root, "data/product-images.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(`Synced ${copies.length} images for ${catalogue.products.length} products`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
