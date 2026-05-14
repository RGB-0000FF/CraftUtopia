# CraftUtopia Demo

Run a local static server so the browser can load the editable JSON log:

```bash
python3 main.py
```

Open `http://127.0.0.1:8000/index.html`.

## Editable Run Log

The right-side demo log is no longer a chat transcript. Edit:

- `data/run-config.json`: stage metadata, metrics, system-line text, and preview tilt.
- `data/run-events.json`: the editable stage-by-stage execution log shown on the right.
- `data/groups/*.json`: legacy source chat material kept for reference; the demo UI does not load it.
