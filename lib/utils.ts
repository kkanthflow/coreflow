import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

/**
 * Combines class names using clsx and tailwind-merge.
 * This ensures Tailwind classes are properly merged without conflicts.
 *
 * Usage:
 * ```tsx
 * cn("px-4 py-2", isActive && "bg-primary", className)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely format distance to now without throwing RangeError on invalid dates.
 */
export function safeFormatDistanceToNow(dateInput: any, options?: any): string {
  if (!dateInput) return "some time ago";
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return "some time ago";
    }
    return formatDistanceToNow(date, options);
  } catch (error) {
    console.warn("safeFormatDistanceToNow error:", error);
    return "some time ago";
  }
}

/**
 * Safely format date string without throwing RangeError on invalid dates.
 */
export function safeFormat(dateInput: any, formatStr: string, fallback: string = "TBD"): string {
  if (!dateInput) return fallback;
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return fallback;
    }
    return format(date, formatStr);
  } catch (error) {
    console.warn("safeFormat error:", error);
    return fallback;
  }
}

