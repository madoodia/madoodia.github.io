import os
import re
import sys
from pathlib import Path
from PySide6.QtCore import QObject, Signal, Slot, Property, QUrl, QRect
from PySide6.QtGui import QGuiApplication, QImage, QPainter, QColor, QFont, QFontMetrics
from PySide6.QtQuickControls2 import QQuickStyle
from PySide6.QtQml import QQmlApplicationEngine


DEFAULT_DIR = "D:/madoodia/dev/OSLViewer/RenderOutputs"
DEFAULT_ICON = "D:/madoodia/dev/OSLViewer/Icons/Copyright_white.png"


class RenamerBackend(QObject):
    folderChanged = Signal()
    extensionsChanged = Signal()
    previewUpdated = Signal()
    statusChanged = Signal(str)
    watermarkConfigChanged = Signal()

    def __init__(self):
        super().__init__()
        self._folder_path = ""
        self._active_extensions = set()
        self._detected_extensions = []
        self._all_items = []      # Master raw list of files
        self._visible_items = []  # Filtered & ordered list shown in UI
        self._current_pattern = "[##].[name].[ext]"
        self._status = "Ready"

        # Watermark settings
        self._watermark_enabled = False
        self._watermark_type = "Image"  # "Image" or "Text"
        self._watermark_text = "© 2026 madoodia.com"
        self._watermark_image_path = DEFAULT_ICON if os.path.exists(DEFAULT_ICON) else ""
        self._watermark_position = "Bottom-Left"  # "Bottom-Left", "Bottom-Right", "Top-Left", "Top-Right", "Center"
        self._watermark_padding = 24
        self._watermark_height = 28

    @Property(str, notify=folderChanged)
    def folderPath(self):
        return self._folder_path

    @Property(list, notify=extensionsChanged)
    def detectedExtensions(self):
        return self._detected_extensions

    @Property(list, notify=previewUpdated)
    def previewData(self):
        return self._visible_items

    @Property(str, notify=statusChanged)
    def statusMessage(self):
        return self._status

    # --- Watermark Properties ---
    @Property(bool, notify=watermarkConfigChanged)
    def watermarkEnabled(self):
        return self._watermark_enabled

    @watermarkEnabled.setter
    def watermarkEnabled(self, val):
        if self._watermark_enabled != val:
            self._watermark_enabled = val
            self.watermarkConfigChanged.emit()

    @Property(str, notify=watermarkConfigChanged)
    def watermarkType(self):
        return self._watermark_type

    @watermarkType.setter
    def watermarkType(self, val):
        if self._watermark_type != val:
            self._watermark_type = val
            self.watermarkConfigChanged.emit()

    @Property(str, notify=watermarkConfigChanged)
    def watermarkText(self):
        return self._watermark_text

    @watermarkText.setter
    def watermarkText(self, val):
        if self._watermark_text != val:
            self._watermark_text = val
            self.watermarkConfigChanged.emit()

    @Property(str, notify=watermarkConfigChanged)
    def watermarkImagePath(self):
        return self._watermark_image_path

    @watermarkImagePath.setter
    def watermarkImagePath(self, val):
        cleaned = self._clean_path(val)
        if self._watermark_image_path != cleaned:
            self._watermark_image_path = cleaned
            self.watermarkConfigChanged.emit()

    @Property(str, notify=watermarkConfigChanged)
    def watermarkPosition(self):
        return self._watermark_position

    @watermarkPosition.setter
    def watermarkPosition(self, val):
        if self._watermark_position != val:
            self._watermark_position = val
            self.watermarkConfigChanged.emit()

    @Property(int, notify=watermarkConfigChanged)
    def watermarkPadding(self):
        return self._watermark_padding

    @watermarkPadding.setter
    def watermarkPadding(self, val):
        if self._watermark_padding != val:
            self._watermark_padding = val
            self.watermarkConfigChanged.emit()

    @Property(int, notify=watermarkConfigChanged)
    def watermarkHeight(self):
        return self._watermark_height

    @watermarkHeight.setter
    def watermarkHeight(self, val):
        if self._watermark_height != val:
            self._watermark_height = val
            self.watermarkConfigChanged.emit()

    def _clean_path(self, path):
        if not path:
            return ""
        if path.startswith("file:"):
            url = QUrl(path)
            path = url.toLocalFile()
        return os.path.normpath(path).replace("\\", "/")

    @Slot(str)
    def loadFolder(self, path=""):
        target_path = path if path else DEFAULT_DIR
        clean_path = self._clean_path(target_path)

        if not os.path.isdir(clean_path):
            self._folder_path = clean_path
            self.folderChanged.emit()
            self._status = f"Directory not found: '{clean_path}'"
            self.statusChanged.emit(self._status)
            return

        self._folder_path = clean_path
        self.folderChanged.emit()

        try:
            entries = os.listdir(clean_path)
        except Exception as e:
            self._status = f"Permission error: {e}"
            self.statusChanged.emit(self._status)
            return

        all_files = [
            f for f in sorted(entries)
            if os.path.isfile(os.path.join(clean_path, f))
        ]

        exts = sorted(list({
            os.path.splitext(f)[1].lstrip(".").lower()
            for f in all_files if "." in f and os.path.splitext(f)[1].lstrip(".")
        }))

        self._detected_extensions = exts
        # Default: Only enable PNG if found; otherwise activate first extension
        self._active_extensions = {"png"} if "png" in exts else (set(exts[:1]) if exts else set())
        self.extensionsChanged.emit()

        master_list = []
        for f in all_files:
            ext = os.path.splitext(f)[1].lstrip(".").lower()
            file_abs = os.path.join(clean_path, f).replace("\\", "/")
            master_list.append({
                "old": f,
                "new": f,
                "url": QUrl.fromLocalFile(file_abs).toString(),
                "ext": ext
            })

        self._all_items = master_list
        self._rebuild_visible_items()
        self._status = f"Loaded {len(all_files)} files ({len(self._visible_items)} active in view)."
        self.statusChanged.emit(self._status)

    def _rebuild_visible_items(self):
        self._visible_items = [
            dict(item) for item in self._all_items
            if item["ext"] in self._active_extensions
        ]
        self.generatePreview(self._current_pattern)

    @Slot(str, bool, str)
    def toggleExtension(self, ext, enabled, pattern):
        self._current_pattern = pattern
        if enabled:
            self._active_extensions.add(ext)
        else:
            self._active_extensions.discard(ext)
        self._rebuild_visible_items()

    @Slot(str, result=bool)
    def isExtensionActive(self, ext):
        return ext in self._active_extensions

    @Slot(int, int, str)
    def moveItem(self, from_idx, to_idx, pattern):
        if 0 <= from_idx < len(self._visible_items) and 0 <= to_idx < len(self._visible_items):
            item = self._visible_items.pop(from_idx)
            self._visible_items.insert(to_idx, item)
            self.generatePreview(pattern)

    @Slot(int, str)
    def updateManualName(self, index, custom_name):
        if 0 <= index < len(self._visible_items):
            self._visible_items[index]["new"] = custom_name.strip()
            self.previewUpdated.emit()

    @Slot(str)
    def generatePreview(self, pattern):
        self._current_pattern = pattern
        if not self._folder_path or not self._visible_items:
            self.previewUpdated.emit()
            return

        pad_match = re.search(r"\[(#+)\]", pattern)
        pad_len = len(pad_match.group(1)) if pad_match else 2

        counter = 1
        for item in self._visible_items:
            stem, ext = os.path.splitext(item["old"])
            tokens = [t for t in re.split(r"[_\.]+", stem) if t]

            name_tokens = []
            for t in reversed(tokens):
                if t.isdigit():
                    break
                name_tokens.insert(0, t)
                if len(name_tokens) == 2:
                    break

            if not name_tokens and tokens:
                name_tokens = [tokens[-1]]

            descriptive_name = ".".join(name_tokens)

            new_name = pattern
            new_name = re.sub(r"\[#+\]", f"{counter:0{pad_len}d}", new_name)
            new_name = new_name.replace("[name]", descriptive_name)
            new_name = new_name.replace("[ext]", item["ext"])

            for i, tok in enumerate(tokens):
                new_name = new_name.replace(f"[{i}]", tok)
                new_name = new_name.replace(f"[{-len(tokens) + i}]", tok)

            item["new"] = new_name
            counter += 1

        self.previewUpdated.emit()

    def _apply_watermark_to_file(self, file_path):
        """Applies configured image or text watermark onto the specified image file before renaming."""
        try:
            img = QImage(file_path)
            if img.isNull() or img.width() <= 1:
                return

            if img.format() != QImage.Format_ARGB32_Premultiplied:
                img = img.convertToFormat(QImage.Format_ARGB32_Premultiplied)

            painter = QPainter(img)
            painter.setRenderHint(QPainter.Antialiasing)
            painter.setRenderHint(QPainter.SmoothPixmapTransform)

            w = img.width()
            h = img.height()
            pad = max(4, self._watermark_padding)

            if self._watermark_type == "Image":
                stamp_path = self._clean_path(self._watermark_image_path)
                if not os.path.exists(stamp_path):
                    # fallback
                    fallback = os.path.normpath(os.path.join(os.path.dirname(__file__), "../../Icons/Copyright_white.png"))
                    if os.path.exists(fallback):
                        stamp_path = fallback

                stamp = QImage(stamp_path)
                if not stamp.isNull():
                    target_h = max(12, min(self._watermark_height, h // 4))
                    target_w = int(stamp.width() * (target_h / stamp.height()))

                    if self._watermark_position == "Bottom-Left":
                        x = pad
                        y = h - pad - target_h
                    elif self._watermark_position == "Bottom-Right":
                        x = w - pad - target_w
                        y = h - pad - target_h
                    elif self._watermark_position == "Top-Left":
                        x = pad
                        y = pad
                    elif self._watermark_position == "Top-Right":
                        x = w - pad - target_w
                        y = pad
                    else:  # Center
                        x = (w - target_w) // 2
                        y = (h - target_h) // 2

                    painter.setOpacity(0.9)
                    painter.drawImage(QRect(x, y, target_w, target_h), stamp)
            else:
                # Text watermark
                text = self._watermark_text or "© 2026 madoodia.com"
                font_sz = max(10, min(self._watermark_height, h // 12))
                font = QFont("Tomorrow, Segoe UI, sans-serif", font_sz, QFont.Bold)
                painter.setFont(font)
                fm = QFontMetrics(font)
                tw = fm.horizontalAdvance(text)
                th = fm.height()

                if self._watermark_position == "Bottom-Left":
                    x = pad
                    y = h - pad - th
                elif self._watermark_position == "Bottom-Right":
                    x = w - pad - tw
                    y = h - pad - th
                elif self._watermark_position == "Top-Left":
                    x = pad
                    y = pad
                elif self._watermark_position == "Top-Right":
                    x = w - pad - tw
                    y = pad
                else:  # Center
                    x = (w - tw) // 2
                    y = (h - th) // 2

                # Shadow for high contrast on light/dark scenes
                painter.setPen(QColor(0, 0, 0, 210))
                painter.drawText(x + 1, y + th - 2, text)
                painter.setPen(QColor(255, 255, 255, 240))
                painter.drawText(x, y + th - 3, text)

            painter.end()
            img.save(file_path)
        except Exception as e:
            print(f"Watermark error on {file_path}: {e}")

    @Slot()
    def applyInPlaceRename(self):
        if not self._folder_path or not self._visible_items:
            return

        actions = [
            (item["old"], item["new"])
            for item in self._visible_items
            if item["old"] != item["new"]
        ]

        # If watermarking is enabled, all active images receive watermark even if name didn't change
        if self._watermark_enabled:
            stamped_count = 0
            for item in self._visible_items:
                f_path = os.path.join(self._folder_path, item["old"])
                if os.path.exists(f_path):
                    self._apply_watermark_to_file(f_path)
                    stamped_count += 1

        if not actions:
            if self._watermark_enabled:
                self._status = f"Successfully stamped watermark on {len(self._visible_items)} files."
            else:
                self._status = "No files require renaming."
            self.statusChanged.emit(self._status)
            return

        # Double-buffer renames with unique temporary prefixes to prevent ordering collisions
        temp_map = []
        try:
            for idx, (old_name, new_name) in enumerate(actions):
                src = os.path.join(self._folder_path, old_name)
                temp = os.path.join(self._folder_path, f"__tmp_renamer_{idx}_{old_name}")
                if os.path.exists(src):
                    os.rename(src, temp)
                    temp_map.append((temp, os.path.join(self._folder_path, new_name)))

            for temp, dst in temp_map:
                os.rename(temp, dst)

            wm_msg = f" (Watermark stamped on {len(self._visible_items)} files)" if self._watermark_enabled else ""
            self._status = f"Successfully renamed {len(actions)} files in-place{wm_msg}."
        except Exception as e:
            self._status = f"Error during in-place rename: {e}"

        self.statusChanged.emit(self._status)
        self.loadFolder(self._folder_path)


if __name__ == "__main__":
    os.environ["QT_QUICK_CONTROLS_STYLE"] = "Basic"
    app = QGuiApplication(sys.argv)
    QQuickStyle.setStyle("Basic")

    engine = QQmlApplicationEngine()
    backend = RenamerBackend()
    engine.rootContext().setContextProperty("backend", backend)

    backend.loadFolder(DEFAULT_DIR)

    qml_file = Path(__file__).resolve().parent / "main.qml"
    engine.load(str(qml_file))

    if not engine.rootObjects():
        sys.exit(-1)

    sys.exit(app.exec())
