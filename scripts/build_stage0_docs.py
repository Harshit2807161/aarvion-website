"""Stage 0: build docs/catalogue.md, docs/missing-products.md and data/products.json
from the Drive-folder analysis in data/source/. Re-runnable."""
import json, re, sys, pathlib
P = pathlib.Path(sys.argv[1])
cat = json.load(open(P/"data/source/catalogue.json"))
mp = {m["product"]: m for m in json.load(open(P/"data/source/aarvion_mapping.json"))}
orig = sorted((P/"assets/products/original").glob("*.webp"))

# Values read off the back panels (verified by eye at full resolution).
SKU = {
 "Sacuwin 50 Tablets":  dict(slug="sacuwin-50", family="sacuwin", name="Sacuwin 50", variant="50", form="Film-coated tablet", pack="Strip of 14 tablets", mrp=281,
     comp=[("Sacubitril (as sodium)","24 mg"),("Valsartan","26 mg")], mfr="Mascot Health Series Pvt. Ltd., Plot 79-80, Sec-6A, IIE, SIDCUL, Haridwar 249403", files="sacuwin-50"),
 "Sacuwin 100 Tablets": dict(slug="sacuwin-100", family="sacuwin", name="Sacuwin 100", variant="100", form="Film-coated tablet", pack="Strip of 14 tablets", mrp=407,
     comp=[("Sacubitril (as sodium)","49 mg"),("Valsartan","51 mg")], mfr="Mascot Health Series Pvt. Ltd., Plot 79-80, Sec-6A, IIE, SIDCUL, Haridwar 249403", files="sacuwin-100"),
 "Sacuwin 200 Tablets": dict(slug="sacuwin-200", family="sacuwin", name="Sacuwin 200", variant="200", form="Film-coated tablet", pack="Strip of 7 tablets", mrp=290,
     comp=[("Sacubitril (as sodium)","97 mg"),("Valsartan","103 mg")], mfr="Mascot Health Series Pvt. Ltd., Plot 79-80, Sec-6A, IIE, SIDCUL, Haridwar 249403", files="sacuwin-200"),
 "Bemptor-180 Tablets": dict(slug="bemptor-180", family="bemptor", name="Bemptor-180", variant="180", form="Film-coated tablet", pack="Strip of 10 tablets", mrp=380,
     comp=[("Bempedoic Acid","180 mg")], mfr="Mascot Health Series Pvt. Ltd., Plot 79-80, Sec-6A, IIE, SIDCUL, Haridwar 249403", files="bemptor-180"),
 "Bemptor-R40 Tablets": dict(slug="bemptor-r40", family="bemptor", name="Bemptor-R40", variant="R40", form="Film-coated tablet", pack="Strip of 10 tablets", mrp=630,
     comp=[("Bempedoic Acid","180 mg"),("Rosuvastatin (as calcium)","40 mg")], mfr="Mascot Health Series Pvt. Ltd., Plot 52, Sec-6A, IIE, SIDCUL, Haridwar 249403", files="bemptor-r40",
     note="MRP print is tiny; read as 630 (OCR said 650). Confirm."),
 "Vildage-M 50/500 & 50/1000 Tablets": dict(slug="vildage-m-50-500", family="vildage-m", name="Vildage-M 50/500", variant="50/500", form="Film-coated tablet", pack="Strip of 15 tablets", mrp=185,
     comp=[("Vildagliptin","50 mg"),("Metformin Hydrochloride","500 mg")], mfr="Sarv Pharmaceuticals, Plot 28, Sector-3A, IIE, SIDCUL, Haridwar 249403", files="vildage-m-50-500",
     note="Only the 50/500 strength is photographed. 50/1000 is listed in docs/missing-products.md."),
 "Hyloage Eye Drops":   dict(slug="hyloage", family="hyloage", name="Hyloage Eye Drops", variant=None, form="Eye drops", pack="10 ml", mrp=425,
     comp=[("Sodium Hyaluronate","0.1% w/v"),("Stabilized Oxychloro Complex (preservative)","0.005% w/v")], mfr=None, files="hyloage",
     note="Manufacturer name too small to read on the photos. Confirm."),
 "Sysnet Ultra Eye Drops": dict(slug="sysnet-ultra", family="sysnet", name="Sysnet Ultra Eye Drops", variant=None, form="Eye drops", pack="10 ml", mrp=416,
     comp=[("Polyethylene Glycol 400","0.4% w/v"),("Propylene Glycol","0.3% w/v"),("Stabilized Oxychloro Complex (preservative)","0.005% w/v")], mfr=None, files="sysnet-ultra",
     note="Manufacturer name only partly legible (Kerala GIDC address). Confirm."),
 "Caftop Eye Drops":    dict(slug="caftop", family="caftop", name="Caftop Eye Drops", variant=None, form="Eye drops", pack="5 ml", mrp=263,
     comp=[("Alcaftadine","0.25% w/v (2.5 mg/ml)"),("Benzalkonium Chloride (preservative)","0.005% w/v")], mfr="Appasamy Ocular Devices (P) Ltd., Plot 74-D, Katha, Baddi, Solan (HP) 173205", files="caftop",
     note="Pack shows no Win2Age or Aarvion mark."),
 "Oloage KT Eye Drops": dict(slug="oloage-kt", family="oloage", name="Oloage-KT Eye Drops", variant=None, form="Eye drops", pack="5 ml", mrp=209,
     comp=[("Olopatadine (as hydrochloride)","0.1% w/v"),("Ketorolac Tromethamine","0.4% w/v")], mfr="Devbhoomi Pharmaceuticals, Khasra 27, Mandawar, Bhagwanpur, Roorkee, Haridwar", files="oloage-kt"),
 "Mucohelp Tablets":    dict(slug="mucohelp", family="mucohelp", name="Mucohelp", variant=None, form="Controlled-release tablet", pack="Strip of 10 tablets", mrp=209,
     comp=[("Ambroxol Hydrochloride","75 mg")], mfr="Dr. Edwin Medilabs Pvt. Ltd., Plot B-29, Industrial Area, Focal Point, Chanalon, Kurali, SAS Nagar 140103 (Pb.)", files="mucohelp",
     note="Probable match: same composition and Win2Age marketer, but no photo shows the product name. Only back/side panels exist. Confirm."),
}
CAT_SLUG = {"Cardiology":"cardiology","Diabetology":"diabetology","Ophthalmology":"ophthalmology","Respiratory":"respiratory",
            "Gastroenterology":"gastroenterology","Orthopaedics":"orthopaedics","Urology":"urology","Pain Management":"pain-management"}

