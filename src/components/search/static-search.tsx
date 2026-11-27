import { Icon } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";

/**
 * The plain header search field: a GET form to the medicines section. It is the page's server
 * HTML (visible and typeable at once, with no JavaScript) and what `LazyHeaderSearch` shows until
 * the combobox code has loaded. `onActivate` (focus or pointer down) is how that load starts.
 */
export function StaticSearch({ onActivate }: { onActivate?: () => void }) {
  return (
    <form
      className="search"
      role="search"
      action={ROUTES.medicines}
      autoComplete="off"
      onFocusCapture={onActivate}
      onPointerDownCapture={onActivate}
    >
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
