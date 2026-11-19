/*
  Aarvion admin prototype. One script for all five pages (body[data-page]).
  All people, orders, prescriptions and registration numbers are EXAMPLE data.
  State lives in sessionStorage so an approval on the queue shows on Orders.
  Debug: ?state=rx-review-open | rx-reject | rx-confirm | order-drawer-ship |
         product-edit-invalid-mrp | idle-warning   and   ?reset=1
*/
(() => {
'use strict';

/* ── helpers ─────────────────────────────────────────────────────────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, c = '') => `<svg class="icon ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);
const debug = params.get('state');
const NOW = Date.now();
const ago = m => NOW - m * 60000;
const rupee = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const ageOf = ts => { let m = Math.max(0, Math.round((NOW - ts) / 60000)); if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ' + String(m % 60).padStart(2, '0') + 'm'; return Math.floor(h / 24) + 'd ' + (h % 24) + 'h'; };
const fmt = ts => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).replace(',', '') + ' IST';
const fmtShort = ts => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).replace(',', '');
const todayISO = new Date(NOW).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const dmy = iso => { if (!iso) return '–'; const [y, m, d] = iso.split('-').map(Number); return d + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + y; };
const isoDaysAgo = n => new Date(NOW - n * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const plus6 = iso => { if (!iso) return ''; let [y, m, d] = iso.split('-').map(Number); m += 6; if (m > 12) { m -= 12; y++; } const last = new Date(y, m, 0).getDate(); d = Math.min(d, last); return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const shellEl = $('.shell');

/* ── data (EXAMPLE) ──────────────────────────────────────────────────── */
const PRODUCTS = [{"slug":"bemptor-r40","name":"Bemptor-R40","cat":"cardiology","comp":[["Bempedoic Acid","180 mg"],["Rosuvastatin (as calcium)","40 mg"]],"form":"Film-coated tablet","pack":"Strip of 10 tablets","mrp":630,"sch":"H","rx":true,"src":"win2age","active":true},{"slug":"bemptor-180","name":"Bemptor-180","cat":"cardiology","comp":[["Bempedoic Acid","180 mg"]],"form":"Film-coated tablet","pack":"Strip of 10 tablets","mrp":380,"sch":"H","rx":true,"src":"win2age","active":true},{"slug":"sacuwin-100","name":"Sacuwin 100","cat":"cardiology","comp":[["Sacubitril (as sodium)","49 mg"],["Valsartan","51 mg"]],"form":"Film-coated tablet","pack":"Strip of 14 tablets","mrp":407,"sch":"H","rx":true,"src":"aarvion","active":true},{"slug":"sacuwin-200","name":"Sacuwin 200","cat":"cardiology","comp":[["Sacubitril (as sodium)","97 mg"],["Valsartan","103 mg"]],"form":"Film-coated tablet","pack":"Strip of 7 tablets","mrp":290,"sch":"H","rx":true,"src":"aarvion","active":true},{"slug":"sacuwin-50","name":"Sacuwin 50","cat":"cardiology","comp":[["Sacubitril (as sodium)","24 mg"],["Valsartan","26 mg"]],"form":"Film-coated tablet","pack":"Strip of 14 tablets","mrp":281,"sch":"H","rx":true,"src":"aarvion","active":true},{"slug":"vildage-m-50-500","name":"Vildage-M 50/500","cat":"diabetology","comp":[["Vildagliptin","50 mg"],["Metformin Hydrochloride","500 mg"]],"form":"Film-coated tablet","pack":"Strip of 15 tablets","mrp":185,"sch":"H","rx":true,"src":"win2age","active":true},{"slug":"hyloage","name":"Hyloage Eye Drops","cat":"ophthalmology","comp":[["Sodium Hyaluronate","0.1% w/v"],["Stabilized Oxychloro Complex (preservative)","0.005% w/v"]],"form":"Eye drops","pack":"10 ml","mrp":425,"sch":"H","rx":true,"src":"win2age","active":true},{"slug":"sysnet-ultra","name":"Sysnet Ultra Eye Drops","cat":"ophthalmology","comp":[["Polyethylene Glycol 400","0.4% w/v"],["Propylene Glycol","0.3% w/v"],["Stabilized Oxychloro Complex (preservative)","0.005% w/v"]],"form":"Eye drops","pack":"10 ml","mrp":416,"sch":"H","rx":true,"src":"win2age","active":true},{"slug":"caftop","name":"Caftop Eye Drops","cat":"ophthalmology","comp":[["Alcaftadine","0.25% w/v (2.5 mg/ml)"],["Benzalkonium Chloride (preservative)","0.005% w/v"]],"form":"Eye drops","pack":"5 ml","mrp":263,"sch":"H","rx":true,"src":"unbranded","active":true},{"slug":"oloage-kt","name":"Oloage-KT Eye Drops","cat":"ophthalmology","comp":[["Olopatadine (as hydrochloride)","0.1% w/v"],["Ketorolac Tromethamine","0.4% w/v"]],"form":"Eye drops","pack":"5 ml","mrp":209,"sch":"H","rx":true,"src":"win2age","active":true},{"slug":"mucohelp","name":"Mucohelp","cat":"respiratory","comp":[["Ambroxol Hydrochloride","75 mg"]],"form":"Controlled-release tablet","pack":"Strip of 10 tablets","mrp":209,"sch":"H","rx":true,"src":"win2age","active":true}];
const AREAS = { cardiology: 'Cardiology', diabetology: 'Diabetology', ophthalmology: 'Eye care', respiratory: 'Respiratory', gastro: 'Gastroenterology', ortho: 'Orthopaedics', urology: 'Urology' };
const ROLE = { pharmacist: 'Pharmacist', ops: 'Operations', admin: 'Admin' };
const STAFF = [
  { id: 's1', name: 'Priya Nair', role: 'pharmacist', reg: 'PCI-EX 48213', mobile: '+91 98•••• ••412', status: 'Active', last: ago(14) },
  { id: 's2', name: 'Rohan Mehta', role: 'pharmacist', reg: 'PCI-EX 51904', mobile: '+91 99•••• ••087', status: 'Active', last: ago(1260) },
  { id: 's3', name: 'Imran Khan', role: 'ops', reg: '', mobile: '+91 97•••• ••635', status: 'Active', last: ago(35) },
  { id: 's4', name: 'Sunita Verma', role: 'ops', reg: '', mobile: '+91 90•••• ••228', status: 'Active', last: ago(2900) },
  { id: 's5', name: 'Dev Patel', role: 'ops', reg: '', mobile: '+91 88•••• ••941', status: 'Suspended', last: ago(24000) },
  { id: 's6', name: 'Anil Rao', role: 'admin', reg: '', mobile: '+91 98•••• ••160', status: 'Active', last: ago(160) },
];
const DOCS = [
  ['Dr. Ritu Banerjee', 'MD (Cardiology)', 'DMC-EX 28841', 'Banerjee Heart Clinic, Pune'],
  ['Dr. Vikram Shah', 'MD, DM (Cardiology)', 'MMC-EX 61207', 'Shah Cardiac Care, Lucknow'],
  ['Dr. Anitha Krishnan', 'MS (Ophthalmology)', 'TNMC-EX 40356', 'Krishnan Eye Centre, Chennai'],
  ['Dr. Syed Imran Ali', 'MD (General Medicine)', 'TSMC-EX 77412', 'Ali Family Clinic, Hyderabad'],
  ['Dr. Manoj Tiwari', 'MD (Cardiology)', 'RMC-EX 19983', 'Tiwari Heart Institute, Jaipur'],
  ['Dr. Shalini Rao', 'MBBS, DNB (Endocrinology)', 'KMC-EX 55120', 'Rao Diabetes Clinic, Bengaluru'],
];
const CUST = {
  anjali: ['Anjali Deshmukh', 'Pune 411038'], rajesh: ['Rajesh Kumar Singh', 'Lucknow 226010'], meena: ['Meenakshi Subramanian', 'Chennai 600028'],
  farhan: ['Farhan Qureshi', 'Hyderabad 500034'], kavita: ['Kavita Joshi', 'Jaipur 302017'], suresh: ['Suresh Babu', 'Bengaluru 560076'],
  harpreet: ['Harpreet Kaur', 'Ludhiana 141001'], sanjay: ['Sanjay Gupta', 'New Delhi 110024'], lakshmi: ['Lakshmi Narayanan', 'Coimbatore 641002'],
  debashis: ['Debashis Chatterjee', 'Kolkata 700019'], nisha: ['Nisha Verma', 'Bhopal 462016'], arvind: ['Arvind Pillai', 'Kochi 682016'],
  pooja: ['Pooja Mehra', 'Ahmedabad 380015'], imtiaz: ['Imtiaz Ansari', 'Patna 800001'], ravi: ['Ravi Teja', 'Vijayawada 520010'],
};

const oid = n => 'AAR-2611-' + String(n - 24320).padStart(5, '0');
function seed() {
  const O = (n, c, items, pm, ps, rx, status, t, extra = {}) => ({ id: oid(n), cust: c, items, pay: { method: pm, status: ps }, rx: 'RX-' + rx, status, t, ...extra });
  const orders = [
    O(24801, 'anjali', [['sacuwin-100', 2]], 'online', 'paid', 3201, 'placed', { placed: ago(1560) }),
    O(24802, 'rajesh', [['bemptor-r40', 1], ['bemptor-180', 1]], 'cod', 'due', 3202, 'placed', { placed: ago(1040) }),
    O(24803, 'meena', [['hyloage', 2], ['sysnet-ultra', 1]], 'online', 'paid', 3203, 'placed', { placed: ago(650) }),
    O(24804, 'farhan', [['vildage-m-50-500', 3]], 'online', 'paid', 3204, 'placed', { placed: ago(400) }),
    O(24805, 'farhan', [['mucohelp', 1]], 'cod', 'due', 3204, 'placed', { placed: ago(395) }),
    O(24806, 'kavita', [['sacuwin-50', 2]], 'online', 'paid', 3205, 'confirmed', { placed: ago(900), confirmed: ago(860) }),
    O(24807, 'suresh', [['caftop', 1], ['oloage-kt', 1]], 'online', 'paid', 3206, 'packed', { placed: ago(1300), confirmed: ago(1250), packed: ago(600) }),
    O(24808, 'harpreet', [['sacuwin-200', 1]], 'cod', 'due', 3207, 'confirmed', { placed: ago(720), confirmed: ago(700) }),
    O(24809, 'sanjay', [['bemptor-180', 2]], 'online', 'paid', 3208, 'shipped', { placed: ago(3000), confirmed: ago(2950), packed: ago(2700), shipped: ago(2400) }, { ship: { courier: 'Delhivery', awb: '2874 5510 3321', url: 'https://www.delhivery.com/track/package/287455103321' } }),
    O(24810, 'lakshmi', [['hyloage', 1]], 'cod', 'due', 3209, 'shipped', { placed: ago(2900), confirmed: ago(2860), packed: ago(2600), shipped: ago(2300) }, { ship: { courier: 'Blue Dart', awb: '7743 2209 187', url: 'https://www.bluedart.com/tracking?awb=77432209187' } }),
    O(24811, 'debashis', [['sacuwin-100', 1]], 'online', 'paid', 3210, 'delivered', { placed: ago(5800), confirmed: ago(5750), packed: ago(5500), shipped: ago(5200), delivered: ago(3100) }, { ship: { courier: 'DTDC', awb: 'D50194227', url: 'https://www.dtdc.in/tracking.asp?awb=D50194227' } }),
    O(24812, 'nisha', [['mucohelp', 2]], 'online', 'refund_due', 3211, 'hold', { placed: ago(1700), hold: ago(1500) }),
    O(24813, 'arvind', [['oloage-kt', 1]], 'cod', 'none', 3212, 'hold', { placed: ago(2200), hold: ago(2000) }),
    O(24814, 'pooja', [['vildage-m-50-500', 2]], 'online', 'refunded', 3213, 'cancelled', { placed: ago(4300), confirmed: ago(4240), cancelled: ago(4000) }),
    O(24815, 'imtiaz', [['bemptor-r40', 1]], 'online', 'paid', 3214, 'confirmed', { placed: ago(500), confirmed: ago(470) }),
    O(24816, 'ravi', [['sacuwin-50', 1], ['mucohelp', 1]], 'online', 'paid', 3215, 'packed', { placed: ago(1100), confirmed: ago(1060), packed: ago(300) }),
  ];
  const R = (n, os, up, type, status, doc, dayAgo, extra = {}) => ({ id: 'RX-' + n, orders: os.map(oid), up: ago(up), type, status, doc: DOCS[doc], sheetDate: isoDaysAgo(dayAgo), views: [], ...extra });
  const dec = (by, at, d, reg, date, until) => ({ by, at: ago(at), doctor: d, docReg: reg, rxDate: date, validUntil: until, pharmReg: STAFF.find(s => s.name === by).reg, matched: true });
  const rx = [
    R(3201, [24801], 1520, 'image', 'awaiting', 0, 3, { views: [{ by: 'Rohan Mehta', ts: ago(95) }] }),
    R(3202, [24802], 1010, 'image', 'awaiting', 0, 6),
    R(3203, [24803], 640, 'pdf', 'awaiting', 2, 2),
    R(3204, [24804, 24805], 380, 'image', 'awaiting', 5, 1),
    R(3205, [24806], 880, 'image', 'approved', 4, 2, { decision: dec('Priya Nair', 860, 'Dr. Manoj Tiwari', 'RMC-EX 19983', isoDaysAgo(2), plus6(isoDaysAgo(2))) }),
    R(3206, [24807], 1290, 'image', 'approved', 2, 4, { decision: dec('Rohan Mehta', 1250, 'Dr. Anitha Krishnan', 'TNMC-EX 40356', isoDaysAgo(4), plus6(isoDaysAgo(4))) }),
    R(3207, [24808], 715, 'image', 'approved', 1, 5, { decision: dec('Priya Nair', 700, 'Dr. Vikram Shah', 'MMC-EX 61207', isoDaysAgo(5), plus6(isoDaysAgo(5))) }),
    R(3208, [24809], 2990, 'pdf', 'approved', 0, 8, { decision: dec('Priya Nair', 2950, 'Dr. Ritu Banerjee', 'DMC-EX 28841', isoDaysAgo(8), plus6(isoDaysAgo(8))) }),
    R(3209, [24810], 2890, 'image', 'approved', 2, 3, { decision: dec('Rohan Mehta', 2860, 'Dr. Anitha Krishnan', 'TNMC-EX 40356', isoDaysAgo(3), plus6(isoDaysAgo(3))) }),
    R(3210, [24811], 5790, 'image', 'approved', 4, 12, { decision: dec('Priya Nair', 5750, 'Dr. Manoj Tiwari', 'RMC-EX 19983', isoDaysAgo(12), plus6(isoDaysAgo(12))) }),
    R(3211, [24812], 1690, 'image', 'rejected', 3, 4, { decision: { by: 'Priya Nair', at: ago(1500), reason: 'illegible', note: 'The photo of your prescription is too blurry for us to read the medicine names. Please upload a clear photo with all four corners visible.' } }),
    R(3212, [24813], 2190, 'image', 'rejected', 2, 290, { decision: { by: 'Rohan Mehta', at: ago(2000), reason: 'expired', note: 'This prescription is more than 6 months old, so we cannot dispense against it. Please upload a recent prescription from your doctor.' } }),
    R(3213, [24814], 4290, 'image', 'approved', 5, 6, { decision: dec('Priya Nair', 4250, 'Dr. Shalini Rao', 'KMC-EX 55120', isoDaysAgo(6), plus6(isoDaysAgo(6))) }),
    R(3214, [24815], 495, 'image', 'approved', 0, 1, { decision: dec('Priya Nair', 470, 'Dr. Ritu Banerjee', 'DMC-EX 28841', isoDaysAgo(1), plus6(isoDaysAgo(1))) }),
    R(3215, [24816], 1090, 'image', 'approved', 1, 2, { decision: dec('Rohan Mehta', 1060, 'Dr. Vikram Shah', 'MMC-EX 61207', isoDaysAgo(2), plus6(isoDaysAgo(2))) }),
  ];
  const feed = [
    { ts: ago(14), kind: 'ok', ic: 'orders', text: 'Order AAR-2611-00496 marked packed', who: 'Imran Khan, Operations' },
    { ts: ago(95), kind: 'ok', ic: 'rx', text: 'Rx RX-3201 opened for review', who: 'Rohan Mehta, Pharmacist' },
    { ts: ago(300), kind: 'ok', ic: 'orders', text: 'Order AAR-2611-00496 packed', who: 'Imran Khan, Operations' },
    { ts: ago(860), kind: 'ok', ic: 'rx', text: 'Rx RX-3205 approved. AAR-2611-00486 confirmed', who: 'Priya Nair, Pharmacist' },
    { ts: ago(1500), kind: 'danger', ic: 'x', text: 'Rx RX-3211 rejected: illegible. AAR-2611-00492 on hold, refund due', who: 'Priya Nair, Pharmacist' },
    { ts: ago(2300), kind: 'ok', ic: 'truck', text: 'Order AAR-2611-00490 shipped via Blue Dart', who: 'Sunita Verma, Operations' },
    { ts: ago(3000), kind: 'warn', ic: 'money', text: 'MRP of Mucohelp edited: ₹189 → ₹209', who: 'Anil Rao, Admin' },
  ];
  const recOf = t => (t.match(/RX-\d{4}|AAR-\d{4}-\d{5}/) || ['Mucohelp'])[0];
  const roles = [[ago(60 * 24 * 36), 'Role granted: Pharmacist', 'Rohan Mehta'], [ago(60 * 24 * 36), 'Registration no. recorded', 'Rohan Mehta'], [ago(60 * 24 * 19), 'Role granted: Operations', 'Sunita Verma'], [ago(60 * 24 * 4), 'Access suspended', 'Dev Patel']];
  const audit = [...feed.map(f => ({ ts: f.ts, who: f.who, what: f.text, rec: recOf(f.text) })), { ts: ago(95), who: 'Rohan Mehta, Pharmacist', what: 'Viewed prescription', rec: 'RX-3201' }, ...roles.map(([ts, what, rec]) => ({ ts, who: 'Anil Rao, Admin (CLI)', what, rec }))];
  return { rx, orders, products: PRODUCTS.map(p => ({ ...p })), feed, audit, me: null };
}
function loadState() {
  try { if (params.get('reset') || debug) sessionStorage.removeItem('av-admin-v1'); const raw = sessionStorage.getItem('av-admin-v1'); if (raw) return JSON.parse(raw); } catch (e) { /* storage blocked */ }
  return seed();
}
let S = loadState();
const save = () => { try { sessionStorage.setItem('av-admin-v1', JSON.stringify(S)); } catch (e) { /* ignore */ } };
const prod = slug => S.products.find(p => p.slug === slug);
const orderBy = id => S.orders.find(o => o.id === id);
const rxBy = id => S.rx.find(r => r.id === id);
const unit = p => p.mrp - 20;
const total = o => o.items.reduce((s, [slug, q]) => s + q * unit(prod(slug)), 0);
const ordCell = r => `<span title="${esc(r.orders.join(', '))}">${r.orders[0]}${r.orders.length > 1 ? ` <span class="muted">+${r.orders.length - 1}</span>` : ''}</span>`;
const itemsText = o => { const [s, q] = o.items[0]; return `${prod(s).name} ×${q}` + (o.items.length > 1 ? ` +${o.items.length - 1} more` : ''); };
const compText = p => p.comp.map(([i, s]) => `${i.replace(/ \(.*\)/, '')} ${s.replace(/ \(.*\)/, '')}`).join(' + ');
const who = () => `${me().name}, ${ROLE[me().role]}`;
function audit(what, rec) { (S.audit = S.audit || []).push({ ts: Date.now(), who: who(), what, rec }); save(); }  /* append-only: no edit or delete path */
const pushFeed = (kind, ic, text, rec) => { S.feed.unshift({ ts: Date.now(), kind, ic, text, who: who() }); audit(text, rec || (text.match(/RX-\d{4}|AAR-\d{4}-\d{5}/) || ['–'])[0]); };

/* ── persona (prototype only: switch to preview roles) ───────────────── */
const defaultUser = { prescriptions: 's1', orders: 's3' }[page] || 's6';
function me() { return STAFF.find(s => s.id === (S.me || defaultUser)); }
const can = a => ({ 'rx.decide': me().role === 'pharmacist', 'order.act': me().role !== 'pharmacist', 'product.edit': me().role === 'admin' }[a]);
const needText = { 'rx.decide': 'Only a registered pharmacist can decide prescriptions.', 'order.act': 'Operations or Admin role needed to change orders.', 'product.edit': 'Admin role needed to edit products.' };
const lockNote = a => `<p class="lock-note">${icon('lock', 'sm')}<span>${needText[a]} You are signed in as ${esc(me().name)} (${ROLE[me().role]}).</span></p>`;

function buildMe() {
  const m = me(), host = $('#me'); if (!host) return;
  const ini = m.name.split(' ').map(w => w[0]).join('');
  host.innerHTML = `<button class="me-btn" type="button" aria-expanded="false" aria-controls="me-menu"><span class="avatar" aria-hidden="true">${ini}</span><span class="me-text"><span class="me-name">${esc(m.name)}</span><span class="me-role">${ROLE[m.role]}${m.reg ? ' · ' + esc(m.reg) : ''}</span></span>${icon('chev', 'sm')}</button>
  <div class="me-menu" id="me-menu" role="group" aria-label="Switch example user" hidden><h2>Signed in as an example user. Switch to preview another role.</h2>${STAFF.filter(s => s.status === 'Active').map(s => `<button type="button" aria-pressed="${s.id === m.id}" data-u="${s.id}"><span class="avatar" aria-hidden="true">${s.name.split(' ').map(w => w[0]).join('')}</span><span class="me-text"><span class="me-name">${esc(s.name)}</span><span class="me-role">${ROLE[s.role]}</span></span><span class="check">${icon('check', 'sm')}</span></button>`).join('')}<hr><button type="button" data-signout>${icon('out', 'sm')}<span>Sign out (prototype)</span></button></div>`;
  const btn = $('.me-btn', host), menu = $('#me-menu', host);
  const set = open => { menu.hidden = !open; btn.setAttribute('aria-expanded', open); if (open) $('button[aria-pressed="true"]', menu).focus(); };
  btn.addEventListener('click', () => set(menu.hidden));
  menu.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.u) { S.me = b.dataset.u; save(); location.reload(); } else if (b.hasAttribute('data-signout')) { set(false); signOut('You chose to sign out.'); }
  });
  document.addEventListener('click', e => { if (!menu.hidden && !host.contains(e.target)) set(false); });
  host.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); set(false); btn.focus(); } });
}

