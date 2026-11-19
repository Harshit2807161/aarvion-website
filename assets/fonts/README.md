# Fonts

- `OFL-Geist.txt` is the SIL Open Font License shipped with the `geist` npm package. It covers both Geist and Geist Mono. The text is unchanged.
- `OFL-HostGrotesk.txt` is the licence from google/fonts for Host Grotesk.
- `SOURCES.json` pins the vendored source font (URL at a fixed commit, plus sha256). Geist is read from `node_modules/geist`.
- Regenerate the subsets in `src/fonts/` with `pnpm fonts:subset`; a test fails if they drift.
