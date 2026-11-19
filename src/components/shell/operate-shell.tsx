import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/base/icon";

/**
 * The layout every Operate page (cart, checkout, account, login, policies) sits in: a forest
 * band with the title, then a white work sheet rising out of it. `main#main` is the skip-link
 * target, so a page must render exactly one OperateShell.
 */
export function OperateShell({
  title,
  sub,
  back,
  children,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <main id="main" className="operate">
      <section className="band" data-ground="forest">
        <div className="wrap band-in">
          {back && (
            <Link className="band-back" href={back.href}>
              <Icon name="back" size={18} />
              <span>{back.label}</span>
            </Link>
          )}
          {title && <h1 className="band-title">{title}</h1>}
          {sub && <p className="band-sub">{sub}</p>}
        </div>
      </section>
      <div className="work">
        <div className="work-in">{children}</div>
      </div>
    </main>
  );
}
