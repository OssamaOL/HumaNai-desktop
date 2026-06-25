/**
 * theme.js
 * --------
 * Single source of truth for the dark theme.
 *
 * Palette logic: "HumaNai" = Human + AI. The cool charcoal base reads as
 * precision/data (the AI side); the warm gold accent reads as warmth/people
 * (the Human side). Functional colors (success/danger/warning/info) are kept
 * desaturated so they never compete with the signature gold.
 *
 * Typography logic: Fraunces (serif, has personality) carries the wordmark
 * and page headlines — the "human" voice. Inter (geometric sans) carries
 * every UI control, table, and data point — the "AI precision" voice.
 * JetBrains Mono is reserved for literal data: emails, IDs, codes.
 */

export const theme = {
  color: {
    // ── Surfaces (darkest → lightest) ──────────────────────────────────────
    ink:        '#121317',  // app background
    charcoal:   '#1B1D23',  // sidebar, topbar, cards
    elevated:   '#22242C',  // inputs, hover states, nested surfaces
    hairline:   '#2E3038',  // borders, dividers

    // ── Text ────────────────────────────────────────────────────────────────
    bone:       '#EDECE7',  // primary text
    mist:       '#9A9CA5',  // secondary text
    mistDim:    '#5C5E66',  // placeholders, disabled text

    // ── Signature accent (gold — used sparingly) ───────────────────────────
    gold:       '#C9974C',
    goldBright: '#DCAE6B',  // hover state
    goldSoft:   'rgba(201, 151, 76, 0.14)',
    goldRing:   'rgba(201, 151, 76, 0.35)',

    // ── Functional (desaturated so they stay quiet) ────────────────────────
    success:     '#5FA776',
    successSoft: 'rgba(95, 167, 118, 0.14)',
    danger:      '#C1604F',
    dangerText:  '#E08E7E',  // lighter variant for text-on-dark legibility
    dangerSoft:  'rgba(193, 96, 79, 0.14)',
    warning:     '#D9A441',
    warningSoft: 'rgba(217, 164, 65, 0.14)',
    info:        '#5B84A6',
    infoText:    '#7FA8C9',
    infoSoft:    'rgba(91, 132, 166, 0.14)',
  },

  font: {
    display: "'Fraunces', Georgia, 'Times New Roman', serif",
    body:    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono:    "'JetBrains Mono', 'IBM Plex Mono', 'Courier New', monospace",
  },

  radius: { sm: 8, md: 10, lg: 14, xl: 20, pill: 99 },

  shadow: {
    card: '0 1px 0 rgba(255,255,255,0.02) inset, 0 12px 32px rgba(0,0,0,0.35)',
    glow: '0 0 120px rgba(201, 151, 76, 0.10)',
  },
}

export default theme
