# Asset map

- `icons/skills/` - editable Skill icons used in the viewer skill notifications and skill cards.
- `ui/` - shared UI branding assets, such as CraftUtopia logos.
- `images/` - shared viewer framework and static page images.
- `replay_videos_mp4/` - MP4 replay videos.

Application code lives in `src/`, not `assets/`:

- `src/js/` - viewer and gallery JavaScript.
- `src/styles/` - viewer and gallery CSS.

Per-demo assets now live beside each demo config in `data/demos/<demo-id>/`:

- `cover.png` - viewer cover/reference image.
- `thumbnail.jpg` - home page gallery thumbnail.
- `source.png` - original input/reference image when available.
- `demo.css` - optional demo-specific stylesheet when a demo needs a custom layout.

For Skill icon changes, start in `icons/skills/README.md`.