/* ── chips ───────────────────────────────────────────────────────────── */
const chip = (txt, cls = '') => `<span class="chip ${cls}">${esc(txt)}</span>`;
const RXS = { awaiting: ['Awaiting review', 'warn'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'danger'] };
const OS = { placed: ['Placed', 'neutral'], hold: ['On hold', 'danger'], confirmed: ['Confirmed', 'active'], packed: ['Packed', 'active'], shipped: ['Shipped', 'active'], delivered: ['Delivered', 'ok'], cancelled: ['Cancelled', 'neutral'] };
const PAYS = { paid: ['Paid', 'ok'], due: ['To collect', 'warn'], collected: ['Collected', 'ok'], refund_due: ['Refund due', 'danger'], refunded: ['Refunded', 'neutral'], none: ['Not collected', 'neutral'] };
const rxChip = s => chip(...RXS[s]);
const orderChip = s => chip(...OS[s]);
function payChip(o) { const [t, c] = PAYS[o.pay.status]; return `<span class="chip ${c}">${o.pay.method === 'cod' ? 'COD' : 'Online'} · ${t}</span>`; }

/* ── toast ───────────────────────────────────────────────────────────── */
const toastHost = $('#toasts');
function toast({ title, sub = '', kind = '', sticky = false, role, html = '', timeout = 4800 }) {
  const t = el('div', 'toast ' + kind);
  if (role) t.setAttribute('role', role);
  t.innerHTML = `${icon(kind === 'warn' ? 'clock' : 'check')}<div><div class="t-title">${title}</div>${sub ? `<div class="t-sub">${sub}</div>` : ''}${html}</div><button class="x" type="button" aria-label="Dismiss notification">${icon('x', 'sm')}</button>`;
  toastHost.appendChild(t);
  let timer;
  const dismiss = () => { clearTimeout(timer); if (!t.isConnected) return; if (reduceMotion) { t.remove(); return; } t.classList.add('out'); t.addEventListener('animationend', () => t.remove(), { once: true }); setTimeout(() => t.remove(), 400); };
  $('.x', t).addEventListener('click', dismiss);
  if (!sticky) {
    const arm = () => { timer = setTimeout(dismiss, timeout); };
    arm(); t.addEventListener('pointerenter', () => clearTimeout(timer)); t.addEventListener('pointerleave', arm);
  }
  return { el: t, dismiss };
}

