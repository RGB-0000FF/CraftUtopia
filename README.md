# CraftUtopia Demo

Run a local static server so the browser can load the editable JSON log:

```bash
python3 main.py
```

Open `http://127.0.0.1:8000/index.html`.

## Editable Dialogue Log

The agent dialogue is no longer hardcoded in `index.html`. Edit `data/run-config.json` for stage metadata and `data/groups/*.json` for rooms/messages:

- `stages`: timeline labels, metrics, system-line text, and preview tilt.
- `agents`: display names, role types, vivid accent colors, and MC-style pixel avatar palettes/accessories.
- `messages`: stage, speaker, `side` (`left` or `right`), timestamp, and one event per item. Dialogue uses `text`; broadcast notes use standalone `systemLog`; channel open/close and other tools use standalone `kind: "tool-call"` entries with `toolRef`.

Dialogue messages reference an `agent` key, so adding a new person only requires adding one agent entry and then using that key in `messages`.
