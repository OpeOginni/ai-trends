import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  // Merging classes with the power of tailwind
  // This utility combines clsx and tailwind-merge for optimal class handling
  return twMerge(clsx(inputs))
}
