import { createCn } from "cn/config"

/**
 * Class merging (clsx + tailwind-merge semantics). The Nordic Fog type tokens (`text-body`, `text-button` …)
 * are registered as font sizes so they are never mistaken for, and merged away with, text colours.
 */
export const FONT_SIZE_TOKENS = [
  "display",
  "headline",
  "title",
  "dialog-title",
  "brand",
  "stat",
  "stat-mobile",
  "body",
  "body-sm",
  "label",
  "hint",
  "alert",
  "button",
  "button-sm",
  "button-lg",
  "control",
  "badge",
  "nav-label",
] as const

export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: [...FONT_SIZE_TOKENS] }] } },
})
