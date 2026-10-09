# Feature Flags

Flags are set in `.env.local` (local dev) or the deployment environment. Default is `false` (off for public).

| Flag | What it enables | Public? |
|------|----------------|---------|
| `VITE_FEATURE_ISOCHRONE` | Isochrone layer, workplace picker | Soon |
| `VITE_FEATURE_EXCLUSIONS` | Exclusion zone drawing | Soon |
| `VITE_FEATURE_PINS` | Property pins, compare grid | Later |
| `VITE_FEATURE_SCREENSHOT` | Screenshot drop zone, vision/Ollama parsing | Much later (requires Ollama) |
| `VITE_FEATURE_IDEALISTA_PRICES` | Idealista price dots layer | Later |
| `VITE_FEATURE_BEST_ZONES` | Best zones bar + zones on the map + Idealista zone links (038) | Soon |

When a flag is removed (feature goes fully public), delete the row from this table.
