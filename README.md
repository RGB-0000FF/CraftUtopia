# CraftUtopia Demo

Run a local static server so the browser can load the editable JSON log:

```bash
python3 main.py
```

Open `http://127.0.0.1:8000/index.html` for the demo gallery.

The full runtime demo now lives at `http://127.0.0.1:8000/demos/craftutopia-build/`.

## Editable Run Log

The demo log is split by phase so each part can be edited without opening a giant file:

- `data/demo-log/manifest.json`: phase order and top-level run metadata.
- `data/demo-log/*.json`: per-phase timeline events shown on the right.
