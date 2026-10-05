# FONTS.md — the typefaces prototype v7 uses

Extracted from `AFS_Command_Center_Prototype_v7.html`
(sha256 `37f9c4d6…112a63`). Two families, two roles, declared once each as a
CSS custom property in `<style>` block 1 and never redeclared by the light
theme — so these stacks are the live ones.

## The prototype's own loader

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@500;600;700&display=swap" rel="stylesheet">
```

## The two stacks

| Token | Stack | Weights loaded | Used for |
|---|---|---|---|
| `--display` | `"Barlow Semi Condensed","Arial Narrow",Arial,sans-serif` | 500, 600, 700 | `h1.t`, `.panel>h2`, `.ph`, `.pane>h2`, `.lane-t h2`, `.rp h3`, `.dph h2`, `.s`, `.bt b` (brand) |
| `--body` | `Barlow,"Helvetica Neue",Arial,sans-serif` | 400, 500, 600, 700 | `body`, every control, `.tag`, `.status`, `.nqb`, `.dl` (SVG dimension labels) |

Barlow Semi Condensed is the condensed companion to Barlow, not a stretched
Barlow — it carries the headings and the brand wordmark, and substituting
Barlow for it loses the tight measure every v7 heading is set in. That is why
`"Arial Narrow"` and not `Arial` is its first fallback.

## How this app loads them

`next/font/google` in `app/layout.tsx`, exposing the two families as CSS
variables that `v7.css`'s `--display` / `--body` resolve against. `next/font`
self-hosts the files at build time, so the Command Center has no runtime
dependency on `fonts.googleapis.com` and no render-blocking third-party
request — and the `display: 'swap'` the prototype asks for is preserved.

The first family in each stack is what `tests/visual/v7-style-gate.spec.ts`
compares, because a computed `font-family` is reported as the whole stack and
only its head is meaningful once the file has loaded.
