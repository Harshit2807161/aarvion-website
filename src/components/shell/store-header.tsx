"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Icon } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";
import { Brand } from "./brand";

/** The no-JS default search field; `withStoreChrome` passes `HeaderSearch` (suggestions, strength chips) as `search`. */
function StaticSearch() {
  return (
    <form className="search" role="search" action={ROUTES.medicines} autoComplete="off">
      <label className="sr-only" htmlFor="q">
        Search medicines by brand or salt
      </label>
      <div className="search-pill">
        <Icon name="search" />
        <input
          id="q"
          name="q"
          type="search"
          spellCheck={false}
          placeholder="Search medicines by brand or salt"
        />
      </div>
    </form>
  );
}

/** The link carries its own name: `.acct-label` is hidden at 1100px and below. */
function SignIn() {
  return (
    <Link className="sh-btn sh-acct" href={ROUTES.login} aria-label="Sign in">
      <Icon className="acct-icon" name="user" />
      <span className="acct-label">Sign in</span>
    </Link>
  );
}

function Cart() {
  return (
    <Link className="sh-btn sh-cart" href={ROUTES.cart} aria-label="Cart, empty">
      <Icon name="cart" />
      <span className="cart-label">Cart</span>
      <span className="cart-count" aria-hidden="true">
        0
      </span>
    </Link>
  );
}

/**
 * The sticky store header: logo, search, Upload prescription, account, cart. Each slot has a
 * static default so the header works alone; later tasks pass live versions (search: Task 37,
 * account: Task 43, cart: Task 15).
 *
 * The shadow comes from an IntersectionObserver on the announcement line, not a scroll
 * listener: once the line has scrolled away the header is stuck, so it (and `.catbar`) get
 * `is-stuck`.
 */
export function StoreHeader({
  search,
  account,
  cart,
}: {
  search?: ReactNode;
  account?: ReactNode;
  cart?: ReactNode;
}) {
  useEffect(() => {
    const announce = document.querySelector("[data-announce]");
    const head = document.querySelector("[data-store-head]");
    if (!announce || !head || !("IntersectionObserver" in window)) return;
    const stuck = [head, document.querySelector(".catbar")].filter((el) => el !== null);
    const io = new IntersectionObserver(([entry]) => {
      for (const el of stuck) el.classList.toggle("is-stuck", !entry!.isIntersecting);
    });
    io.observe(announce);
    return () => io.disconnect();
  }, []);

  return (
    <header className="store-head" data-store-head>
      <div className="wrap sh-row">
        <Brand placement="header" />
        {search ?? <StaticSearch />}
        <div className="sh-actions">
          <Link className="sh-rx" href={ROUTES.uploadRx}>
            <Icon name="upload" />
            <span>Upload prescription</span>
          </Link>
          {account ?? <SignIn />}
          {cart ?? <Cart />}
        </div>
      </div>
    </header>
  );
}
