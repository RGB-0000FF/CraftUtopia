# Demo Folders

The public demo UI is served by one shared viewer template.

- `viewer/`: shared runtime demo page. The gallery opens it with `?demo=<demo-id>`.
- `craftutopia-build/`: current full runtime demo while the shared viewer template is being extracted.

Demo-specific material lives under `data/demos/<demo-id>/`.

- `data/demos/sydney-opera-house/`: Sydney Opera House config.
- `data/demos/taj-mahal/`: Taj Mahal config.
- `data/demos/united-states-capitol/`: United States Capitol config.

Shared images, videos, styles, scripts, and editable logs stay in `assets/` and `data/` until a demo needs private assets.
