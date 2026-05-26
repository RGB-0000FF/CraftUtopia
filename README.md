# CraftUtopia Demo

Run a local static server so the browser can load the editable JSON log:

```bash
python3 main.py
```

Open `http://127.0.0.1:8000/index.html` for the demo gallery, or open the shared viewer directly:

```text
http://127.0.0.1:8000/demos/viewer/?demo=sydney-opera-house
```

## Demo Profiles

The shared viewer is driven by demo profiles in `data/demos/<demo-id>/demo.json`.
Each published demo profile points to:

- an HLS manifest in `hls-primer/<demo-id>/master.m3u8`
- a milestone log in `data/demos/<demo-id>/milestone-log-preview.json`
- shared top-milestone styling in `data/demos/shared/top-milestone-layout.css`
