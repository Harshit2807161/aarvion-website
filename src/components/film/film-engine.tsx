"use client";

import { useLayoutEffect } from "react";
import { createFilm } from "./engine";

/**
 * Starts the scroll film on `#home` once the page is interactive; renders nothing. The film is
 * on only when the visitor allows motion. The inline script in FilmRoot already added `film`
 * for a full page load; a soft navigation to the home page did not run it, so it is added here
 * too (adding a class that is already there changes nothing). Under reduced motion `film` is
 * never added, so the static composition stays, and `createFilm` does nothing.
 */
export function FilmEngine() {
  useLayoutEffect(() => {
    const home = document.getElementById("home");
    if (!home) return;
    const film = matchMedia("(prefers-reduced-motion: no-preference)").matches;
    if (film) home.classList.add("film");
    const { destroy } = createFilm(home, { film });
    return destroy;
  }, []);
  return null;
}
