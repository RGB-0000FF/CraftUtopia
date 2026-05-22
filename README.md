# CraftUtopia Demo

Run a local static server so the browser can load the editable JSON log:

```bash
python3 main.py
```

Open `http://127.0.0.1:8000/index.html` for the demo gallery, or open the shared viewer directly:

```text
http://127.0.0.1:8000/demos/viewer/?demo=sydney-opera-house
```

## Editable Run Log

The shared viewer is driven by demo profiles in `data/demos/<demo-id>/demo.json`.
Most demos reuse the phase log:

- `data/demo-log/manifest.json`: phase order and top-level run metadata.
- `data/demo-log/*.json`: per-phase timeline events shown on the right.

The Sydney Opera House demo uses its own linear log:

- `data/demos/sydney-opera-house/milestone-log-preview.json`
