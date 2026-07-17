# /public/icons

Drop real partner app logos here as square SVGs (preferred) or PNGs, named to match each
app's `slug` in `components/landing/AppsShowcase.tsx`, e.g.:

```
/public/icons/thread.svg
/public/icons/loom-pay.svg
/public/icons/council.svg
/public/icons/atlas.svg
```

Once a file exists at that path, set the matching app's `logo` field in the `apps` array
in `AppsShowcase.tsx` to `/icons/<slug>.svg` — the component automatically renders your
real logo via `next/image` instead of the lucide-react placeholder icon. No other code
changes needed.

Recommended: 128×128 or larger, transparent background, square aspect ratio.
