import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  // Merging classes with the power of tailwind
  return twMerge(clsx(inputs))
}