/* ── confirm dialog ──────────────────────────────────────────────────── */
function confirmDlg({ title, body = '', rows = [], ok = 'Confirm', danger = false }) {
  return new Promise(res => {
    const d = el('dialog', 'confirm'); d.setAttribute('aria-labelledby', 'dlg-t');
    d.innerHTML = `<form method="dialog"><div class="dlg-body"><h2 id="dlg-t">${title}</h2>${body ? `<p>${body}</p>` : ''}${rows.length ? `<dl class="dlg-list">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}</div><div class="dlg-foot"><button class="btn" value="no" type="submit">Go back</button><button class="btn ${danger ? 'danger solid' : 'primary'}" value="yes" type="submit">${ok}</button></div></form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => { const yes = d.returnValue === 'yes'; d.remove(); res(yes); });
    d.addEventListener('click', e => { if (e.target === d) d.close('no'); });
    d.showModal();
  });
}

/* ── drawer ──────────────────────────────────────────────────────────── */
let activeDrawer = null, drawerSeq = 0;
function Drawer({ wide = false } = {}) {
  const id = 'dr' + (++drawerSeq);
  const scrim = el('div', 'scrim'), d = el('aside', 'drawer' + (wide ? ' wide' : ''));
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', id + '-t');
  d.innerHTML = `<div class="drawer-head"><div><h2 id="${id}-t" tabindex="-1"></h2><p></p></div><button class="btn ghost icon-only" type="button" aria-label="Close panel (Esc)" data-close>${icon('x')}</button></div><div class="drawer-body"></div><div class="drawer-foot" hidden></div>`;
  document.body.append(scrim, d);
  const api = {
    el: d, opener: null, isOpen: false, beforeClose: null,
    set({ title, sub = '', body, foot }) {
      $('h2', d).innerHTML = title; $('.drawer-head p', d).innerHTML = sub; $('.drawer-body', d).innerHTML = body;
      const f = $('.drawer-foot', d); f.hidden = !foot; f.innerHTML = foot || '';
    },
    open(opener) {
      api.opener = opener || document.activeElement; api.isOpen = true; activeDrawer = api;
      shellEl.inert = true; scrim.classList.add('open'); d.classList.add('open');
      const f = () => ($('[data-autofocus]', d) || $('[data-close]', d)).focus(); const go = () => { if (!d.contains(document.activeElement)) f(); }; requestAnimationFrame(() => { f(); requestAnimationFrame(go); }); setTimeout(go, 80); setTimeout(go, 300);
    },
    focusTitle() { $('h2', d).focus(); },
    async close(force) {
      if (!api.isOpen) return;
      if (!force && api.beforeClose && !(await api.beforeClose())) return;
      api.isOpen = false; if (activeDrawer === api) activeDrawer = null;
      d.classList.remove('open'); scrim.classList.remove('open'); shellEl.inert = false;
      if (api.opener && api.opener.isConnected) api.opener.focus(); else $('#main').focus();
      if (api.onClose) api.onClose();
    },
  };
  scrim.addEventListener('click', () => api.close());
  d.addEventListener('click', e => { if (e.target.closest('[data-close]')) api.close(); });
  d.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = $$('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', d).filter(x => x.offsetParent !== null);
    if (!f.length) return; const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });
  return api;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && activeDrawer && !$('dialog[open]')) { e.preventDefault(); activeDrawer.close(); }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('dialog[open]') && !activeDrawer) { const q = $('#q'); if (q) { e.preventDefault(); q.focus(); q.select(); } }
});

/* ── table keyboard model ────────────────────────────────────────────── */
function rowNav(tbody, openFn) {
  tbody.addEventListener('keydown', e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr || e.target !== tr) return;
    const rs = $$('tr[data-id]', tbody), i = rs.indexOf(tr); let n = null;
    if (e.key === 'ArrowDown') n = rs[i + 1] || tr; else if (e.key === 'ArrowUp') n = rs[i - 1] || tr; else if (e.key === 'Home') n = rs[0];
    else if (e.key === 'End') n = rs[rs.length - 1]; else if (e.key === 'PageDown') n = rs[Math.min(i + 8, rs.length - 1)]; else if (e.key === 'PageUp') n = rs[Math.max(i - 8, 0)];
    else if (e.key === 'Enter') { e.preventDefault(); openFn(tr.dataset.id, tr); return; }
    if (n) { e.preventDefault(); rs.forEach(r => r.tabIndex = -1); n.tabIndex = 0; n.focus(); n.scrollIntoView({ block: 'nearest' }); }
  });
  tbody.addEventListener('click', e => { if (e.target.closest('button,a,input,.sw,label') && !e.target.closest('.id-btn')) return; const tr = e.target.closest('tr[data-id]'); if (tr) openFn(tr.dataset.id, tr); });
}
function refocusRow(tbody, id) { const r = $('tr[data-id="' + id + '"]', tbody); if (!r) return false; $$('tr[data-id]', tbody).forEach(x => x.tabIndex = -1); r.tabIndex = 0; r.focus(); return true; }
const armRows = tbody => { const f = $('tr[data-id]', tbody); if (f) f.tabIndex = 0; };

/* ── idle timeout (30 min, warning at 28) ────────────────────────────── */
const IDLE = 30 * 60e3, WARN = 28 * 60e3;
let lastActive = Date.now(), deadline = 0, previewing = false, idleToast = null;
const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function showIdle(ms, preview) {
  if (idleToast) return;
  previewing = preview; deadline = Date.now() + ms;
  idleToast = toast({
    title: 'Still there?', kind: 'warn', sticky: true, role: 'alertdialog',
    sub: `You will be signed out in <span class="clock" id="idle-clock">${fmtClock(ms)}</span> because of inactivity.${preview ? ' (Preview: nobody is signed out.)' : ''}`,
    html: `<div class="toast-actions"><button class="btn" type="button" data-stay>Stay signed in</button><button class="btn quiet" type="button" data-out>Sign out now</button></div>`,
  });
  $('[data-stay]', idleToast.el).addEventListener('click', stay);
  $('[data-out]', idleToast.el).addEventListener('click', () => { endIdle(); signOut('You chose to sign out.'); });
  $('[data-stay]', idleToast.el).focus({ preventScroll: true });
}
function endIdle() { if (idleToast) idleToast.dismiss(); idleToast = null; deadline = 0; }
function stay() { const wasPreview = previewing; endIdle(); lastActive = Date.now(); toast({ title: wasPreview ? 'Preview ended' : 'Session extended', sub: 'Your 30 minutes start again.' }); }
function signOut(why) {
  const o = el('div', 'signed-out'); o.setAttribute('role', 'alertdialog'); o.setAttribute('aria-labelledby', 'so-t');
  o.innerHTML = `<div><img src="../assets/brand/aarvion-mark.svg" alt="" width="64" height="14"><h2 id="so-t">You have been signed out</h2><p>${why || 'Your session ended after 30 minutes without activity.'} Unsaved changes in the open form were not saved. Sign in again with an OTP to continue.</p><a class="btn primary" href="index.html" id="so-btn">Sign in again</a></div>`;
  $$('dialog[open]').forEach(d => d.close('no')); document.body.appendChild(o); shellEl.inert = true; $$('.drawer, .scrim, #toasts').forEach(x => { x.inert = true; }); $('#so-btn', o).focus();
}
['pointerdown', 'keydown', 'wheel'].forEach(ev => document.addEventListener(ev, () => { if (!idleToast) lastActive = Date.now(); }, { passive: true }));
setInterval(() => {
  const now = Date.now();
  if (!idleToast && now - lastActive >= WARN) showIdle(IDLE - (now - lastActive), false);
  if (idleToast) {
    const rem = deadline - now, c = $('#idle-clock'); if (c) c.textContent = fmtClock(rem);
    if (rem <= 0) { const p = previewing; endIdle(); if (p) toast({ title: 'Preview ended', sub: 'In a real session you would now be signed out.' }); else signOut(); }
  }
}, 1000);

/* ── nav badges ──────────────────────────────────────────────────────── */
function badges() {
  const rxN = S.rx.filter(r => r.status === 'awaiting').length, opN = S.orders.filter(o => o.status === 'confirmed' || o.status === 'packed').length;
  [['prescriptions', rxN, 'prescriptions awaiting review'], ['orders', opN, 'orders to pack or ship']].forEach(([k, n, l]) => { const b = $(`[data-badge="${k}"]`); if (!b) return; b.hidden = !n; b.textContent = n; b.setAttribute('aria-label', `${n} ${l}`); });
}

/* ── form helpers ────────────────────────────────────────────────────── */
function fieldHTML({ id, label, type = 'text', value = '', hint = '', attrs = '', cls = '', tag = 'input' }) {
  const ctl = tag === 'textarea' ? `<textarea class="input" id="${id}" name="${id}" aria-describedby="${id}-h ${id}-e" ${attrs}>${esc(value)}</textarea>` : `<input class="input" id="${id}" name="${id}" type="${type}" value="${esc(value)}" aria-describedby="${id}-h ${id}-e" ${attrs}>`;
  return `<div class="field ${cls}" data-f="${id}"><label for="${id}">${label}</label>${ctl}<span class="hint" id="${id}-h">${hint}</span><span class="err" id="${id}-e"></span></div>`;
}
function setErr(root, id, msg) {
  const f = $(`[data-f="${id}"]`, root); if (!f) return !msg;
  f.classList.toggle('invalid', !!msg);
  const c = $('input,select,textarea', f); if (c) c.setAttribute('aria-invalid', msg ? 'true' : 'false');
  $('.err', f).innerHTML = msg ? icon('alert', 'sm') + `<span>${msg}</span>` : '';
  return !msg;
}
const firstInvalid = root => { const f = $('.field.invalid input, .field.invalid select, .field.invalid textarea', root); if (f) f.focus(); return !!f; };

/* ════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════════════════ */
function dashboard() {
  $('#today-line').textContent = new Date(NOW).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) + '. Counts below come from the example data.';
  const rx = S.rx.filter(r => r.status === 'awaiting').sort((a, b) => a.up - b.up);
  const pack = S.orders.filter(o => o.status === 'confirmed').sort((a, b) => a.t.confirmed - b.t.confirmed);
  const ship = S.orders.filter(o => o.status === 'packed').sort((a, b) => a.t.packed - b.t.packed);
  const today = S.orders.filter(o => new Date(o.t.placed).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayISO);
  const set = (k, n, sub) => { $(`[data-count="${k}"]`).textContent = n; $(`[data-sub="${k}"]`).textContent = sub; };
  set('rx', rx.length, rx.length ? 'Oldest waiting ' + ageOf(rx[0].up) : 'Queue is clear');
  set('pack', pack.length, pack.length ? 'Oldest confirmed ' + ageOf(pack[0].t.confirmed) : 'Nothing to pack');
  set('ship', ship.length, ship.length ? 'Oldest packed ' + ageOf(ship[0].t.packed) : 'Nothing to ship');
  set('today', today.length, `${today.filter(o => o.pay.method === 'online').length} online, ${today.filter(o => o.pay.method === 'cod').length} COD`);
  $('#dash-rx').innerHTML = rx.slice(0, 5).map(r => { const o = orderBy(r.orders[0]); return `<tr data-id="${r.id}"><td><span class="id">${r.id}</span></td><td>${esc(CUST[o.cust][0])}</td><td class="num">${ordCell(r)}</td><td class="r age">${ageOf(r.up)}</td><td class="r"><a class="btn sm" href="prescriptions.html#${r.id}" tabindex="-1">Review</a></td></tr>`; }).join('') || `<tr><td colspan="5" class="empty">No prescriptions waiting.</td></tr>`;
  $('#dash-pack').innerHTML = pack.slice(0, 5).map(o => `<tr data-id="${o.id}"><td><span class="id">${o.id}</span></td><td>${esc(CUST[o.cust][0])}</td><td class="clip">${esc(itemsText(o))}</td><td>${payChip(o)}</td><td class="r age">${ageOf(o.t.confirmed)}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">Nothing to pack.</td></tr>`;
  rowNav($('#dash-rx'), id => location.href = 'prescriptions.html#' + id); armRows($('#dash-rx'));
  rowNav($('#dash-pack'), id => location.href = 'orders.html#' + id); armRows($('#dash-pack'));
  $('#feed').innerHTML = S.feed.slice(0, 8).map(f => `<li><span class="ico ${f.kind === 'ok' ? '' : f.kind}">${icon(f.ic, 'sm')}</span><div>${esc(f.text)}<div class="who">${esc(f.who)}</div></div><time datetime="${new Date(f.ts).toISOString()}">${ageOf(f.ts)} ago</time></li>`).join('');
  $('#preview-idle').addEventListener('click', () => showIdle(120e3, true));
  if (debug === 'idle-warning') showIdle(108e3, true);
}

