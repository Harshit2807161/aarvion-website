/** Every cached catalogue read carries this tag; revalidateCatalogue() expires it. */
export const CATALOGUE_TAG = "catalogue";

export const productTag = (slug: string) => `${CATALOGUE_TAG}:product:${slug}`;
export const familyTag = (familySlug: string) => `${CATALOGUE_TAG}:family:${familySlug}`;
export const categoryTag = (slug: string) => `${CATALOGUE_TAG}:category:${slug}`;
