# Aarvion website: requirements (v0.1, for approval)

Status: **draft for review, approval gate 1**. Items marked **❓** need your answer before the build.

## 1. Purpose
A commercial website where patients in India buy Aarvion Pharmaceuticals' prescription medicines online:
- log in with an OTP;
- upload a prescription;
- pay online or on delivery;
- pay **₹20 less than MRP** on every pack, with free delivery.

Aarvion staff use an admin dashboard to verify prescriptions and fulfil orders. The site should feel **calm, modern and trustworthy** (green and white), and be **fast on mid-range Android phones**.

## 2. Users
| User | Needs |
|---|---|
| Customer (patient or family member) | Find a medicine, check price and composition, upload a prescription, order, track it |
| Pharmacist (Aarvion staff) | Review prescriptions quickly and safely; approve or reject with a reason |
| Operations staff | Move orders through packing, shipping and delivery; record courier and AWB; handle cancellations and refunds |
| Admin | Everything above, plus edit products, MRP and photos, and manage staff roles |

## 3. Scope
**In v1**
- Catalogue: 11 products in 4 therapy areas (shown to shoppers as Heart care, Diabetes care, Eye care, Respiratory care).
  - Gastroenterology, Orthopaedics and Urology show as "coming soon" (all their products lack photos; see `missing-products.md`).
  - Pain Management is hidden, since Fildol is discontinued.
- OTP login by mobile **or** email, profile, address book.
- Prescription upload and reuse.
- Cart, checkout (Razorpay + cash on delivery), order history, cancel and re-order.
- Email + SMS notifications.
- Admin dashboard: Rx review queue, orders, products.
- Content pages: home, about, contact, FAQ, legal policies.

**Not in v1** (possible later)
- Wallet, referral rewards, coupons.
- Family "medication buckets" / auto-refill.
- Doctor consultation.
- Hindi language.
- Native app.
- Blog.
- Product reviews. These are deliberately avoided for prescription drugs.

## 4. Sitemap
```
/                       Home
/category/[slug]        Category listing (Heart care, Diabetes care, Eye care, Respiratory care; others "coming soon")
/product/[slug]         Product page
/search                 Search results (also a search overlay in the header)
/cart                   Cart (also a slide-in cart drawer)
/checkout               Address → Prescription → Payment → Review
/order/[number]         Order confirmation and detail
/login                  OTP login (also a login dialog)
/account                Profile · Addresses · Prescriptions · Orders · Privacy
/about  /contact  /faq
/legal/terms  /legal/privacy  /legal/shipping  /legal/returns-cancellation  /legal/prescription-policy  /legal/grievance
/admin                  Dashboard · Prescriptions queue · Orders · Products  (staff only)
```

## 5. Customer requirements

### 5.1 Browse
- **Home:**
  - hero banner (2–4 slides, each with one message, text in HTML);
  - shop by therapy area;
  - featured products;
  - how it works (upload Rx → we verify → delivered);
  - trust band (genuine medicines, licensed pharmacist, free delivery, secure payment);
  - FAQ teaser;
  - footer with licence details.
- **Product card:** photo, name + strength, composition (short), pack size, **MRP struck through, selling price, "₹20 off" tag**, "Rx" badge, Add to cart.
- **Product page:**
  - gallery, name, variant switcher (e.g. Sacuwin 50/100/200), "Requires a valid prescription" notice;
  - composition, dosage form, pack size;
  - MRP / price / "inclusive of all taxes";
  - quantity stepper, Add to cart;
  - manufacturer and marketer with addresses, country of origin;
  - info sections (uses, how it works, storage, precautions), written without therapeutic claims;
  - related products in the same therapy area.
- **Search** by brand or molecule (e.g. "sacu", "valsartan"), forgiving of spacing and case.

### 5.2 Login (OTP)
- The customer chooses **Mobile** (+91, 10 digits starting 6–9) or **Email**. A 6-digit code is sent, valid for 5 minutes, at most 5 tries, resend after 30 s.
- The OTP field supports paste and phone autofill (`one-time-code`).
- First login creates the account. The customer can later add and verify the other channel in their profile.
- Browsing and the cart work without login. The guest cart merges into the account at login.
- Login is required to upload a prescription or check out.

### 5.3 Profile and addresses
- Name, verified mobile, verified email (each changed only via OTP), date of birth (optional), gender (optional).
- Address book: up to 10 addresses with name, phone, address lines, landmark, city, state, 6-digit pincode, and one default.
- Privacy: download my data, request account deletion.

### 5.4 Prescriptions
- Upload JPG, PNG, WebP or PDF, up to 8 MB.
- Phone camera capture works on mobile. Images are compressed before upload.
- Patient name is entered with each upload, plus a declaration that it is a valid prescription from a registered doctor.
- Status for each upload: Under review / Approved (valid until a date) / Rejected (reason).
- At checkout: **upload new**, **choose a previously uploaded one**, or **reuse the Rx from a past order** (if still valid).

### 5.5 Cart and checkout
- Cart drawer and cart page with quantity steppers and remove.
- **Price summary:**
  - MRP total;
  - Aarvion discount (₹20 × quantity);
  - delivery **Free**;
  - **Total payable**;
  - "Inclusive of all taxes".
- **Checkout steps:** Address, then Prescription, then Payment (**Razorpay**: UPI / cards / netbanking, or **Cash on delivery**), then Review, then Place order.
- The server recalculates prices; it never trusts the browser.
- **Order confirmation page:** order number (e.g. `AAR-2611-00042`), items, total, payment method, "Your prescription is being reviewed" message.