/* ════════════════════════════════════════════════════════════════════════
   PRESCRIPTIONS
   ════════════════════════════════════════════════════════════════════════ */
function prescriptions() {
  const listV = $('#view-list'), revV = $('#view-review');
  let filter = 'awaiting', q = '';
  const body = $('#rx-body');
  const counts = () => ({ all: S.rx.length, awaiting: S.rx.filter(r => r.status === 'awaiting').length, approved: S.rx.filter(r => r.status === 'approved').length, rejected: S.rx.filter(r => r.status === 'rejected').length });
  function renderFilter() {
    const c = counts();
    $('#rx-filter').innerHTML = [['awaiting', 'Awaiting review'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']].map(([k, l]) => `<button type="button" aria-pressed="${filter === k}" data-k="${k}">${l} <span class="n">${c[k]}</span></button>`).join('');
  }
  function renderList() {
    renderFilter(); badges();
    const rows = S.rx.filter(r => (filter === 'all' || r.status === filter) && (!q || (r.id + ' ' + r.orders.join(' ') + ' ' + CUST[orderBy(r.orders[0]).cust][0]).toLowerCase().includes(q))).sort((a, b) => a.up - b.up);
    body.innerHTML = rows.map(r => { const o = orderBy(r.orders[0]); return `<tr data-id="${r.id}"><td><button class="id-btn" type="button" tabindex="-1" aria-label="Open ${r.id}"><span class="id">${r.id}</span></button></td><td>${esc(CUST[o.cust][0])}<span class="sub">${esc(CUST[o.cust][1])}</span></td><td class="num">${ordCell(r)}</td><td><span style="display:inline-flex;gap:.375rem;align-items:center">${icon(r.type === 'pdf' ? 'file' : 'image', 'sm')}${r.type === 'pdf' ? 'PDF' : 'Photo'}</span></td><td class="num">${fmtShort(r.up)}</td><td class="r age">${r.status === 'awaiting' ? ageOf(r.up) : '<span aria-label="decided">–</span>'}</td><td>${rxChip(r.status)}</td></tr>`; }).join('') || `<tr><td colspan="7"><div class="empty"><strong>No prescriptions match.</strong>Try another status or clear the search.</div></td></tr>`;
    $('#rx-count').textContent = `${rows.length} of ${S.rx.length} prescriptions, oldest first`;
    armRows(body);
  }
  $('#rx-filter').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { filter = b.dataset.k; renderList(); $(`#rx-filter [data-k="${filter}"]`).focus(); } });
  $('#q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); renderList(); });
  rowNav(body, id => { location.hash = id; });

  /* review screen */
  function route() {
    const id = location.hash.slice(1);
    if (/^RX-\d+$/.test(id) && rxBy(id)) { listV.hidden = true; revV.hidden = false; review(rxBy(id)); window.scrollTo(0, 0); }
    else { const had = !revV.hidden; revV.hidden = true; listV.hidden = false; renderList(); if (had) { const rs = $$('tr[data-id]', body), last = $(`tr[data-id="${revV.dataset.rx}"]`, body), next = last || rs[Math.min(+revV.dataset.idx || 0, rs.length - 1)]; if (next) { rs.forEach(r => r.tabIndex = -1); next.tabIndex = 0; next.focus(); } else $('#list-h1').focus(); } }
  }
  window.addEventListener('hashchange', route);

  function review(r) {
    revV.dataset.rx = r.id; revV.dataset.idx = Math.max(0, $$('tr[data-id]', body).findIndex(x => x.dataset.id === r.id));
    const o0 = orderBy(r.orders[0]), cust = CUST[o0.cust], m = me();
    r.views = r.views || []; const prev = r.views.slice(); const viewNow = { by: m.name, ts: Date.now() }; r.views.push(viewNow); audit('Viewed prescription', r.id);
    const isPdf = r.type === 'pdf', pharmacist = can('rx.decide');
    const orders = r.orders.map(orderBy);
    const itemsPanel = `<section class="panel" aria-labelledby="it-h"><div class="panel-head"><h2 id="it-h">Order items</h2><span class="muted">${esc(cust[0])}, ${esc(cust[1])}</span></div><div class="panel-body" style="display:grid;gap:.75rem;padding:.75rem 1rem">${orders.map(o => `<div><p style="display:flex;justify-content:space-between;gap:.5rem;margin-bottom:.375rem;flex-wrap:wrap"><a href="orders.html#${o.id}" class="id mono" style="font-weight:600">${o.id}</a><span>${payChip(o)}</span></p><table class="mini-tbl"><thead><tr><th scope="col">Medicine</th><th scope="col" class="r">Qty</th><th scope="col" class="r">Rate</th><th scope="col" class="r">Amount</th></tr></thead><tbody>${o.items.map(([s, qn]) => { const p = prod(s); return `<tr><td><strong>${esc(p.name)}</strong><span class="sub muted" style="display:block;font-size:.75rem">${esc(compText(p))}</span><span class="sub muted" style="display:block;font-size:.75rem">${esc(p.pack)} · Schedule ${esc(p.sch)}</span></td><td class="r">${qn}</td><td class="r">${rupee(unit(p))}</td><td class="r">${rupee(unit(p) * qn)}</td></tr>`; }).join('')}</tbody><tfoot><tr><td colspan="3">Total (free delivery)</td><td class="r">${rupee(total(o))}</td></tr></tfoot></table></div>`).join('')}</div></section>`;

    let decision;
    if (r.status === 'awaiting') {
      const approveF = [
        fieldHTML({ id: 'a-doc', label: 'Doctor name', attrs: 'autocomplete="off" required' }),
        fieldHTML({ id: 'a-docreg', label: 'Doctor registration no.', attrs: 'autocomplete="off" required' }),
        fieldHTML({ id: 'a-date', label: 'Rx date', type: 'date', attrs: `max="${todayISO}" required` }),
        fieldHTML({ id: 'a-until', label: 'Valid until', type: 'date', hint: 'Rx date + 6 months by default.', attrs: 'required' }),
        fieldHTML({ id: 'a-pharm', label: 'Pharmacist registration no.', value: pharmacist ? m.reg : '', attrs: 'readonly', hint: pharmacist ? 'From your staff profile.' : 'Only a pharmacist profile has one.' }),
        `<div class="field" data-f="a-match" style="align-self:center"><label class="check-row"><input type="checkbox" id="a-match" aria-describedby="a-match-e"><span>Patient name, medicines and strengths match the order items</span></label><span class="err" id="a-match-e"></span></div>`,
      ].join('');
      const prepaid = orders.filter(o => o.pay.method === 'online');
      decision = `<section class="panel decision" aria-labelledby="dec-h"><div class="panel-head"><h2 id="dec-h" tabindex="-1">Decision</h2><div class="seg" role="tablist" aria-label="Decision" id="dec-tabs"><button type="button" role="tab" id="tab-a" aria-selected="true" aria-controls="f-approve">Approve</button><button type="button" role="tab" id="tab-r" aria-selected="false" aria-controls="f-reject" tabindex="-1">Reject</button></div></div>
      ${pharmacist ? '' : `<div style="padding:.75rem 1rem 0">${lockNote('rx.decide')}</div>`}
      <fieldset class="bare" ${pharmacist ? '' : 'disabled'}>
      <form id="f-approve" class="decision-body" role="tabpanel" aria-labelledby="tab-a" novalidate><div class="form-grid">${approveF}</div>
        <div class="decision-foot"><p class="consequence">${icon('info', 'sm')}<span>Moves ${orders.length > 1 ? 'the linked orders' : esc(orders[0].id)} to <strong>Confirmed</strong>.</span></p><button class="btn primary" type="submit">Review and approve</button></div></form>
      <form id="f-reject" class="decision-body" role="tabpanel" aria-labelledby="tab-r" novalidate hidden>
        <div class="field" data-f="r-reason"><label for="r-reason">Reason</label><select class="select" id="r-reason" aria-describedby="r-reason-e"><option value="">Choose a reason</option><option value="illegible">Illegible or blurry</option><option value="regno">Doctor registration no. missing</option><option value="sign">Doctor signature or stamp missing</option><option value="expired">Prescription expired</option><option value="mismatch">Medicine not on the prescription</option><option value="other">Other (explain in the note)</option></select><span class="err" id="r-reason-e"></span></div>
        ${fieldHTML({ id: 'r-note', label: 'Note to the customer', tag: 'textarea', hint: 'The customer sees this by SMS and email. Say what to fix.', attrs: 'rows="4"' })}
        <p class="consequence">${icon('alert', 'sm')}<span>Linked orders go <strong>On hold</strong>.${prepaid.length ? ` ${prepaid.map(o => `${o.id} (${rupee(total(o))})`).join(', ')} was paid online and will be flagged for refund.` : ' No refund is due; the orders are cash on delivery.'}</span></p>
        <div class="decision-foot"><span></span><button class="btn danger" type="submit">Review and reject</button></div></form>
      </fieldset></section>`;
    } else {
      const d = r.decision;
      decision = `<section class="panel" aria-labelledby="dec-h"><div class="panel-head"><h2 id="dec-h" tabindex="-1">Decision</h2>${rxChip(r.status)}</div><div class="panel-body decided">${r.status === 'approved'
        ? `<dl class="kv"><dt>Doctor</dt><dd>${esc(d.doctor)}</dd><dt>Doctor reg. no.</dt><dd>${esc(d.docReg)}</dd><dt>Rx date</dt><dd>${dmy(d.rxDate)}</dd><dt>Valid until</dt><dd>${dmy(d.validUntil)}</dd><dt>Pharmacist</dt><dd>${esc(d.by)}, reg. ${esc(d.pharmReg)}</dd><dt>Checked</dt><dd>${d.matched ? 'Patient, medicines and strengths match the order items' : '–'}</dd><dt>Decided</dt><dd>${fmt(d.at)}</dd></dl>`
        : `<dl class="kv"><dt>Reason</dt><dd>${esc(REASONS[d.reason])}</dd><dt>Note sent</dt><dd>${esc(d.note)}</dd><dt>Decided</dt><dd>${esc(d.by)}, ${fmt(d.at)}</dd></dl>`}
        <p class="muted">Decisions are final here and are written to the audit trail.</p></div></section>`;
    }

    const auditHTML = `<p class="audit-line" id="audit">${icon('clock', 'sm')}<span>Viewed by <strong>${esc(m.name)}</strong> (${ROLE[m.role]}) at ${fmt(viewNow.ts)}</span>${prev.length ? `<span>· Earlier: ${esc(prev[prev.length - 1].by)}, ${fmtShort(prev[prev.length - 1].ts)}</span>` : ''}<span>· Logged to the audit trail</span></p>`;
    revV.innerHTML = `<div class="rv-head"><a class="back" href="#" id="back">${icon('back', 'sm')} Queue</a><a class="skip" href="#dec-h">Skip to decision</a><h1 class="mono" tabindex="-1" id="rv-h1">${r.id}</h1>${rxChip(r.status)}<span class="muted">${esc(cust[0])} · uploaded ${fmt(r.up)}${r.status === 'awaiting' ? ' · waiting ' + ageOf(r.up) : ''}</span></div>
    <div class="rv-grid"><div>${viewerHTML(r, orders, auditHTML)}</div><div class="stack">${itemsPanel}${decision}</div></div>`;
    $('#back').addEventListener('click', e => { e.preventDefault(); location.hash = ''; });
    $('#rv-h1').focus({ preventScroll: true });
    wireViewer(isPdf);
    if (r.status === 'awaiting') wireDecision(r, orders, pharmacist);
  }

  const REASONS = { illegible: 'Illegible or blurry', regno: 'Doctor registration no. missing', sign: 'Doctor signature or stamp missing', expired: 'Prescription expired', mismatch: 'Medicine not on the prescription', other: 'Other' };
  const TEMPLATES = {
    illegible: 'The photo of your prescription is too blurry for us to read the medicine names. Please upload a clear photo with all four corners visible.',
    regno: 'We could not find your doctor’s registration number on the prescription. Please upload one that shows it, or ask your doctor to add it.',
    sign: 'The prescription has no doctor signature or stamp. Please upload a signed and stamped copy.',
    expired: 'This prescription is more than 6 months old, so we cannot dispense against it. Please upload a recent prescription from your doctor.',
    mismatch: 'One or more medicines in your order are not on the uploaded prescription. Please upload the prescription that lists them, or remove those items.',
    other: '',
  };

  function viewerHTML(r, orders, auditHTML) {
    const fname = `rx-${r.id.slice(3)}-${r.type === 'pdf' ? 'upload.pdf' : 'photo.jpg'}`;
    const lines = orders.flatMap(o => o.items.map(([s, q]) => prod(s))).filter((p, i, a) => a.indexOf(p) === i);
    const sheet = `<div class="sheet-box" id="sbox"><div class="sheet" id="sheet" role="img" aria-label="Example prescription image from ${esc(r.doc[0])}, dated ${dmy(r.sheetDate)}, listing ${lines.map(p => esc(p.name)).join(', ')}">
      <div class="lh"><div><b>${esc(r.doc[3].split(',')[0])}</b><span>${esc(r.doc[0])}, ${esc(r.doc[1])}</span><span>Reg. no. ${esc(r.doc[2])}</span></div><div style="text-align:right"><span>${esc(r.doc[3].split(',')[1] || '')}</span></div></div>
      <div class="row2"><span>Patient: <strong>${esc(CUST[orderBy(r.orders[0]).cust][0])}</strong></span><span>Date: <strong>${dmy(r.sheetDate)}</strong></span></div>
      <div class="rxs">℞</div>
      <ol>${lines.map(p => `<li>${p.form.toLowerCase().includes('drop') ? 'Eye drops' : 'Tab.'} ${esc(p.name)}<br>${p.form.toLowerCase().includes('drop') ? '1 drop in both eyes, 4 times a day' : '1 tablet, twice a day after food'} · 30 days</li>`).join('')}</ol>
      <div class="sig"><svg viewBox="0 0 140 44" aria-hidden="true"><path d="M6 32c10-26 16-28 14-12-2 14 8 12 16-6 6 10 14 12 22-4 8-14 4 12 18 6 14-6 20-8 34-2"/></svg><span>Signature and stamp</span></div>
      <div class="wm" aria-hidden="true">EXAMPLE</div></div></div>`;
    const stage = isPdfType(r) ? `<iframe class="pdf-frame" id="pdf" title="Prescription PDF, ${esc(fname)}" sandbox srcdoc="${esc(`<!doctype html><meta charset=utf-8><body style='margin:0;font:14px system-ui;background:#e9ecea;display:grid;place-items:center;height:100vh;color:#2a302d'><div style='background:#fff;padding:32px 40px;box-shadow:0 6px 18px rgba(0,0,0,.15);text-align:center'><b>Sandboxed PDF frame (placeholder)</b><br><br>Example prescription PDF, page 1 of 2.<br>In production the signed file URL loads here,<br>with scripts and forms disabled.</div></body>`)}"></iframe>`
      : `<div class="viewer-stage" id="stage" tabindex="0" role="region" aria-label="Prescription image. Press plus or minus to zoom, R to rotate, 0 to fit.">${sheet}</div>`;
    return `<section class="viewer" aria-label="Prescription file"><div class="viewer-bar"><span class="fname">${icon(r.type === 'pdf' ? 'file' : 'image', 'sm')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(fname)}</span></span>
      ${isPdfType(r) ? '<span class="muted" style="font-size:.75rem">PDF opens in a sandboxed frame</span>' : `<button class="btn ghost icon-only" type="button" id="z-out" aria-label="Zoom out">${icon('zoomout')}</button><span class="zoom" id="z-val" aria-live="polite">100%</span><button class="btn ghost icon-only" type="button" id="z-in" aria-label="Zoom in">${icon('zoomin')}</button><button class="btn ghost icon-only" type="button" id="z-fit" aria-label="Fit to width">${icon('fit')}</button><button class="btn ghost icon-only" type="button" id="r-ccw" aria-label="Rotate left">${icon('rotccw')}</button><button class="btn ghost icon-only" type="button" id="r-cw" aria-label="Rotate right">${icon('rotcw')}</button>`}</div>
      ${stage}<div class="viewer-note">Example image, not a real prescription. Compare the doctor, date and every medicine with the order items.${auditHTML}</div></section>`;
  }
  const isPdfType = r => r.type === 'pdf';

  function wireViewer(isPdf) {
    if (isPdf) return;
    const stage = $('#stage'), box = $('#sbox'), sheet = $('#sheet'), W = 560, H = 736, steps = [0.4, 0.5, 0.65, 0.8, 1, 1.25, 1.5, 2, 3];
    let z = 1, rot = 0;
    const fit = () => Math.min(1.5, Math.max(0.3, (stage.clientWidth - 40) / (rot % 180 ? H : W)));
    function apply() { const sw = rot % 180 ? H : W, sh = rot % 180 ? W : H; box.style.width = sw * z + 'px'; box.style.height = sh * z + 'px'; sheet.style.transform = `translate(-50%,-50%) rotate(${rot}deg) scale(${z})`; $('#z-val').textContent = Math.round(z * 100) + '%'; }
    const zoom = dir => { const i = steps.findIndex(s => s >= z - 0.001); z = steps[Math.max(0, Math.min(steps.length - 1, dir > 0 ? (steps[i] > z + 0.001 ? i : i + 1) : i - 1))]; apply(); };
    z = fit(); apply();
    $('#z-in').addEventListener('click', () => zoom(1)); $('#z-out').addEventListener('click', () => zoom(-1));
    $('#z-fit').addEventListener('click', () => { z = fit(); apply(); });
    $('#r-cw').addEventListener('click', () => { rot = (rot + 90) % 360; apply(); }); $('#r-ccw').addEventListener('click', () => { rot = (rot + 270) % 360; apply(); });
    stage.addEventListener('keydown', e => {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(1); } else if (e.key === '-') { e.preventDefault(); zoom(-1); } else if (e.key === '0') { e.preventDefault(); z = fit(); apply(); }
      else if (e.key === 'r') { rot = (rot + 90) % 360; apply(); } else if (e.key === 'R') { rot = (rot + 270) % 360; apply(); }
    });
  }

  function wireDecision(r, orders, pharmacist) {
    const tabs = $$('#dec-tabs [role="tab"]'), fa = $('#f-approve'), fr = $('#f-reject');
    function pick(which) {
      tabs.forEach(t => { const on = t.id === 'tab-' + which; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
      fa.hidden = which !== 'a'; fr.hidden = which !== 'r';
    }
    tabs.forEach(t => t.addEventListener('click', () => pick(t.id.slice(4))));
    $('#dec-tabs').addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const w = e.target.id === 'tab-a' ? 'r' : 'a'; pick(w); $('#tab-' + w).focus(); } });
    // approve
    const date = $('#a-date'), until = $('#a-until'); let untilTouched = false;
    until.addEventListener('input', () => { untilTouched = true; });
    date.addEventListener('input', () => { if (!untilTouched || !until.value) { until.value = plus6(date.value); untilTouched = false; } });
    function validateA() {
      const v = id => $('#' + id).value.trim(); let ok = true;
      ok = setErr(fa, 'a-doc', v('a-doc').length < 3 ? 'Enter the doctor’s name as printed.' : '') && ok;
      ok = setErr(fa, 'a-docreg', !/^[A-Za-z0-9][A-Za-z0-9\/\-\. ]{3,}$/.test(v('a-docreg')) ? 'Enter the doctor’s registration number (at least 4 characters).' : '') && ok;
      ok = setErr(fa, 'a-date', !v('a-date') ? 'Enter the date on the prescription.' : v('a-date') > todayISO ? 'The Rx date cannot be in the future.' : '') && ok;
      ok = setErr(fa, 'a-until', !v('a-until') ? 'Enter a valid-until date.' : v('a-date') && v('a-until') <= v('a-date') ? 'Valid until must be after the Rx date.' : v('a-until') < todayISO ? 'This prescription has already expired. Reject it as expired instead.' : '') && ok;
      ok = setErr(fa, 'a-match', !$('#a-match').checked ? 'Tick this once you have compared the file with the order items.' : '') && ok;
      ok = setErr(fa, 'a-pharm', !v('a-pharm') ? 'No pharmacist registration number on your profile.' : '') && ok;
      return ok;
    }
    fa.addEventListener('submit', async e => {
      e.preventDefault(); if (!validateA()) { firstInvalid(fa); return; }
      const v = id => $('#' + id).value.trim();
      const go = await confirmDlg({ title: `Approve ${r.id}?`, body: `${orders.map(o => o.id).join(', ')} will move to <strong>Confirmed</strong> and can be packed. This is logged against your registration number and cannot be undone here.`, ok: 'Approve prescription', rows: [['Checked', 'Patient, medicines and strengths match the order items'], ['Doctor', esc(v('a-doc'))], ['Doctor reg. no.', esc(v('a-docreg'))], ['Rx date', dmy(v('a-date'))], ['Valid until', dmy(v('a-until'))], ['Pharmacist reg. no.', esc(v('a-pharm'))]] });
      if (!go) return;
      r.status = 'approved'; r.decision = { by: me().name, at: Date.now(), doctor: v('a-doc'), docReg: v('a-docreg'), rxDate: v('a-date'), validUntil: v('a-until'), pharmReg: v('a-pharm'), matched: true };
      const moved = [];
      orders.forEach(o => { if (o.status === 'placed' && (o.pay.method === 'cod' || o.pay.status === 'paid')) { o.status = 'confirmed'; o.t.confirmed = Date.now(); moved.push(o.id); } });
      pushFeed('ok', 'rx', `Rx ${r.id} approved${moved.length ? '. ' + moved.join(', ') + ' confirmed' : ''}`); save();
      location.hash = ''; toast({ title: `${r.id} approved`, sub: moved.length ? `${moved.join(', ')} moved to Confirmed.` : 'Logged to the audit trail.' });
    });
    // reject
    const sel = $('#r-reason'), note = $('#r-note'); let noteEdited = false;
    note.addEventListener('input', () => { noteEdited = true; });
    sel.addEventListener('change', () => { if (!noteEdited || !note.value.trim()) { note.value = TEMPLATES[sel.value] || ''; noteEdited = false; } });
    fr.addEventListener('submit', async e => {
      e.preventDefault(); let ok = true;
      ok = setErr(fr, 'r-reason', !sel.value ? 'Choose why the prescription is rejected.' : '') && ok;
      ok = setErr(fr, 'r-note', note.value.trim().length < 15 ? 'Write a note the customer can act on (at least a sentence).' : '') && ok;
      if (!ok) { firstInvalid(fr); return; }
      const prepaid = orders.filter(o => o.pay.method === 'online' && o.pay.status === 'paid');
      const go = await confirmDlg({ title: `Reject ${r.id}?`, danger: true, ok: 'Reject prescription', body: `${orders.map(o => o.id).join(', ')} will go <strong>On hold</strong>${prepaid.length ? ` and ${prepaid.map(o => o.id).join(', ')} will be flagged for a refund of ${rupee(prepaid.reduce((s, o) => s + total(o), 0))}` : ''}. The customer is notified with your note.`, rows: [['Reason', esc(REASONS[sel.value])], ['Note', esc(note.value.trim())]] });
      if (!go) return;
      r.status = 'rejected'; r.decision = { by: me().name, at: Date.now(), reason: sel.value, note: note.value.trim() };
      orders.forEach(o => { if (o.status === 'placed') { o.status = 'hold'; o.t.hold = Date.now(); if (o.pay.method === 'online' && o.pay.status === 'paid') o.pay.status = 'refund_due'; } });
      pushFeed('danger', 'x', `Rx ${r.id} rejected: ${REASONS[sel.value].toLowerCase()}. ${orders.map(o => o.id).join(', ')} on hold`); save();
      location.hash = ''; toast({ title: `${r.id} rejected`, sub: `${orders.map(o => o.id).join(', ')} on hold${prepaid.length ? ', refund flagged' : ''}.`, kind: 'warn' });
    });
    // debug presets
    if (debug === 'rx-review-open' || debug === 'rx-confirm') {
      $('#a-doc').value = r.doc[0]; $('#a-docreg').value = r.doc[2]; date.value = r.sheetDate; until.value = plus6(r.sheetDate);
      if (debug === 'rx-confirm') { $('#a-match').checked = true; fa.requestSubmit(); }
    }
    if (debug === 'rx-reject') { pick('r'); sel.value = 'mismatch'; note.value = TEMPLATES.mismatch; setErr(fr, 'r-reason', ''); }
  }

  route();
  if (!location.hash && debug && /^rx-/.test(debug)) { history.replaceState(null, '', '#' + S.rx.filter(r => r.status === 'awaiting').sort((a, b) => a.up - b.up)[0].id); route(); }
}

