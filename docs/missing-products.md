# Products missing from the website

20 catalogue products have **no photo** in the shared Drive folder (`Online portal Webp Images/Luxatin-300_`, 276 images), so they are left off the site for now. Vildage-M **50/1000** is also missing (only 50/500 was photographed).

Searched: every image's printed text (OCR) for each product name and molecule; the parent folder (only this subfolder is shared); and the wider Drive by name.

| Therapy area | Product | Composition |
|---|---|---|
| Cardiology | Pitatab 2 & 4 Tablets | Pitavastatin 2 mg & 4 mg |
| Cardiology | Pitatab-F Tablets | Pitavastatin 2 mg + Fenofibrate 67.5 mg |
| Gastroenterology | Dexmore-60 Capsules | Dexlansoprazole 60 mg |
| Gastroenterology | Qraft Oral Suspension (Sugar Free) | Sodium Alginate 250 mg + Sodium Bicarbonate 133.5 mg + Calcium Carbonate 80 mg per 5 ml |
| Diabetology | Natesure Forte Tablets | Nateglinide 60 mg + Metformin 500 mg + Voglibose 0.3 mg |
| Diabetology | Natesure Plus Tablets | Nateglinide 60 mg + Metformin 500 mg + Voglibose 0.2 mg |
| Diabetology | Natesure-M 60 Tablets | Nateglinide 60 mg + Metformin 500 mg |
| Diabetology | Istaglip D 10/100 Tablets | Dapagliflozin 10 mg + Sitagliptin 100 mg |
| Diabetology | Istaglip 50 & 100 Tablets | Sitagliptin 50 mg & 100 mg |
| Diabetology | Istaglip M 50/500 & 50/1000 Tablets | Sitagliptin 50 mg + Metformin 500 mg & 1000 mg |
| Diabetology | Linasure-M 2.5/500 Tablets | Linagliptin 2.5 mg + Metformin 500 mg |
| Diabetology | Linasure-5 Tablets | Linagliptin 5 mg |
| Diabetology | Lobemed Tablets | Lobeglitazone 0.5 mg |
| Diabetology | Qdapa-10 Tablets | Dapagliflozin 10 mg |
| Diabetology | Vgnorm 0.2 & 0.3 Tablets | Voglibose 0.2 mg & 0.3 mg |
| Diabetology | Glyciwin-M1 & M2 Tablets | Glimepiride 1 mg & 2 mg + Metformin 500 mg |
| Orthopaedics | Qcerin-50 Capsules | Diacerein 50 mg |
| Ophthalmology | Hyloage-PG Eye Drops | Sodium Hyaluronate 0.15% + Polyethylene Glycol 400 0.4% + Propylene Glycol 0.3% |
| Urology | Silonice 8 Capsules | Silodosin 8 mg |
| Urology | Silonice D8 Capsules | Silodosin 8 mg + Dutasteride 0.5 mg |
| Diabetology | Vildage-M 50/1000 Tablets | Vildagliptin 50 mg + Metformin 1000 mg |

## To add a product later

Send, per product:
1. Front, back and side photos of the pack on a white background, square (1000x1000 or larger).
2. The back panel must show **MRP and pack size** clearly. If MRP can't be read, the site uses **Rs 404** (selling price Rs 384).
3. Then add it in the admin dashboard (Products > New). No code change needed.

## Not used as stand-ins

Some Shilpex Pharmysis packs in the folder have the same molecules (Vglos-0.3 / Vgnorm, Glustar-1/2 / Glyciwin, Hicerin / Qcerin-50). They print another company's brand name, so they are **not** used.

## Placeholder photos in use

8 listed products use Win2Age-era packs (Aarvion's earlier marketer) until Aarvion-branded photos arrive. `imageSource` in `data/products.json` marks them (`win2age`), and the admin dashboard will have a "needs photo swap" filter.
