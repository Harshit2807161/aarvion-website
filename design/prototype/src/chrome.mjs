// Store chrome shared by the home page and every customer page: the announcement line, the store
// header (logo, search with suggestions and strength chips, Upload prescription, Sign in, Cart), the
// category bar and the store footer. build.mjs writes it into index.html and between the
// <!-- chrome:* --> markers of pages/*.html, so the markup has one source.
//   home: true on index.html (anchors are local, pages live under pages/)
//   reduced: checkout's header (logo and a secure-checkout note; the band already links back to
//   the cart), with no announcement, search or category bar

const AREAS = [
  ["heart-care", "Heart care"],
  ["diabetes-care", "Diabetes care"],
  ["eye-care", "Eye care"],
  ["respiratory-care", "Respiratory care"],
];
const ic = (id, cls = "i") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const paths = (home) => ({ H: home ? "" : "../index.html", P: home ? "pages/" : "", A: home ? "assets/brand/" : "../assets/brand/" });

export function chromeHead({ home = false, reduced = false } = {}) {
  const { H, P, A } = paths(home);
  const brand = `<a class="brand" href="${home ? "#top" : "../index.html"}" aria-label="Aarvion Pharmaceuticals, home"><img class="brand-logo" src="${A}aarvion-logo.svg" alt="" width="120" height="40"></a>`;
  if (reduced) {
    return `<header class="store-head store-head--reduced">
  <div class="wrap sh-row">
    ${brand}
    <p class="sh-secure">${ic("shield")}<span>Secure checkout</span></p>
  </div>
</header>`;
  }
  const rx = home ? `href="#rx-upload" data-rx` : `href="account.html#prescriptions"`;
  return `<div class="announce" data-announce>
  <p class="wrap announce-in"><span class="ann">Free delivery across India</span><span class="ann">Cash on delivery available</span><span class="ann">A pharmacist checks every prescription</span></p>
</div>
<header class="store-head" data-store-head data-home="${home ? "" : "../index.html"}">
  <div class="wrap sh-row">
    ${brand}
    <form class="search" role="search" action="${H}#medicines" autocomplete="off">
      <label class="sr-only" for="q">Search medicines by brand or salt</label>
      <div class="search-pill">
        ${ic("search")}
        <input id="q" name="q" type="search" spellcheck="false" placeholder="Search medicines by brand or salt" role="combobox" aria-expanded="false" aria-controls="sugg" aria-autocomplete="list" aria-describedby="sugg-hint">
      </div>
      <div class="sugg-panel" hidden>
        <div class="chips" role="group" aria-labelledby="chips-label">
          <span class="chips-label" id="chips-label">Strength</span>
          <button type="button" class="chip" aria-pressed="false" data-strength="50">50</button>
          <button type="button" class="chip" aria-pressed="false" data-strength="100">100</button>
          <button type="button" class="chip" aria-pressed="false" data-strength="200">200</button>
        </div>
        <p class="sugg-hint" id="sugg-hint">Type a brand such as Sacuwin or a salt such as Valsartan.</p>
        <ul class="sugg" id="sugg" role="listbox" aria-label="Matching medicines" hidden></ul>
      </div>
    </form>
    <div class="sh-actions">
      <a class="sh-rx" ${rx}>${ic("upload")}<span>Upload prescription</span></a>
      <a class="sh-btn sh-acct" href="${P}login.html" data-acct aria-label="Sign in"><span class="acct-dot" aria-hidden="true"></span>${ic("user", "i acct-icon")}<span class="acct-label">Sign in</span></a>
      <a class="sh-btn sh-cart" href="${P}cart.html" data-cart-open aria-label="Cart, 0 packs">${ic("cart")}<span class="cart-label">Cart</span><span class="cart-count" aria-hidden="true">0</span></a>
    </div>
  </div>
</header>
<nav class="catbar" aria-label="Shop by category">
  <ul class="wrap catbar-in">
${AREAS.map(([id, name]) => `    <li><a href="${H}#${id}">${name}</a></li>`).join("\n")}
    <li><a href="${H}#medicines">All medicines${ic("go")}</a></li>
  </ul>
</nav>`;
}

export function chromeFoot({ home = false, proto = "" } = {}) {
  const { H, P, A } = paths(home);
  const tba = (s) => `<li><span class="foot-tba">${s}<span class="tba">To be added</span></span></li>`;
  return `<footer class="foot" id="contact">
  <div class="wrap foot-top">
    <div class="foot-brand">
      <p class="foot-logo"><img src="${A}aarvion-logo-reversed.svg" alt="Aarvion" width="156" height="52"></p>
      <p class="foot-about">Aarvion’s own prescription medicines, sold by Aarvion. A pharmacist checks every prescription before an order is packed.</p>
    </div>
    <nav class="foot-col" aria-labelledby="f-shop">
      <h2 class="foot-h" id="f-shop">Shop by category</h2>
      <ul>
${AREAS.map(([id, name]) => `        <li><a href="${H}#${id}">${name}</a></li>`).join("\n")}
        <li><a href="${H}#medicines">All medicines</a></li>
      </ul>
    </nav>
    <nav class="foot-col" aria-labelledby="f-help">
      <h2 class="foot-h" id="f-help">Help and policies</h2>
      <ul>
        <li><a href="${H}#how">How ordering works</a></li>
        <li><a href="${H}#questions">Questions</a></li>
        <li><a href="${P}account.html#orders">Track an order</a></li>
        <li><a href="${H}#faq-returns">Cancellation and returns</a></li>
        ${tba("Privacy policy")}
        ${tba("Terms of use")}
      </ul>
    </nav>
    <nav class="foot-col" aria-labelledby="f-company">
      <h2 class="foot-h" id="f-company">Company</h2>
      <ul>
        ${tba("About Aarvion")}
        <li><a href="${H}#faq-win2age">Why some packs say Win2Age</a></li>
        <li><a href="${P}account.html">Your account</a></li>
      </ul>
    </nav>
    <div class="foot-col">
      <h2 class="foot-h">Contact</h2>
      <address>Aarvion Pharmaceuticals<br>Plot No. 70, Second Floor,<br>Functional Industrial Estate,<br>Patparganj, New Delhi 110092</address>
      <dl class="foot-dl">
        <div><dt>Phone</dt><dd>To be added</dd></div>
        <div><dt>Email</dt><dd>To be added</dd></div>
      </dl>
    </div>
  </div>
  <div class="wrap foot-legal">
    <h2 class="sr-only">Licences and legal details</h2>
    <dl class="foot-dl">
      <div><dt>Drug licence no.</dt><dd>To be added</dd></div>
      <div><dt>Registered pharmacist</dt><dd>To be added</dd></div>
      <div><dt>Grievance officer</dt><dd>To be added</dd></div>
      <div><dt>GSTIN</dt><dd>To be added</dd></div>
    </dl>
  </div>
  <div class="wrap foot-pay">
    <p class="foot-pay-label">Pay with</p>
    <ul class="pay"><li>UPI</li><li>Cards</li><li>Netbanking</li></ul>
    <p>through Razorpay, or</p>
    <ul class="pay"><li>Cash on delivery</li></ul>
  </div>
  <div class="wrap foot-base">
    <p>© 2026 Aarvion Pharmaceuticals. Prescription medicines are dispensed only against a valid prescription.</p>${proto ? "\n    " + proto : ""}
  </div>
</footer>`;
}
