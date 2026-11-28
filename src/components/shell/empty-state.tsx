import type { ReactNode } from "react";

/**
 * A dashed well holding a dot-matrix count, a title, a line of copy and the next steps. Used
 * for pages with nothing to show: the 404 ("404"), and later the empty cart and lists. The
 * count is a stamp moment (DESIGN.md, empty counts), masked at a 3.6px pitch by `.dm`.
 */
export function EmptyState({
  count,
  title,
  children,
  actions,
}: {
  count: string;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="well--empty" aria-hidden="true">
        <span className="well-count dm">{count}</span>
      </div>
      {title && <h2>{title}</h2>}
      {children && <p>{children}</p>}
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}
