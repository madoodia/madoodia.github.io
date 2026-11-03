#!/usr/bin/env python3
"""
OSL Studio - Viewport Manifest & Layer Synchronizer
Scans images/oslviewer for folders and image passes, extracts clean layer names,
and updates both manifest.json and oslviewer/viewer.js (for offline file:/// support).

Custom pass order and descriptions already in manifest.json are preserved.

Usage:
    py Scripts/update_manifest.py
    python Scripts/update_manifest.py
"""

import json
import re
import sys
from pathlib import Path

# Supported image extensions
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def natural_sort_key(s: str):
    """Sort strings containing numbers in natural human order."""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r"(\d+)", str(s))]


def format_folder_title(folder_name: str) -> str:
    """Format folder directory name into a clean user-facing title."""
    m = re.match(r"^([a-zA-Z]+)(\d+)(.*)$", folder_name)
    if m:
        base, num, rest = m.groups()
        return f"{base} {num}{rest}".strip()
    return folder_name


def parse_layer_name(filename: str):
    """
    Extract layer number and clean name from filename.
    Format: '##.layer_name.png' -> (num='##', name='layer_name')
    """
    m = re.match(r"^(\d+)\.(.+)\.(png|jpg|jpeg|webp)$", filename, re.IGNORECASE)
    if m:
        return m.group(1), m.group(2)
    clean = re.sub(r"\.(png|jpg|jpeg|webp)$", "", filename, flags=re.IGNORECASE)
    return "", clean


def scan_viewport_folders(images_dir: Path):
    """Scan images/oslviewer for subfolders and collect ordered image files."""
    folders = []
    if not images_dir.exists():
        print(f"[ERROR] Directory not found: {images_dir}")
        return folders

    subdirs = sorted([d for d in images_dir.iterdir() if d.is_dir() and not d.name.startswith(".")], key=lambda d: natural_sort_key(d.name))

    for subdir in subdirs:
        # Find all valid image files in folder
        image_files = [f.name for f in subdir.iterdir() if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS and not f.name.startswith(".")]
        image_files.sort(key=natural_sort_key)

        if not image_files:
            print(f"[WARN] Skipping '{subdir.name}': No images found.")
            continue

        folders.append({
            "id": subdir.name,
            "title": format_folder_title(subdir.name),
            "files": image_files
        })

    return folders


def preserve_manual_edits(folders, manifest_path: Path):
    """Carry custom pass order and descriptions over from the existing manifest.json."""
    if not manifest_path.exists():
        return

    existing = {f["id"]: f for f in json.loads(manifest_path.read_text(encoding="utf-8")).get("folders", [])}
    for folder in folders:
        previous = existing.get(folder["id"])
        if not previous:
            continue

        files = folder["files"]
        kept = [f for f in previous.get("files", []) if f in files]
        # Passes in natural order stay naturally sorted, so new files slot into place
        if kept != sorted(kept, key=natural_sort_key):
            folder["files"] = kept + [f for f in files if f not in kept]

        descriptions = {f: text for f, text in previous.get("descriptions", {}).items() if f in files and text}
        if descriptions:
            folder["descriptions"] = descriptions


def update_manifest_json(manifest_path: Path, manifest_data: dict):
    """Write formatted manifest.json."""
    content = json.dumps(manifest_data, indent=2, ensure_ascii=False) + "\n"
    manifest_path.write_text(content, encoding="utf-8")
    print(f"[OK] Updated: {manifest_path.resolve()}")


def update_viewer_js(viewer_js_path: Path, manifest_data: dict):
    """
    Update const DEFAULT_MANIFEST inside oslviewer/viewer.js
    ensuring 100% offline file:/// protocol support.
    """
    if not viewer_js_path.exists():
        print(f"[WARN] viewer.js not found at {viewer_js_path}")
        return

    content = viewer_js_path.read_text(encoding="utf-8")

    # Format JavaScript object with 2-space indentation
    manifest_json_str = json.dumps(manifest_data, indent=2, ensure_ascii=False)
    # Indent manifest for inside viewer.js function
    indented_manifest = "\n".join("  " + line if line.strip() else "" for line in manifest_json_str.splitlines())
    replacement = f"  const DEFAULT_MANIFEST = {indented_manifest.strip()};"

    # Regex pattern to match const DEFAULT_MANIFEST = { ... };
    pattern = re.compile(r"^[ \t]*const DEFAULT_MANIFEST\s*=\s*\{.*?\n[ \t]*\};", re.DOTALL | re.MULTILINE)

    if pattern.search(content):
        # A function keeps backslashes in descriptions from being read as regex escapes
        updated_content = pattern.sub(lambda _: replacement, content, count=1)
        viewer_js_path.write_text(updated_content, encoding="utf-8")
        print(f"[OK] Synchronized DEFAULT_MANIFEST in: {viewer_js_path.resolve()}")
    else:
        print("[WARN] Could not find 'const DEFAULT_MANIFEST = { ... };' pattern in viewer.js")


def main():
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent if script_dir.name.lower() == "scripts" else script_dir
    images_dir = repo_root / "images" / "oslviewer"
    manifest_file = images_dir / "manifest.json"
    viewer_js_file = repo_root / "oslviewer" / "viewer.js"

    print("=" * 60)
    print(" OSL Studio - Viewport Manifest & Layer Synchronizer")
    print("=" * 60)
    print(f"Scanning directory: {images_dir}")

    folders = scan_viewport_folders(images_dir)
    if not folders:
        print("[ERROR] No viewport folders with images found.")
        sys.exit(1)

    preserve_manual_edits(folders, manifest_file)

    print(f"\nDiscovered {len(folders)} Viewport Folder(s):")
    total_images = 0
    for idx, folder in enumerate(folders, 1):
        print(f"\n [{idx}] {folder['title']} (Folder: '{folder['id']}') - {len(folder['files'])} passes:")
        total_images += len(folder["files"])
        for f in folder["files"]:
            num, name = parse_layer_name(f)
            badge_str = f"[{num}]" if num else "[-]"
            print(f"     -> {badge_str} {name}  ({f})")

    manifest_data = {
        "project": "OSL Studio",
        "folders": folders
    }

    print("\nUpdating project configuration files...")
    update_manifest_json(manifest_file, manifest_data)
    update_viewer_js(viewer_js_file, manifest_data)

    print("\n" + "=" * 60)
    print(f" [SUCCESS] Synchronized {len(folders)} folders & {total_images} total passes.")
    print(" Both manifest.json and viewer.js are up-to-date!")
    print("=" * 60)


if __name__ == "__main__":
    main()
