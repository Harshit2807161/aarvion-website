import type { ReactNode } from "react";
import { FilmEngine } from "./film-engine";

/**
 * Runs before the first paint, from the HTML itself: when the visitor allows motion, `#home` gets
 * `film`, so the pinned stages and the rise start states apply with no flash. Without JS or under
 * reduced motion the class never appears and the static composition shows, complete and visible.
 */
export const FILM_FLAG_SCRIPT =
  'try{if(matchMedia("(prefers-reduced-motion: no-preference)").matches)document.getElementById("home").classList.add("film")}catch(e){}';

/**
 * The home page's root: `main#home.home`, with the film flag set by the script above and the
 * engine mounted after the sections. `suppressHydrationWarning` is for the `film` class the script
 * adds to the server's HTML (React keeps a class it did not render). The server HTML itself is
 * the full static page. `film-root` is the hook the film's CSS uses for the engine's `measuring`
 * class: it sets it on this element, never on `<html>`. Styles: src/styles/film.css.
 */
export function FilmRoot({ children }: { children: ReactNode }) {
  return (
    <main id="home" className="home film-root" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: FILM_FLAG_SCRIPT }} />
      {children}
      <FilmEngine />
    </main>
  );
}