### 5.6 Orders
- **Order list and detail** with a status timeline:
  - Placed;
  - Prescription under review / approved / rejected (on hold);
  - Confirmed;
  - Packed;
  - Shipped (courier + tracking link);
  - Delivered;
  - Cancelled.
- **Cancel** with a reason, any time before Packed.
- **Re-order** puts the same items back in the cart.
- **Invoice download**, once delivered.

### 5.7 Notifications (email + SMS)
- Sent on: OTP; order placed; Rx approved; Rx rejected (with what to do next); shipped (tracking link); delivered; cancelled/refunded.
- Messages never include prescription contents or diagnosis.

## 6. Admin requirements
- **Roles:** Pharmacist, Operations, Admin. Staff log in with OTP. The session ends after 30 minutes idle.
- **Dashboard:** counts of Rx awaiting review, orders to pack, orders to ship, today's orders.
- **Prescription queue** (oldest first):
  - view the file (zoom, PDF viewer) next to the order items;
  - approve with doctor name, doctor registration no., Rx date and valid-until;
  - or reject with a reason and a note to the customer.
  - Approval moves linked orders to **Confirmed**.
  - Rejection puts them **On hold** and, if prepaid, flags a refund.
- **Orders:**
  - filter by status;
  - move to the next allowed status only;
  - record courier, AWB and tracking URL;
  - mark COD collected;
  - cancel and refund (Razorpay refund).
- **Products:**
  - edit name, composition, pack, **MRP** (with a live "selling price = MRP − ₹20" preview), active on/off, therapy area;
  - upload or replace photos;
  - a "needs photo swap" filter for Win2Age placeholder photos;
  - add the 20 missing products later without code.
- **Audit trail:** every prescription view and decision, status change, MRP edit and role change is logged with who and when.

## 7. Business rules
| Rule | Value |
|---|---|
| Selling price | MRP − ₹20 per pack (MRP must be ≥ ₹21) |
| MRP when not printed or unreadable | ₹404 (price ₹384) |
| Delivery | Free, all India, any valid 6-digit pincode |
| Prescription | Required for every current product (all Schedule H). Orders can't be confirmed or shipped without an approved, valid Rx. |
| ❓ Rx validity | Proposed: **6 months** from the Rx date |
| ❓ Max quantity | Proposed: **10 per product, 20 packs per order** |
| ❓ COD limit | Proposed: COD allowed up to **₹5,000** per order |
| ❓ Payment timing | Proposed: **pay at checkout; automatic refund if the Rx is rejected** (the usual 1mg/PharmEasy pattern), rather than paying after approval |
| ❓ Returns | Proposed: no returns on medicines unless damaged, wrong or expired, reported within 48 h of delivery |
| ❓ Invoice | Who issues the GST invoice (Aarvion or a dispensing partner)? HSN code and GST rate per product? |
| ❓ Cancellation | Proposed: the customer can cancel until Packed; refund to source in 5–7 working days |

## 8. Look and feel (Stage 2 decides the details)
- Green and white, soothing, modern and sleek. Generous white space, rounded corners, soft shadows, no loud neon.
- Typography is chosen from side-by-side options in style round 1. qtways' Playfair Display + Inter is one of the candidates.
- Banners are custom AI-generated art (Aarvion packs in a calm green setting). Text and buttons are real HTML, never baked into images.
- Win2Age placeholder photos: front shots only where possible, marked for later swap.

## 9. Quality targets
- **Speed:** Lighthouse mobile ≥ 90; LCP < 2.5 s; CLS < 0.1; product pages served static from the CDN.
- **Accessibility:** WCAG 2.2 AA (contrast, keyboard, screen reader, focus, paste allowed in OTP).
- **Responsive:** works from 360 px wide through large desktop.
- **SEO and sharing:** each product page has a title, description, social preview image and structured data. WhatsApp link previews show the product.
- **Security:**
  - OTPs hashed and single-use;
  - rate limits on login;
  - prescriptions stored privately and only visible to the customer and staff;
  - all prices computed on the server;
  - payment signatures verified.

## 10. Compliance (needs your legal confirmation)
- Selling Schedule H medicines online needs a **retail drug licence** (or a licensed dispensing partner) and a **registered pharmacist** reviewing prescriptions.
- **Footer and Contact page** must show:
  - legal name and address, GSTIN;
  - drug licence numbers;
  - pharmacist name and registration no.;
  - **grievance officer** name and contact;
  - customer care contact.
- **Product pages** must show: MRP, net quantity, manufacturer/marketer, country of origin.
- No therapeutic or cure claims in copy (Drugs and Magic Remedies Act).
- **Privacy (DPDP Act 2023):**
  - consent at sign-up, with marketing opt-in separate and off by default;
  - 18+ declaration;
  - data download and deletion;
  - retention limits.

## 11. Decided so far
- Tech: **Next.js 16 (App Router) + TypeScript**, Node runtime, MongoDB, hosted on Vercel.
- Payment: Razorpay (test mode until KYC) + COD.
- OTP: mobile or email, the customer's choice.
- Notifications: email + SMS.
- Delivery: free, all India.
- Admin dashboard: yes.
- Domain: Vercel URL for now.
- Logo: redrawn from the packs.
- Missing products: documented in `missing-products.md`, added later via admin.

## 12. Needed from you before go-live (not blocking design or build)
1. **Domain**, for sending email OTP and notifications.
2. **DLT registration** with MSG91 (sender ID + 6 SMS templates). This is legally required for any SMS in India and takes days.
3. **Vercel Pro**: the free plan doesn't allow commercial sites.
4. **MongoDB Atlas** account (Mumbai region).
5. **Razorpay test keys**, then KYC for live keys.
6. Licence, pharmacist, grievance-officer and GSTIN details for the footer.
