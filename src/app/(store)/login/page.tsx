import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginFlow } from "@/components/auth/login-flow";
import { Icon } from "@/components/base/icon";
import { isMockForbidden } from "@/server/providers/guard";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

// The code step sits low on a phone: let the on-screen keyboard resize the page, not cover it.
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

const WHY = [
  { icon: "file", text: "Reuse a prescription while it’s valid, for 6 months from its date" },
  { icon: "pharm", text: "Follow each order from the pharmacist’s check to your door" },
  { icon: "phone", text: "Sign in with a one-time code by SMS or email. No password to remember." },
  { icon: "cart", text: "Your cart stays as it is when you sign in." },
] as const;

/**
 * The flow reads `?next=` and the demo switch is a request-time decision (C8: after
 * `connection()`), so the card renders per request inside its own Suspense boundary while the
 * intro and the list stay in the static shell. `isMockForbidden()` is read here only: client code
 * never imports src/server, and the demo states (Task 42) stay off wherever mocks are refused.
 */
async function LoginCard() {
  await connection();
  return <LoginFlow mode="page" allowDemo={!isMockForbidden()} />;
}

/** /login: sign in or create an account with a one-time code (spec A5). */
export default function LoginPage() {
  return (
    <main id="main" className="auth-page">
      <div className="auth-field" aria-hidden="true" />
      <div className="wrap auth-wrap">
        <div className="auth-intro">
          <h1 className="auth-title">Sign in to order your medicines</h1>
          <p className="auth-lead">
            Browse and fill your cart as a guest. Sign in when you’re ready to add a prescription
            and check out.
          </p>
        </div>
        <div className="auth-card" id="signin">
          <Suspense fallback={null}>
            <LoginCard />
          </Suspense>
        </div>
        <ul className="auth-why" aria-label="With an account you can">
          {WHY.map((w) => (
            <li key={w.icon}>
              <Icon name={w.icon} />
              <span>{w.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