/* ════════════════════════════════════════════════════════════════════════
   ORDERS
   ════════════════════════════════════════════════════════════════════════ */
function actionsFor(o, shipOpenFlag) {
  const rx = rxBy(o.rx), A = [], B = [];
  const payOK = o.pay.method === 'cod' || o.pay.status === 'paid';
  const expired = rx.status === 'approved' && rx.decision.validUntil < todayISO;
  const rxBlock = `Prescription ${rx.id} expired on ${dmy(rx.decision && rx.decision.validUntil)}. A valid prescription is needed to continue.`;
  if (o.status === 'placed') {
    if (rx.status === 'approved' && payOK && !expired) A.push({ id: 'confirm', label: 'Confirm order' });
    else if (expired) B.push(rxBlock);
    else B.push(rx.status !== 'approved' ? `Confirming needs an approved prescription (${rx.id} is ${RXS[rx.status][0].toLowerCase()}).` : 'Confirming needs payment, or cash on delivery.');
  }
  if (o.status === 'hold') B.push(`Waiting on a new prescription. ${rx.id} was rejected.`);
  if (o.status === 'confirmed') { if (expired) B.push(rxBlock); else A.push({ id: 'pack', label: 'Mark packed' }); }
  if (o.status === 'packed' && expired) B.push(rxBlock);
  else if (o.status === 'packed' && !shipOpenFlag) A.push({ id: 'ship', label: 'Mark shipped…' });
  if (o.status === 'packed' && shipOpenFlag && !expired) B.push('Add the courier details below to ship this order.');
  if (o.status === 'shipped') A.push({ id: 'deliver', label: 'Mark delivered' });
  if (o.pay.method === 'cod' && o.pay.status === 'due') { if (o.status === 'shipped' || o.status === 'delivered') A.push({ id: 'cod', label: `Mark COD collected (${rupee(total(o))})` }); else if (!['cancelled', 'hold'].includes(o.status)) B.push('COD is collected on delivery.'); }
  if (o.pay.method === 'online' && o.pay.status === 'refund_due') A.push({ id: 'refund', label: `Refund ${rupee(total(o))} via Razorpay`, tone: 'primary' });
  if (['placed', 'hold', 'confirmed'].includes(o.status)) A.push({ id: 'cancel', label: 'Cancel order', tone: 'danger' });
  else if (['packed', 'shipped', 'delivered'].includes(o.status)) B.push('Cancelling is only possible until the order is packed.');
  if (!A.length && o.status === 'delivered') B.unshift('Delivered. No further steps.');
  if (o.status === 'cancelled' && o.pay.status === 'refunded') B.unshift('Cancelled and refunded. No further steps.');
  return { A, B };
}

