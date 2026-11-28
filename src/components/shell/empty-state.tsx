import type { ReactNode } from "react";

/**
 * A dashed well holding a dot-matrix count, a title, a line of copy and the next steps. Used
 * for pages with nothing to show: the 404 ("404"), and later the empty cart and lists. The
 * count is a stamp moment (DESIGN.md, empty counts), masked at a 3.6px pitch by `.dm`.
 * `compact` is the cart drawer's smaller one, titled with an h3 under the drawer's h2.
 */
export function EmptyState({
  count,
  title,
  children,
  actions,
  compact = false,
}: {
  count: string;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const Title = compact ? "h3" : "h2";
  return (
    <div className={compact ? "empty empty--compact" : "empty"}>
      <div className="well--empty" aria-hidden="true">
        <span className="well-count dm">{count}</span>
      </div>
      {title && <Title>{title}</Title>}
      {children && <p>{children}</p>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}
