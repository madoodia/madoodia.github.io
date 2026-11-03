# OSL Studio

Real-time LookDev, procedural shader development, and dynamic multi-pass pipeline inspection across render passes in strict pipeline sequence.

## Features

- **Dynamic Viewport Slides:** Discovers shot folders dynamically from `images/oslviewer/` with natural number sorting.
- **Multi-Curtain Cascading Wipe:** Multi-pass vertical wipe with zero-gap single-line collapse and vertically staggered knobs.
- **Pass Chooser:** Interactive filter chips to compare any subset of passes (1, 2, or more). Drag chips to reorder them from left to right.
- **Pass Descriptions:** Write a description for each pass and show or hide them on the images.
- **Local A/B Tester:** Test any two local renders directly in the browser with split wipe and difference map diffing.
- **Automated Manifest Sync:** Python CLI (`Scripts/update_manifest.py`) to auto-sync new folders, passes, and titles into both `manifest.json` and `viewer.js`.

## Adding New Passes & Folders

1. Create a folder inside `images/oslviewer/` (e.g. `images/oslviewer/Viewport03/`).
2. Add your rendered passes using the naming format:
    ```
    01.wireframe.png
    02.3d.png
    03.zdepth.png
    04.render.png
    05.debug.dof.png
    06.render.dof.png
    ```
3. Run the synchronization script from the project root:
    ```powershell
    py Scripts/update_manifest.py
    ```
4. Refresh `oslviewer/index.html` — all new folders and layers are immediately available.

## Publishing Pass Order & Descriptions

Reordering and description edits save in your browser only. To publish them for visitors:

1. Open the page locally (or the live page with `?edit` added to the URL), then use **Edit Descriptions**.
2. Click **Download manifest.json** and use it to replace `images/oslviewer/manifest.json`.
3. Run `py Scripts/update_manifest.py`, which keeps your order and descriptions and syncs them into `viewer.js`.
4. Commit and push.