products = []
for i, c in enumerate(cat):
    s = SKU.get(c["name"])
    if not s: continue
    src = mp[c["name"]]["photo_brand"]
    image_source = "aarvion" if src == "Aarvion" else "win2age" if src == "Win2Age" else "unbranded"
    imgs = [f"assets/products/original/{f.name}" for f in orig if f.name.startswith(s["files"] + "--")]
    products.append({
        "slug": s["slug"], "name": s["name"], "familySlug": s["family"], "variantLabel": s["variant"],
        "category": CAT_SLUG[c["cat"]], "composition": [{"ingredient": a, "strength": b} for a, b in s["comp"]],
        "dosageForm": s["form"], "packLabel": s["pack"], "mrpPaise": s["mrp"] * 100, "mrpSource": "pack-back-panel",
        "schedule": "H", "rxRequired": True, "manufacturer": s["mfr"], "marketer": "Aarvion Pharmaceuticals",
        "images": imgs, "heroImage": imgs[0], "imageSource": image_source,
        "active": True, "sortOrder": i, "notes": s.get("note"),
    })
json.dump({"_comment": "Seed data for the 11 listed products. Selling price is derived (MRP - Rs 20), never stored. MRP default when unknown: Rs 404.",
           "defaultMrpPaise": 40400, "products": products}, open(P/"data/products.json", "w"), indent=2, ensure_ascii=False)

# docs/catalogue.md
listed = {c["name"] for c in cat if c["name"] in SKU}
L = ["# Aarvion product catalogue", "",
     "Source: Aarvion's printed \"Doctor Today's Request\" card (photo shared 2026-11-16). 32 lines; Fildol is struck through on the card.", "",
     f"**Listed on the website now: {len(listed)}**. The rest are missing a product photo (see [missing-products.md](missing-products.md)).", ""]
cur = None
for c in cat:
    if c["cat"] != cur:
        cur = c["cat"]; L += ["", f"## {cur}", "", "| Product | Composition | Status |", "|---|---|---|"]
    status = "Listed" if c["name"] in listed else ("Discontinued (struck through)" if "struck" in c["name"] else "Missing photo")
    if c["name"].startswith("Vildage-M"): status = "Listed (50/500 only; 50/1000 missing photo)"
    if c["name"].startswith("Mucohelp"): status = "Listed (probable match, confirm)"
    L.append(f"| {c['name'].replace(' (struck through)','')} | {c['comp']} | {status} |")
open(P/"docs/catalogue.md", "w").write("\n".join(L) + "\n")

# docs/missing-products.md
miss = [c for c in cat if c["name"] not in listed and "struck" not in c["name"]]
M = ["# Products missing from the website", "",
     f"{len(miss)} catalogue products have **no photo** in the shared Drive folder (`Online portal Webp Images/Luxatin-300_`, 276 images), "
     "so they are left off the site for now. Vildage-M **50/1000** is also missing (only 50/500 was photographed).", "",
     "Searched: every image's printed text (OCR) for each product name and molecule; the parent folder (only this subfolder is shared); and the wider Drive by name.", "",
     "| Therapy area | Product | Composition |", "|---|---|---|"]
M += [f"| {c['cat']} | {c['name']} | {c['comp']} |" for c in miss]
M += ["| Diabetology | Vildage-M 50/1000 Tablets | Vildagliptin 50 mg + Metformin 1000 mg |", "",
      "## To add a product later", "",
      "Send, per product:",
      "1. Front, back and side photos of the pack on a white background, square (1000x1000 or larger).",
      "2. The back panel must show **MRP and pack size** clearly. If MRP can't be read, the site uses **Rs 404** (selling price Rs 384).",
      "3. Then add it in the admin dashboard (Products > New). No code change needed.", "",
      "## Not used as stand-ins", "",
      "Some Shilpex Pharmysis packs in the folder have the same molecules (Vglos-0.3 / Vgnorm, Glustar-1/2 / Glyciwin, Hicerin / Qcerin-50). "
      "They print another company's brand name, so they are **not** used.", "",
      "## Placeholder photos in use", "",
      "8 listed products use Win2Age-era packs (Aarvion's earlier marketer) until Aarvion-branded photos arrive. "
      "`imageSource` in `data/products.json` marks them (`win2age`), and the admin dashboard will have a \"needs photo swap\" filter."]
open(P/"docs/missing-products.md", "w").write("\n".join(M) + "\n")
print(len(products), "products;", len(miss), "missing")
for p in products: print(f"  {p['slug']:<18} {p['category']:<14} MRP {p['mrpPaise']//100:>4}  price {p['mrpPaise']//100-20:>4}  imgs {len(p['images'])}  {p['imageSource']}")
