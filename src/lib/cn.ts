import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Join class names, dropping falsy values and letting the last Tailwind utility win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