function orders() {
  const body = $('#o-body'); let status = params.get('status') || '', q = '', pay = '', rxf = '';
  const drawer = Drawer(); let cur = null, shipOpen = false;
  const STATUSES = [['', 'All'], ['placed', 'Placed'], ['hold', 'On hold'], ['confirmed', 'To pack'], ['packed', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
  function renderFilter() { $('#o-status').innerHTML = STATUSES.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${status === k}">${l} <span class="n">${k ? S.orders.filter(o => o.status === k).length : S.orders.length}</span></button>`).join(''); }
  function render() {
    renderFilter(); badges();
    const rows = S.orders.filter(o => (!status || o.status === status) && (!pay || o.pay.method === pay) && (!rxf || rxBy(o.rx).status === rxf) && (!q || (o.id + ' ' + CUST[o.cust][0] + ' ' + o.items.map(([s]) => prod(s).name).join(' ')).toLowerCase().includes(q))).sort((a, b) => b.t.placed - a.t.placed);
    body.innerHTML = rows.map(o => `<tr data-id="${o.id}"${cur === o.id ? ' aria-current="true"' : ''}><td><button class="id-btn" type="button" tabindex="-1" aria-label="Open ${o.id}"><span class="id">${o.id}</span></button></td><td>${esc(CUST[o.cust][0])}<span class="sub">${esc(CUST[o.cust][1])}</span></td><td class="clip">${esc(itemsText(o))}</td><td class="r">${rupee(total(o))}</td><td>${payChip(o)}</td><td>${rxChip(rxBy(o.rx).status)}</td><td>${orderChip(o.status)}</td><td class="r age">${ageOf(o.t.placed)}</td></tr>`).join('') || `<tr><td colspan="8"><div class="empty"><strong>No orders match.</strong>Clear a filter or the search to see more.</div></td></tr>`;
    $('#o-count').textContent = `${rows.length} of ${S.orders.length} orders`;
    armRows(body);
  }
  $('#o-status').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { status = b.dataset.k; render(); $(`#o-status [data-k="${status}"]`).focus(); } });
  $('#q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
  $('#f-pay').addEventListener('change', e => { pay = e.target.value; render(); });
  $('#f-rx').addEventListener('change', e => { rxf = e.target.value; render(); });

  function timeline(o) {
    const rx = rxBy(o.rx), t = o.t; const steps = [];
    steps.push({ s: 'Placed', ts: t.placed, st: 'done', m: payChip(o).replace(/<[^>]+>/g, '') });
    steps.push(rx.status === 'approved' ? { s: 'Prescription approved', ts: rx.decision.at, st: 'done', m: `${rx.id} · ${rx.decision.by}` } : rx.status === 'rejected' ? { s: 'Prescription rejected', ts: rx.decision.at, st: 'bad', m: `${rx.id} · ${REASONS_SHORT[rx.decision.reason]}` } : { s: 'Prescription review', st: 'now', m: `${rx.id} waiting ${ageOf(rx.up)}` });
    if (o.status === 'hold') steps.push({ s: 'On hold', ts: t.hold, st: 'bad', m: o.pay.method === 'online' ? 'Refund flagged for the customer' : 'Cash on delivery, nothing to refund' });
    else {
      [['confirmed', 'Confirmed'], ['packed', 'Packed'], ['shipped', 'Shipped'], ['delivered', 'Delivered']].forEach(([k, l]) => {
        if (t[k]) steps.push({ s: l, ts: t[k], st: 'done', m: k === 'shipped' && o.ship ? `${o.ship.courier} · AWB ${o.ship.awb}` : '' });
        else if (o.status !== 'cancelled') steps.push({ s: l, st: 'todo' });
      });
    }
    if (o.status === 'cancelled') steps.push({ s: 'Cancelled', ts: t.cancelled, st: 'bad', m: o.pay.status === 'refunded' ? 'Refunded to source' : '' });
    const firstTodo = steps.findIndex(s => s.st === 'todo'); if (firstTodo > -1 && !steps.some(s => s.st === 'now')) steps[firstTodo].st = 'now';
    return `<ol class="timeline">${steps.map(s => `<li class="${s.st}"${s.st === 'now' ? ' aria-current="step"' : ''}><span class="dot">${s.st === 'done' ? icon('check') : s.st === 'bad' ? icon('x') : ''}</span><span class="step">${s.s}<span class="meta">${esc(s.m || '')}</span></span>${s.ts ? `<time datetime="${new Date(s.ts).toISOString()}">${fmtShort(s.ts)}</time>` : '<span></span>'}</li>`).join('')}</ol>`;
  }
  const REASONS_SHORT = { illegible: 'Illegible', regno: 'No doctor reg. no.', sign: 'No signature', expired: 'Expired', mismatch: 'Medicine not listed', other: 'Other' };

  function drawerHTML(o) {
    const rx = rxBy(o.rx), cust = CUST[o.cust], perm = can('order.act'), { A, B } = actionsFor(o, shipOpen);
    const btn = a => `<button class="btn ${a.tone === 'danger' ? 'danger' : a.tone === 'primary' || ['confirm', 'pack', 'deliver'].includes(a.id) ? 'primary' : ''}" type="button" data-act="${a.id}" ${perm ? '' : 'disabled'} ${a === A[0] ? 'data-autofocus' : ''}>${a.label}</button>`;
    const rxOK = !(rx.status === 'approved' && rx.decision.validUntil < todayISO);
    const shipForm = shipOpen && o.status === 'packed' && rxOK ? `<form class="inline-form" id="ship-form" novalidate><div class="form-grid">
      <div class="field" data-f="s-courier"><label for="s-courier">Courier</label><select class="select" id="s-courier" aria-describedby="s-courier-e"><option value="">Choose a courier</option><option>Delhivery</option><option>Blue Dart</option><option>DTDC</option><option>India Post</option></select><span class="err" id="s-courier-e"></span></div>
      ${fieldHTML({ id: 's-awb', label: 'AWB number', attrs: 'autocomplete="off" inputmode="text"' })}
      ${fieldHTML({ id: 's-url', label: 'Tracking URL', type: 'url', cls: 'full', hint: 'The customer gets this link by SMS and email.', attrs: 'placeholder="https://" autocomplete="off"' })}</div>
      <div class="action-row"><button class="btn primary" type="submit">Mark shipped</button><button class="btn ghost" type="button" data-act="ship-cancel">Not yet</button></div></form>` : '';
    return {
      title: `<span class="mono">${o.id}</span>${orderChip(o.status)}`,
      sub: `${esc(cust[0])}, ${esc(cust[1])} · placed ${fmt(o.t.placed)}`,
      body: `<section class="actions-box" aria-labelledby="nx-h"><h3 id="nx-h">Next step</h3>
        ${perm ? '' : lockNote('order.act')}
        ${A.length ? `<div class="action-row">${A.map(btn).join('')}</div>` : ''}
        ${B.map(b => `<p class="why">${icon('info', 'sm')}<span>${esc(b)}</span></p>`).join('')}${perm ? shipForm : ''}</section>
      <section class="sec" aria-labelledby="tl-h"><h3 id="tl-h">Status timeline</h3>${timeline(o)}</section>
      <section class="sec" aria-labelledby="it-h2"><h3 id="it-h2">Items</h3><table class="mini-tbl"><thead><tr><th scope="col">Medicine</th><th scope="col" class="r">Qty</th><th scope="col" class="r">Amount</th></tr></thead><tbody>${o.items.map(([s, qn]) => { const p = prod(s); return `<tr><td><strong>${esc(p.name)}</strong><span class="muted" style="display:block;font-size:.75rem">${esc(p.pack)} · MRP ${rupee(p.mrp)}, price ${rupee(unit(p))}</span></td><td class="r">${qn}</td><td class="r">${rupee(unit(p) * qn)}</td></tr>`; }).join('')}</tbody><tfoot><tr><td colspan="2">Total, free delivery</td><td class="r">${rupee(total(o))}</td></tr></tfoot></table></section>
      <section class="sec" aria-labelledby="pm-h"><h3 id="pm-h">Payment and prescription</h3><dl class="kv"><dt>Payment</dt><dd>${payChip(o)}</dd><dt>Prescription</dt><dd>${rxChip(rx.status)} <a href="prescriptions.html#${rx.id}">${rx.id}</a></dd>${rx.decision && rx.status === 'approved' ? `<dt>Valid until</dt><dd>${dmy(rx.decision.validUntil)}</dd>` : ''}${o.ship ? `<dt>Shipment</dt><dd>${esc(o.ship.courier)} · AWB ${esc(o.ship.awb)}<br><a href="${esc(o.ship.url)}" target="_blank" rel="noopener noreferrer">Tracking page</a></dd>` : ''}</dl></section>`,
    };
  }
  function openOrder(id, opener) {
    const o = orderBy(id); cur = id; shipOpen = false; paint(o); render();
    if (!drawer.isOpen) drawer.open(opener || $(`tr[data-id="${id}"]`, body));
  }
  function paint(o, focusTitle) {
    drawer.set(drawerHTML(o));
    history.replaceState(null, '', '#' + o.id);
    if (focusTitle) drawer.focusTitle();
    const sf = $('#ship-form', drawer.el); if (sf) wireShip(o, sf);
  }
  drawer.onClose = () => { const id = cur; cur = null; history.replaceState(null, '', location.pathname + location.search); render(); refocusRow(body, id); };
  rowNav(body, openOrder);

  function log(o, key) { o.t[key] = Date.now(); }
  function wireShip(o, form) {
    const url = $('#s-url', form), courier = $('#s-courier', form), awbEl = $('#s-awb', form);
    const hints = { Delhivery: 'https://www.delhivery.com/track/package/', 'Blue Dart': 'https://www.bluedart.com/tracking?awb=', DTDC: 'https://www.dtdc.in/tracking.asp?awb=' };
    const norm = () => awbEl.value.replace(/\s+/g, '');
    const isHint = u => !u || Object.values(hints).includes(u) || Object.values(hints).some(h => u.startsWith(h) && u.slice(h.length) === encodeURIComponent(url.dataset.auto || ''));
    const autoFill = () => { if (hints[courier.value] && norm().length >= 6 && isHint(url.value.trim())) { url.dataset.auto = norm(); url.value = hints[courier.value] + encodeURIComponent(norm()); } else if (isHint(url.value.trim())) url.value = ''; };
    courier.addEventListener('change', autoFill); awbEl.addEventListener('input', autoFill);
    form.addEventListener('submit', e => {
      e.preventDefault(); let ok = true; const awb = awbEl.value.trim(), u = url.value.trim();
      ok = setErr(form, 's-courier', !courier.value ? 'Choose the courier.' : '') && ok;
      ok = setErr(form, 's-awb', !/^[A-Za-z0-9 ]{6,}$/.test(awb) ? 'Enter the AWB number: letters and digits, at least 6 characters.' : '') && ok;
      let msg = ''; try { const x = new URL(u); if (x.protocol !== 'https:') msg = 'The tracking link must start with https://'; else if (Object.values(hints).includes(u) || x.pathname === '/' || x.href === (hints[courier.value] || '')) msg = 'Add the AWB to the link so it tracks this parcel.'; else if (hints[courier.value] && !decodeURIComponent(u).toLowerCase().includes(norm().toLowerCase())) msg = 'This link does not contain the AWB number, so it will not track this parcel.'; } catch (er) { msg = 'Enter a full tracking link starting with https://'; }
      ok = setErr(form, 's-url', msg) && ok;
      if (!ok) { firstInvalid(form); return; }
      const o2 = orderBy(cur); o2.status = 'shipped'; log(o2, 'shipped'); o2.ship = { courier: courier.value, awb, url: u }; shipOpen = false;
      pushFeed('ok', 'truck', `Order ${o2.id} shipped via ${courier.value}`); save(); paint(o2, true); render();
      toast({ title: `${o2.id} shipped`, sub: `${courier.value}, AWB ${awb}. The customer has the tracking link.` });
    });
    if (debug === 'order-drawer-ship') { courier.value = 'Delhivery'; awbEl.value = '2874 5510 3388'; autoFill(); }
  }
  drawer.el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || !cur) return; const o = orderBy(cur), a = b.dataset.act;
    if (a === 'ship') { shipOpen = true; paint(o); const f = $('#s-courier', drawer.el); if (f) f.focus(); return; }
    if (a === 'ship-cancel') { shipOpen = false; paint(o); $('[data-act="ship"]', drawer.el).focus(); return; }
    const done = (title, sub, feed, ic = 'orders', kind = 'ok') => { pushFeed(kind, ic, feed); save(); paint(o, true); render(); toast({ title, sub }); };
    if (a === 'confirm') { o.status = 'confirmed'; log(o, 'confirmed'); done(`${o.id} confirmed`, 'Ready to pack.', `Order ${o.id} confirmed`); }
    else if (a === 'pack') { o.status = 'packed'; log(o, 'packed'); done(`${o.id} packed`, 'Next: add courier and AWB to ship.', `Order ${o.id} packed`); }
    else if (a === 'deliver') { o.status = 'delivered'; log(o, 'delivered'); done(`${o.id} delivered`, o.pay.method === 'cod' && o.pay.status === 'due' ? 'Remember to mark the COD amount collected.' : '', `Order ${o.id} delivered`); }
    else if (a === 'cod') { o.pay.status = 'collected'; done('COD recorded', `${rupee(total(o))} collected for ${o.id}.`, `COD ${rupee(total(o))} collected for ${o.id}`, 'money'); }
    else if (a === 'cancel') {
      const paid = o.pay.method === 'online' && o.pay.status === 'paid';
      const go = await confirmDlg({ title: `Cancel ${o.id}?`, danger: true, ok: 'Cancel order', body: paid ? `It was paid online, so ${rupee(total(o))} must then be refunded through Razorpay (5 to 7 working days to the customer’s source).` : 'Nothing has been collected, so there is nothing to refund.' });
      if (!go) return;
      o.status = 'cancelled'; log(o, 'cancelled'); if (paid) o.pay.status = 'refund_due';
      done(`${o.id} cancelled`, paid ? 'Refund is now due. Issue it from this panel.' : '', `Order ${o.id} cancelled`, 'x', 'danger');
    } else if (a === 'refund') {
      const go = await confirmDlg({ title: `Refund ${rupee(total(o))}?`, ok: 'Refund via Razorpay', body: `This sends ${rupee(total(o))} back to the customer’s original payment method for ${o.id}. A Razorpay refund cannot be recalled.`, rows: [['Order', o.id], ['Customer', esc(CUST[o.cust][0])]] });
      if (!go) return; o.pay.status = 'refunded';
      done('Refund issued', `${rupee(total(o))} to ${CUST[o.cust][0]}. Arrives in 5 to 7 working days.`, `Refund ${rupee(total(o))} issued for ${o.id}`, 'money', 'warn');
    }
  });

  render();
  const hashId = location.hash.slice(1);
  if (debug === 'order-drawer-ship') { openOrder('AAR-2611-00487'); shipOpen = true; paint(orderBy('AAR-2611-00487')); }
  else if (/^AAR-\d{4}-\d{5}$/.test(hashId) && orderBy(hashId)) openOrder(hashId);
}

