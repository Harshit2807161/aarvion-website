# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-11-16 from the approved project plan and the owner's brief. The owner said to proceed without a further interview ("go with the best design… I will take a look tomorrow"). Items marked *(inferred)* come from the brief or documents, not a direct answer.

## Platform

web

## Stack

Next.js 16 (App Router) + TypeScript, Node runtime, MongoDB, hosted on Vercel (owner's choice). Remaining sub-choices (data access, SMS/email providers, file storage, UI kit) delegated: recommended options in the project plan, to be confirmed at the stack gate.

## Users

- **Patients and their family members in India** buying prescription medicines Aarvion markets, mostly on mid-range Android phones over 4G *(inferred: Indian e-pharmacy norm)*. Job: find the exact medicine (brand, strength, pack), see price and composition, upload a valid prescription, pay (online or cash on delivery) and get it delivered.
- **Aarvion staff:**
  - a registered pharmacist reviews prescriptions;
  - operations staff pack and ship;
  - an admin edits products, MRP and photos.

## Product Purpose

An online store for Aarvion Pharmaceuticals' own medicines. Every pack sells at **MRP − ₹20**, delivery is **free across India**, and every order is **checked by a pharmacist against a valid prescription** before it ships. Success means:
- a customer goes from landing to placed order (with prescription) on a phone without confusion;
- staff verify and fulfil orders safely.

## Positioning

The marketer of the medicines sells them directly: genuine packs, a fixed ₹20 below printed MRP, free delivery, pharmacist-checked. No marketplace of third-party sellers and no deep-discount churn.

## Operating Context

- **Medicines:** Indian Schedule H packs. Each has a brand + strength (e.g. Sacuwin 100), composition (e.g. Sacubitril 49 mg + Valsartan 51 mg), pack (strip of 14 tablets, 10 ml bottle) and a printed MRP. All current products need a prescription.
- **Customer flow:**
  1. Log in with an OTP sent by SMS or email (customer's choice).
  2. Add products to the cart.
  3. Upload a prescription (photo or PDF) or reuse an earlier one.
  4. Check out with Razorpay or cash on delivery.
  5. Follow the order: placed, Rx under review / approved / rejected, confirmed, packed, shipped, delivered.
- **Staff work** happens in an admin dashboard: Rx queue, orders, products.
- **Notifications** go by SMS and email.

## Capabilities and Constraints

- 11 products listed now in 4 therapy areas (Cardiology, Diabetology, Eye care/Ophthalmology, Respiratory). 20 more catalogue products have no photos yet and are added later via admin. Gastroenterology, Orthopaedics and Urology show as "coming soon".
- Price is always derived as MRP − ₹20 and never stored. MRP defaults to ₹404 when it can't be read from the pack.
- Product photos: 8 products currently use packs printed under Win2Age Pharma (Aarvion's earlier marketing name) until Aarvion-branded photos arrive. Only Sacuwin 50/100/200 carry Aarvion branding.
- **Business rules (proposed defaults, accepted by the owner):**
  - Rx valid 6 months;
  - 10 per product, 20 packs per order;
  - COD up to ₹5,000;
  - pay first, refunded if the Rx is rejected;
  - no returns unless damaged, wrong or expired;
  - cancel before packing.
- **Open:** who issues the GST invoice; licence, pharmacist and grievance-officer details; domain; DLT registration.
- **Legal:**
  - prescription medicines are dispensed only against a valid prescription;
  - no therapeutic or cure claims in copy (Drugs and Magic Remedies Act);
  - product pages show MRP, net quantity, manufacturer/marketer and country of origin.

## Brand Commitments

- **Name:** Aarvion Pharmaceuticals, Plot No. 70, Second Floor, Functional Industrial Estate, Patparganj, New Delhi 110092.
- **Logo:** a green two-blade swoosh over a heavy wide AARVION PHARMACEUTICALS wordmark. Redrawn as SVG in `assets/brand/`; the draft is awaiting approval.
- **Owner's binding visual direction:** a **forest green and white** palette, **modern and sleek**, soothing. References the owner shared:
  - Fernwood (forest green #1F3D2B + sand beige #E8DCC4, centered grotesk headline, dotted texture, fog fade);
  - Leon Abramovic's deep-green rounded-photo site;
  - a bento layout with wide display type.

## Evidence on Hand

- Real product photos: `assets/products/original/`, 32 photos of 11 products.
- Real MRPs and compositions: `data/products.json`.
- Catalogue: `docs/catalogue.md`.
- AI banner scenes: `assets/banners/round1/`.
- **None of these exist, and none may be invented:** customer testimonials, ratings, order counts, delivery-time guarantees, certifications, awards, doctor endorsements, licence numbers.

## Product Principles

1. **Trust before conversion.** Genuine packs, clear MRP vs price, a pharmacist check and legal details visible; nothing that reads as a discount bazaar.
2. **The exact medicine, fast.** Brand, strength, composition and pack are always readable together, so nobody buys the wrong strength.
3. **Prescription is part of the flow, not a wall.** Explain it, make upload easy on a phone, and let customers reuse a valid Rx.
4. **Calm by default.** This is someone's heart or eye medicine; the experience should lower anxiety, not raise it.
5. **Honest, plain language.** No medical claims and no fake urgency.

## Accessibility & Inclusion

WCAG 2.2 AA:
- older users and caregivers read on small Android phones *(inferred)*;
- large readable type and high contrast;
- OTP fields allow paste and autofill;
- every control works by keyboard and screen reader;
- the site works from 360 px wide.
