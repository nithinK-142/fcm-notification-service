import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms) {
  if (!ms) return "—"

  if (ms < 1000) return `${ms}ms`

  const totalSeconds = ms / 1000
  if (totalSeconds < 60) return `${totalSeconds.toFixed(2)}s`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(ms / 1000) % 60
  if (seconds === 0) return `${minutes}m`

  return `${minutes}m ${seconds}s`
}

const SPECIAL_CAPS = new Set(["and", "the", "of", "in", "at",])
const ACRONYMS = new Set(["ut", "nct"])

export function formatStateName(raw) {
  if (!raw) return "—"
  return raw
    .split(" ")
    .map((word, i) => {
      if (ACRONYMS.has(word)) return word.toUpperCase()
      if (i > 0 && SPECIAL_CAPS.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(" ")
}