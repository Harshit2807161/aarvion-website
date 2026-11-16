import { setDepsForTests } from "../../src/server/deps";

/** Installs a controllable clock as deps.now. Reset with resetDepsForTests in afterAll. */
export function installClock(startIso: string): { now(): Date; advance(ms: number): void } {
  let t = new Date(startIso).getTime();
  const clock = {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms;
    },
  };
  setDepsForTests({ now: clock.now });
  return clock;
}