/* ════════════════════════════════════════════════════════════════════════
   PRODUCTS
   ════════════════════════════════════════════════════════════════════════ */
function products() {
  const body = $('#p-body'); let q = '', area = '', act = '', photoOnly = false;
  const drawer = Drawer({ wide: true });
  const areas = Object.keys(AREAS);
  $('#f-area').innerHTML = '<option value="">All</option>' + areas.map(a => `<option value="${a}">${AREAS[a]}</option>`).join('');
  const needSwap = () => S.products.filter(p => p.src === 'win2age').length;
  function render() {
    const n = needSwap(); const fb = $('#f-photo'); fb.innerHTML = `${icon('image', 'sm')} Needs photo swap <span class="mono">${n}</span>`; fb.setAttribute('aria-pressed', photoOnly);
    if (photoOnly) { fb.style.background = 'var(--adm-warn-bg)'; fb.style.borderColor = 'var(--adm-warn-dot)'; fb.style.color = 'var(--adm-warn-fg)'; } else { fb.style.background = fb.style.borderColor = fb.style.color = ''; }
    const rows = S.products.filter(p => (!q || (p.name + ' ' + compText(p)).toLowerCase().includes(q)) && (!area || p.cat === area) && (!act || (act === 'on') === p.active) && (!photoOnly || p.src === 'win2age'));
    body.innerHTML = rows.map(p => `<tr data-id="${p.slug}"><td><img class="thumb" src="../assets/products/${p.slug}.webp" alt="" loading="lazy" onerror="this.style.visibility='hidden'"></td><td><button class="id-btn" type="button" tabindex="-1" aria-label="Edit ${esc(p.name)}"><strong style="font-weight:600">${esc(p.name)}</strong></button><span class="sub">${esc(p.form)}</span></td><td class="clip" title="${esc(compText(p))}">${esc(compText(p))}</td><td>${esc(p.pack)}</td><td class="r">${rupee(p.mrp)}</td><td class="r"><strong style="font-weight:600">${rupee(unit(p))}</strong></td><td>${esc(AREAS[p.cat] || p.cat)}</td><td>${p.src === 'win2age' ? '<span class="chip photo">Needs swap</span>' : p.src === 'aarvion' ? chip('Aarvion pack', 'ok') : chip(p.src === 'unbranded' ? 'Unbranded' : 'Uploaded', 'neutral')}</td><td><button class="sw" type="button" role="switch" aria-checked="${p.active}" aria-label="${esc(p.name)} active" data-sw="${p.slug}" ${can('product.edit') ? '' : 'aria-disabled="true"'}></button></td></tr>`).join('') || `<tr><td colspan="9"><div class="empty"><strong>No products match.</strong>Clear a filter to see all ${S.products.length}.</div></td></tr>`;
    $('#p-count').textContent = `${rows.length} of ${S.products.length} products`;
    armRows(body);
  }
  $('#q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
  $('#f-area').addEventListener('change', e => { area = e.target.value; render(); });
  $('#f-active').addEventListener('change', e => { act = e.target.value; render(); });
  $('#f-photo').addEventListener('click', () => { photoOnly = !photoOnly; render(); });
  body.addEventListener('click', async e => {
    const s = e.target.closest('[data-sw]'); if (!s) return;
    if (!can('product.edit')) { toast({ title: 'Admin role needed', sub: 'Switch to the Admin example user to change this.', kind: 'warn' }); return; }
    const p = prod(s.dataset.sw);
    if (p.active) { const go = await confirmDlg({ title: `Hide ${esc(p.name)} from the store?`, ok: 'Deactivate', danger: true, body: 'Customers will no longer find or order it. You can switch it back on at any time.' }); if (!go) { s.focus(); return; } }
    p.active = !p.active; pushFeed(p.active ? 'ok' : 'warn', 'products', `${p.name} set ${p.active ? 'active' : 'inactive'}`, p.name); save(); render();
    $(`[data-sw="${p.slug}"]`).focus(); toast({ title: `${p.name} ${p.active ? 'is live on the store' : 'is hidden from the store'}`, sub: 'Change logged to the audit trail.' });
  });
  rowNav(body, (id, opener) => edit(id, opener));
  $('#add-product').addEventListener('click', e => edit(null, e.currentTarget));

  function edit(slug, opener) {
    const isNew = !slug;
    const p = isNew ? { slug: '', name: '', cat: '', comp: [['', '']], form: 'Film-coated tablet', pack: '', mrp: '', sch: 'H', rx: true, src: 'new', active: false } : { ...prod(slug), comp: prod(slug).comp.map(c => [...c]) };
    const orig = isNew ? null : prod(slug);
    const admin = can('product.edit'); let comp = p.comp.map(c => [...c]), photo = null, touched = !!(debug === 'product-edit-invalid-mrp');
    const compHTML = () => comp.map((c, i) => `<div class="comp-row"><div class="field" data-f="c-i${i}"><label class="sr-only" for="c-i${i}">Ingredient ${i + 1}</label><input class="input" id="c-i${i}" value="${esc(c[0])}" placeholder="Ingredient" aria-describedby="c-i${i}-e" autocomplete="off"><span class="err" id="c-i${i}-e"></span></div><div class="field" data-f="c-s${i}"><label class="sr-only" for="c-s${i}">Strength ${i + 1}</label><input class="input" id="c-s${i}" value="${esc(c[1])}" placeholder="Strength" aria-describedby="c-s${i}-e" autocomplete="off"><span class="err" id="c-s${i}-e"></span></div><button class="btn ghost icon-only" type="button" data-rm="${i}" aria-label="Remove ingredient ${i + 1}" ${comp.length < 2 ? 'disabled' : ''}>${icon('trash', 'sm')}</button></div>`).join('');
    const photoSrc = isNew ? '' : `../assets/products/${p.slug}.webp`;
    drawer.set({
      title: isNew ? 'Add product' : esc(p.name), sub: isNew ? 'Added without code. Photo and price can follow.' : `${esc(AREAS[p.cat] || '')} · ${esc(p.form)}`,
      body: `${admin ? '' : lockNote('product.edit')}<form id="p-form" novalidate><fieldset class="bare" ${admin ? '' : 'disabled'} style="display:grid;gap:1.5rem">
      <div class="form-grid">
        ${fieldHTML({ id: 'p-name', label: 'Name', value: p.name, attrs: 'autocomplete="off" required data-autofocus', cls: 'full' })}
        ${fieldHTML({ id: 'p-pack', label: 'Pack', value: p.pack, hint: 'e.g. Strip of 10 tablets', attrs: 'autocomplete="off"' })}
        <div class="field" data-f="p-area"><label for="p-area">Therapy area</label><select class="select" id="p-area" aria-describedby="p-area-e"><option value="">Choose an area</option>${areas.map(a => `<option value="${a}" ${p.cat === a ? 'selected' : ''}>${AREAS[a]}</option>`).join('')}</select><span class="err" id="p-area-e"></span></div>
      </div>
      <div><div class="lbl" style="font-weight:600;font-size:.8125rem;margin-bottom:.375rem" id="comp-l">Composition</div><div role="group" aria-labelledby="comp-l" id="comp-rows">${compHTML()}</div><button class="btn sm" type="button" id="add-comp">${icon('plus', 'sm')} Add ingredient</button></div>
      <div><div class="form-grid"><div class="field" data-f="p-mrp"><label for="p-mrp">MRP (₹ per pack)</label><div class="input-affix"><span aria-hidden="true">₹</span><input class="input" id="p-mrp" inputmode="decimal" value="${p.mrp === '' ? '' : (debug === 'product-edit-invalid-mrp' ? '15' : p.mrp)}" aria-describedby="p-mrp-h p-mrp-e" autocomplete="off"></div><span class="hint" id="p-mrp-h">Must be ₹21 or more. Use ₹404 when the printed MRP cannot be read.</span><span class="err" id="p-mrp-e"></span></div>
        <div class="field"><span class="lbl">Selling price</span><div class="price-preview" id="pp" aria-live="polite"></div><span class="hint">Never stored. Always MRP − ₹20.</span></div></div></div>
      <div class="form-grid">
        <div class="field" data-f="p-sch"><label for="p-sch">Schedule</label><select class="select" id="p-sch"><option value="H" ${p.sch === 'H' ? 'selected' : ''}>Schedule H</option><option value="H1" ${p.sch === 'H1' ? 'selected' : ''}>Schedule H1</option><option value="none" ${p.sch === 'none' ? 'selected' : ''}>Not scheduled</option></select></div>
        <div class="field"><span class="lbl">Prescription</span><label class="check-row"><input type="checkbox" id="p-rx" ${p.rx ? 'checked' : ''}> Prescription required</label><span class="hint" id="p-rx-h"></span></div>
      </div>
      <div class="field"><span class="lbl" id="ph-l">Photo</span><div class="photo-edit"><div class="pv" id="pv">${photoSrc ? `<img src="${photoSrc}" alt="Current pack photo of ${esc(p.name)}" onerror="this.remove()">` : '<span class="muted">No photo</span>'}</div><div style="display:grid;gap:.5rem;justify-items:start"><div id="ph-st">${p.src === 'win2age' ? '<span class="chip photo">Needs swap: Win2Age placeholder</span>' : p.src === 'aarvion' ? chip('Aarvion pack photo', 'ok') : p.src === 'unbranded' ? chip('Unbranded pack', 'neutral') : chip('No photo yet', 'neutral')}</div><input type="file" id="p-file" accept="image/jpeg,image/png,image/webp" class="sr-only" aria-labelledby="ph-l"><button class="btn" type="button" id="p-pick">${icon('upload', 'sm')} ${photoSrc ? 'Replace photo' : 'Upload photo'}</button><span class="hint" id="p-file-h">JPG, PNG or WebP up to 5 MB. Front of the pack on a plain background.</span><span class="err" id="p-file-e" style="display:none;color:var(--adm-danger);font-size:.75rem"></span></div></div></div>
      ${isNew ? '' : `<p class="note-info">${icon('info', 'sm')}<span>MRP, price-affecting and status changes are written to the audit trail with your name and the time.</span></p>`}
      </fieldset></form>`,
      foot: admin ? `<button class="btn ghost" type="button" data-close>Cancel</button><button class="btn primary" type="submit" form="p-form" id="p-save">${isNew ? 'Add product' : 'Save changes'}</button>` : `<button class="btn" type="button" data-close>Close</button>`,
    });
    drawer.open(opener);
    const root = drawer.el, form = $('#p-form', root);
    const val = id => $('#' + id, root).value.trim();
    const mrpNum = () => { const s = val('p-mrp').replace(/[₹,\s]/g, ''); return /^\d+(\.\d{1,2})?$/.test(s) ? parseFloat(s) : NaN; };
    function mrpMsg() { const s = val('p-mrp'); if (!s) return 'Enter the MRP.'; const n = mrpNum(); if (isNaN(n)) return 'MRP must be a number, like 380 or 404.50.'; if (n < 21) return 'MRP must be ₹21 or more, so the selling price (MRP − ₹20) stays above ₹0.'; return ''; }
    function preview() {
      const n = mrpNum(), pp = $('#pp', root), bad = isNaN(n) || n < 21;
      pp.classList.toggle('bad', bad && !!val('p-mrp'));
      pp.innerHTML = bad ? `<span class="muted">${val('p-mrp') ? 'Cannot compute yet' : 'Enter an MRP'}</span>` : `<span>${rupee(n)} − ₹20 =</span><b>${rupee(n - 20)}</b>`;
      if (touched) setErr(root, 'p-mrp', mrpMsg());
    }
    function rxRule() { const forced = $('#p-sch', root).value !== 'none'; const cb = $('#p-rx', root); if (forced) { cb.checked = true; } cb.disabled = !admin || forced; $('#p-rx-h', root).textContent = forced ? 'Schedule H and H1 medicines always need a prescription.' : 'Optional for non-scheduled products.'; }
    preview(); rxRule(); if (debug === 'product-edit-invalid-mrp') setErr(root, 'p-mrp', mrpMsg());
    $('#p-mrp', root).addEventListener('input', () => { preview(); });
    $('#p-mrp', root).addEventListener('blur', () => { touched = true; setErr(root, 'p-mrp', mrpMsg()); });
    $('#p-sch', root).addEventListener('change', rxRule);
    const rebuildComp = () => { $('#comp-rows', root).innerHTML = compHTML(); };
    const syncComp = () => { comp = comp.map((c, i) => [$('#c-i' + i, root).value, $('#c-s' + i, root).value]); };
    $('#add-comp', root).addEventListener('click', () => { syncComp(); comp.push(['', '']); rebuildComp(); $('#c-i' + (comp.length - 1), root).focus(); });
    $('#comp-rows', root).addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; syncComp(); comp.splice(+b.dataset.rm, 1); rebuildComp(); $('#add-comp', root).focus(); });
    $('#p-pick', root).addEventListener('click', () => $('#p-file', root).click());
    $('#p-file', root).addEventListener('change', e => {
      const f = e.target.files[0], err = $('#p-file-e', root); if (!f) return; err.style.display = 'none';
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { err.textContent = 'Use a JPG, PNG or WebP image.'; err.style.display = 'block'; return; }
      if (f.size > 5 * 1048576) { err.textContent = 'That file is over 5 MB. Export a smaller image.'; err.style.display = 'block'; return; }
      photo = { name: f.name, url: URL.createObjectURL(f) };
      $('#pv', root).innerHTML = `<img src="${photo.url}" alt="Preview of the new photo, ${esc(f.name)}">`;
      $('#ph-st', root).innerHTML = chip('New photo, not saved yet', 'active');
      $('#p-file-h', root).textContent = `${f.name} · ${Math.round(f.size / 1024)} KB. Saving replaces the current photo.`;
    });
    const snap = () => JSON.stringify([val('p-name'), val('p-pack'), val('p-area'), val('p-mrp'), val('p-sch'), $('#p-rx', root).checked, comp.map((c, i) => [$('#c-i' + i, root)?.value, $('#c-s' + i, root)?.value]), !!photo]);
    const base = snap();
    drawer.beforeClose = async () => (!admin || snap() === base || debug === 'product-edit-invalid-mrp') ? true : confirmDlg({ title: 'Discard your changes?', body: 'You have unsaved edits to this product.', ok: 'Discard changes', danger: true });
    drawer.onClose = () => { drawer.beforeClose = null; render(); if (!refocusRow(body, p.slug || slug) && isNew) $('#add-product').focus(); };
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (!admin) return; syncComp(); touched = true; let ok = true;
      ok = setErr(root, 'p-name', val('p-name').length < 2 ? 'Enter the product name.' : '') && ok;
      ok = setErr(root, 'p-area', !val('p-area') ? 'Choose a therapy area.' : '') && ok;
      comp.forEach((c, i) => { ok = setErr(root, 'c-i' + i, !c[0].trim() ? 'Ingredient needed.' : '') && ok; ok = setErr(root, 'c-s' + i, !c[1].trim() ? 'Strength needed.' : '') && ok; });
      const mm = mrpMsg(); ok = setErr(root, 'p-mrp', mm) && ok;
      if (!ok) { firstInvalid(form); return; }
      const n = mrpNum(), oldMrp = orig ? orig.mrp : null;
      if (oldMrp !== null && oldMrp !== n && Math.abs(n - oldMrp) / oldMrp > 0.25) {
        const pct = Math.round((n - oldMrp) / oldMrp * 100);
        const go = await confirmDlg({ title: 'Confirm this MRP change?', danger: true, ok: 'Change MRP', body: 'This is more than a 25% change. Check it is not a typo. It goes live on the store as soon as you save.', rows: [['Was', `${rupee(oldMrp)}, price ${rupee(oldMrp - 20)}`], ['Now', `${rupee(n)}, price ${rupee(n - 20)} (${pct > 0 ? '+' : ''}${pct}%)`]] });
        if (!go) return;
      }
      const next = { ...p, name: val('p-name'), pack: val('p-pack'), cat: val('p-area'), comp: comp.map(c => [c[0].trim(), c[1].trim()]), mrp: n, sch: val('p-sch'), rx: $('#p-rx', root).checked };
      if (photo) next.src = 'aarvion';
      if (isNew) { next.slug = next.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); S.products.push(next); } else Object.assign(orig, next);
      if (oldMrp !== null && oldMrp !== n) pushFeed('warn', 'money', `MRP of ${next.name} edited: ${rupee(oldMrp)} → ${rupee(n)}`, next.name);
      else pushFeed('ok', 'products', `${isNew ? 'Product added' : 'Product updated'}: ${next.name}`, next.name);
      save(); drawer.beforeClose = null; drawer.close(true);
      toast({ title: isNew ? `${next.name} added` : `${next.name} saved`, sub: oldMrp !== null && oldMrp !== n ? `MRP ${rupee(oldMrp)} → ${rupee(n)}. Selling price now ${rupee(n - 20)}.` : 'Logged to the audit trail.' });
    });
  }
  render();
  if (debug === 'product-edit-invalid-mrp') edit('bemptor-180', $('tr[data-id="bemptor-180"]', body));
}

