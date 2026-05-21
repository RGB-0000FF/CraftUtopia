# CraftUtopia Demo Scripts

The demo keeps `index.html` as markup only. Runtime behavior is split by responsibility:

- `demo-config.js`: constants, shared runtime state, DOM references, and the skill registry.
- `demo-utils.js`: UI scaling, escaping, title casing, and mention highlighting helpers.
- `demo-render.js`: terminal log rows, progress rows, skill cards, chat feed, and milestone rendering.
- `demo-playback.js`: autoplay clock, timeline scrubbing, video sync, framework keyframe pauses, and panel resize.
- `demo-data.js`: split JSON loading, event normalization, playback event construction, and boot setup.
- `demo-events.js`: browser event listeners and final startup call.
