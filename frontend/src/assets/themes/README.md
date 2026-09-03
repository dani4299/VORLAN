# Themes

Drop theme/color-token references here. VORLAN's whole visual system runs on the CSS custom
properties defined in the `:root` block of `frontend/src/index.css` — canvas, ink, accent,
and the identity hues (violet/amber/rose/emerald) plus their washes.

A new theme should define the same set of properties with different values so it can be
swapped in later (e.g. as an alternate `:root[data-theme="..."]` block).