/* ════════════════════════════════════════════════════════════════════════
   STAFF
   ════════════════════════════════════════════════════════════════════════ */
function staff() {
  const rc = { pharmacist: 'ok', ops: 'active', admin: 'neutral' };
  $('#s-body').innerHTML = STAFF.map(s => `<tr><td><span style="display:flex;align-items:center;gap:.625rem"><span class="avatar" aria-hidden="true">${s.name.split(' ').map(w => w[0]).join('')}</span><strong style="font-weight:600">${esc(s.name)}</strong></span></td><td>${chip(ROLE[s.role], rc[s.role])}</td><td class="mono">${s.reg ? esc(s.reg) : '<span class="muted" aria-label="none">–</span>'}</td><td class="num">${esc(s.mobile)}</td><td>${s.status === 'Active' ? chip('Active', 'ok') : chip('Suspended', 'danger')}</td><td class="r age">${ageOf(s.last)} ago</td></tr>`).join('');
  $('#s-count').textContent = `${STAFF.length} staff: ${STAFF.filter(s => s.role === 'pharmacist').length} pharmacists, ${STAFF.filter(s => s.role === 'ops').length} operations, ${STAFF.filter(s => s.role === 'admin').length} admin`;
  const log = (S.audit || []).slice().sort((a, b) => b.ts - a.ts);
  const paint = q => { const rows = log.filter(x => !q || (x.rec + ' ' + x.what + ' ' + x.who).toLowerCase().includes(q)); $('#audit-body').innerHTML = rows.slice(0, 200).map(x => `<tr><td class="num">${fmt(x.ts)}</td><td>${esc(x.who)}</td><td>${esc(x.what)}</td><td class="mono">${esc(x.rec)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty"><strong>No entries match.</strong>Try a record id such as RX-3201.</div></td></tr>'; $('#audit-count').textContent = `${rows.length} of ${log.length} entries, newest first`; };
  paint(''); $('#aq').addEventListener('input', e => paint(e.target.value.trim().toLowerCase()));
}

/* ── boot ────────────────────────────────────────────────────────────── */
buildMe(); badges();
({ dashboard, prescriptions, orders, products, staff }[page] || (() => {}))();
if (page !== 'staff' && page !== 'dashboard') { /* hash/state handled per page */ }
})();
