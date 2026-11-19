"use client";

// Our own customer toast (DESIGN.md "Toasts"); Sonner is banned by deps-policy. One toast at a
// time, held in a module-level store so any client code can call toast() without a provider.
// Motion lives in src/styles/toast.css (opacity-only under reduced motion).
import { useSyncExternalStore } from "react";
import { Icon, type IconName } from "@/components/base/icon";
import { announce } from "./live-region";

export const TOAST_MS = 4600;
export const TOAST_RESUME_MS = 2400;
export const TOAST_LEAVE_MS = 240;

export type ToastOptions = { action?: string; onAction?: () => void; icon?: IconName };

type ToastState = {
  id: number;
  message: string;
  action?: string;
  onAction?: () => void;
  icon: IconName;
  leaving: boolean;
};

let current: ToastState | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function set(next: ToastState | null) {
  current = next;
  emit();
}

function startLeaving() {
  clearTimeout(timer);
  if (!current || current.leaving) return;
  const id = current.id;
  set({ ...current, leaving: true });
  timer = setTimeout(() => {
    if (current?.id === id) set(null);
  }, TOAST_LEAVE_MS);
}

function arm(ms: number) {
  clearTimeout(timer);
  timer = setTimeout(startLeaving, ms);
}

/** Show a toast, replacing any current one, and announce it through the polite live region. */
export function toast(message: string, opts: ToastOptions = {}): void {
  set({ id: nextId++, message, icon: opts.icon ?? "check", leaving: false, ...opts });
  arm(TOAST_MS);
  announce(message);
}

/** Start the leave animation for the current toast, if any. */
export function dismissToast(): void {
  startLeaving();
}

function pause() {
  if (current && !current.leaving) clearTimeout(timer);
}

function resume() {
  if (current && !current.leaving) arm(TOAST_RESUME_MS);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

export function Toaster() {
  const t = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!t) return null;
  return (
    <div className="toasts">
      <div
        key={t.id}
        className={t.leaving ? "toast is-leaving" : "toast"}
        onPointerEnter={pause}
        onPointerLeave={resume}
        onFocus={pause}
        onBlur={resume}
      >
        <Icon name={t.icon} />
        <span>{t.message}</span>
        {t.action && (
          <button
            type="button"
            className="btn btn-sand btn-sm"
            onClick={() => {
              t.onAction?.();
              startLeaving();
            }}
          >
            {t.action}
          </button>
        )}
      </div>
    </div>
  );
}
