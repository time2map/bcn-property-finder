# 075 — Save image / Share buttons cut their label

## Problem

On the desktop building card the row "Save image | Share" is 268 px wide and was split 50/50 (`flex: 1 1 0`). Each
button got 130 px, 81 px of it for the label. Spanish "Guardar imagen" needs 95 px and Catalan "Desa la imatge" 87 px,
so Mantine clipped them to "Guardar imag" / "Desa la imat". English fitted.

## Fix

`.save-image__button` is sized by its label (`flex: 1 1 auto`) and uses 12 px side padding: both buttons still fill
the row, the longer label gets a little more of it. No text change.

Measured on the desktop card (row 268 px), label width / needed width:

| Language | Save image | Share |
|---|---|---|
| es | 95 / 95 (button 148) | 60 / 60 (button 112) |
| ca | 87 / 87 (button 139) | 69 / 69 (button 121) |
| en | 68 / 68 (button 147) | 35 / 35 (button 113) |

Phone (390 px), Catalan: 101 / 101 and 80 / 80.

## Tests

Layout only (CSS); jsdom does not lay out text, so there is no unit test. Checked in `npm run dev` in es, ca, en and on
a 390 px phone viewport.

## Definition of Done

- [x] `npm test`, lint, typecheck green.
- [x] Checked by hand in the dev server.
