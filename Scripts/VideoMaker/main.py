import os
import sys
import threading
from pathlib import Path
import cv2
import numpy as np

from PySide6.QtCore import QObject, Signal, Slot, Property, QUrl
from PySide6.QtGui import QGuiApplication
from PySide6.QtQuickControls2 import QQuickStyle
from PySide6.QtQml import QQmlApplicationEngine


DEFAULT_DIR = "D:/madoodia/dev/madoodia.github.io/images/oslviewer/Cinematic_Shots"
if not os.path.isdir(DEFAULT_DIR):
    DEFAULT_DIR = "D:/madoodia/dev/madoodia.github.io/images/oslviewer"


class BatchVideoGeneratorThread(threading.Thread):
    def __init__(self, backend, images, jobs):
        super().__init__()
        self.backend = backend
        self.images = images
        self.jobs = jobs

    def run(self):
        try:
            total_jobs = len(self.jobs)
            for j_idx, job in enumerate(self.jobs):
                out_path = job["out_path"]
                crop_rect = job["crop_rect"]
                target_w = job["target_w"]
                target_h = job["target_h"]
                fps = job["fps"]
                trans_sec = job["trans_sec"]
                hold_sec = job["hold_sec"]
                label = job["name"]

                self.backend.statusChanged.emit(f"Rendering [{j_idx+1}/{total_jobs}]: {label}...")

                fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                writer = cv2.VideoWriter(out_path, fourcc, fps, (target_w, target_h))

                n = len(self.images)
                seq_indices = list(range(n)) + list(range(n - 2, 0, -1)) if n > 1 else [0]

                hold_frames = max(1, int(hold_sec * fps))
                fade_frames = max(1, int(trans_sec * fps))

                total_frames = len(seq_indices) * (hold_frames + fade_frames)
                current_frame = 0

                def load_and_crop(idx):
                    path = self.images[idx]
                    img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
                    if img is None:
                        return np.zeros((target_h, target_w, 3), dtype=np.uint8)

                    ih, iw = img.shape[:2]
                    nx, ny, nw, nh = crop_rect
                    target_aspect = target_w / float(target_h)

                    # Normalized to pixel coords
                    crop_x = int(round(nx * iw))
                    crop_y = int(round(ny * ih))
                    crop_w = int(round(nw * iw))
                    crop_h = int(round(nh * ih))

                    crop_w = max(16, crop_w)
                    crop_h = max(16, crop_h)

                    # Enforce strict target aspect ratio
                    current_aspect = crop_w / float(crop_h)
                    if current_aspect > target_aspect:
                        crop_w = int(round(crop_h * target_aspect))
                    else:
                        crop_h = int(round(crop_w / target_aspect))

                    # Bounds clamping
                    if crop_x + crop_w > iw:
                        crop_x = max(0, iw - crop_w)
                    if crop_y + crop_h > ih:
                        crop_y = max(0, ih - crop_h)

                    crop_x = max(0, crop_x)
                    crop_y = max(0, crop_y)
                    crop_x2 = min(iw, crop_x + crop_w)
                    crop_y2 = min(ih, crop_y + crop_h)

                    cropped = img[crop_y:crop_y2, crop_x:crop_x2]
                    if cropped.size == 0:
                        return np.zeros((target_h, target_w, 3), dtype=np.uint8)

                    interp = cv2.INTER_AREA if (crop_w >= target_w and crop_h >= target_h) else cv2.INTER_LANCZOS4
                    return cv2.resize(cropped, (target_w, target_h), interpolation=interp)

                for s_idx in range(len(seq_indices)):
                    curr_img = load_and_crop(seq_indices[s_idx])
                    next_idx = seq_indices[(s_idx + 1) % len(seq_indices)]
                    next_img = load_and_crop(next_idx)

                    for _ in range(hold_frames):
                        writer.write(curr_img)
                        current_frame += 1
                        job_pct = current_frame / float(total_frames)
                        overall_pct = int(((j_idx + job_pct) / float(total_jobs)) * 100)
                        self.backend.progressChanged.emit(overall_pct)

                    for f in range(fade_frames):
                        alpha = f / float(fade_frames)
                        blended = cv2.addWeighted(curr_img, 1.0 - alpha, next_img, alpha, 0.0)
                        writer.write(blended)
                        current_frame += 1
                        job_pct = current_frame / float(total_frames)
                        overall_pct = int(((j_idx + job_pct) / float(total_jobs)) * 100)
                        self.backend.progressChanged.emit(overall_pct)

                writer.release()

            self.backend.progressChanged.emit(100)
            self.backend.exportFinished.emit(True, f"Rendered {total_jobs} video(s) successfully.")
        except Exception as e:
            self.backend.exportFinished.emit(False, f"Export failed: {e}")


class PingPongBackend(QObject):
    folderChanged = Signal()
    imagesLoaded = Signal()
    progressChanged = Signal(int)
    exportFinished = Signal(bool, str)
    statusChanged = Signal(str)
    queueChanged = Signal()
    activeSlotChanged = Signal()

    def __init__(self):
        super().__init__()
        self._folder_path = ""
        self._images = []
        self._orig_w = 3840
        self._orig_h = 2160
        self._status = "Ready"
        self._video_queue = []
        self._active_index = -1

    @Property(str, notify=folderChanged)
    def folderPath(self):
        return self._folder_path

    @Property(int, notify=imagesLoaded)
    def sampleWidth(self):
        return self._orig_w

    @Property(int, notify=imagesLoaded)
    def sampleHeight(self):
        return self._orig_h

    @Property(int, notify=folderChanged)
    def imageCount(self):
        return len(self._images)

    @Property(str, notify=statusChanged)
    def statusMessage(self):
        return self._status

    @Property(list, notify=queueChanged)
    def videoQueue(self):
        return self._video_queue

    @Property(int, notify=activeSlotChanged)
    def activeSlotIndex(self):
        return self._active_index

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

        valid_exts = {".png", ".jpg", ".jpeg", ".bmp"}
        entries = sorted([
            f for f in os.listdir(clean_path)
            if os.path.splitext(f)[1].lower() in valid_exts
        ])

        self._images = [os.path.join(clean_path, f).replace("\\", "/") for f in entries]

        if self._images:
            first_img_path = self._images[0]
            img = cv2.imdecode(np.fromfile(first_img_path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
            if img is not None:
                self._orig_h, self._orig_w = img.shape[:2]

            self.imagesLoaded.emit()
            self._status = f"Loaded {len(self._images)} images ({self._orig_w}x{self._orig_h})."

            if not self._video_queue:
                self.addVideoSlot("shot_01_native", 0.0, 0.0, 1.0, 1.0, self._orig_w, self._orig_h, 60, 0.6, 0.8)
        else:
            self._status = "No valid image files found in folder."

        self.statusChanged.emit(self._status)

    @Slot(float, result=list)
    def getCrossfadeInfo(self, scrub_pos):
        if not self._images:
            return ["", "", 0.0]

        n = len(self._images)
        if n == 1:
            url = QUrl.fromLocalFile(self._images[0]).toString()
            return [url, url, 0.0]

        total_steps = 2 * (n - 1)
        step_pos = max(0.0, min(1.0, scrub_pos)) * total_steps
        step_idx = min(int(step_pos), total_steps - 1)
        alpha = step_pos - step_idx

        if step_idx < (n - 1):
            idx_a = step_idx
            idx_b = step_idx + 1
        else:
            offset = step_idx - (n - 1)
            idx_a = (n - 1) - offset
            idx_b = max(0, idx_a - 1)

        url_a = QUrl.fromLocalFile(self._images[idx_a]).toString()
        url_b = QUrl.fromLocalFile(self._images[idx_b]).toString()
        return [url_a, url_b, float(alpha)]

    @Slot(int)
    def selectSlot(self, index):
        if 0 <= index < len(self._video_queue):
            self._active_index = index
            self.activeSlotChanged.emit()

    @Slot(int, result="QVariantMap")
    def getSlotData(self, index):
        if 0 <= index < len(self._video_queue):
            return self._video_queue[index]
        return {}

    @Slot(int, float, float, float, float)
    def updateSlotCrop(self, index, nx, ny, nw, nh):
        if 0 <= index < len(self._video_queue):
            nx = max(0.0, min(1.0, float(nx)))
            ny = max(0.0, min(1.0, float(ny)))
            nw = max(0.01, min(1.0, float(nw)))
            nh = max(0.01, min(1.0, float(nh)))
            self._video_queue[index]["crop_rect"] = (nx, ny, nw, nh)
            self._video_queue[index]["nx"] = nx
            self._video_queue[index]["ny"] = ny
            self._video_queue[index]["nw"] = nw
            self._video_queue[index]["nh"] = nh
            self.queueChanged.emit()

    @Slot(int, str, int, int, int, float, float)
    def updateSlotParams(self, index, name, target_w, target_h, fps, trans_sec, hold_sec):
        if 0 <= index < len(self._video_queue):
            clean_name = name.strip()
            if not clean_name.endswith(".mp4"):
                clean_name += ".mp4"

            out_path = os.path.join(self._folder_path, clean_name).replace("\\", "/")

            slot = self._video_queue[index]
            slot["name"] = clean_name
            slot["out_path"] = out_path
            slot["target_w"] = int(target_w)
            slot["target_h"] = int(target_h)
            slot["fps"] = int(fps)
            slot["trans_sec"] = float(trans_sec)
            slot["hold_sec"] = float(hold_sec)
            slot["summary"] = f"{target_w}x{target_h} @ {fps}fps | Hold: {hold_sec}s, Fade: {trans_sec}s"

            self.queueChanged.emit()

    @Slot("QVariant", "QVariant", "QVariant", "QVariant", "QVariant", "QVariant", "QVariant", "QVariant", "QVariant", "QVariant")
    def addVideoSlot(self, slot_name, norm_x, norm_y, norm_w, norm_h, target_w, target_h, fps, trans_sec, hold_sec):
        name_str = str(slot_name).strip() if slot_name else ""
        try:
            nx = max(0.0, min(1.0, float(norm_x)))
            ny = max(0.0, min(1.0, float(norm_y)))
            nw = max(0.01, min(1.0, float(norm_w)))
            nh = max(0.01, min(1.0, float(norm_h)))
            tw = max(16, int(target_w))
            th = max(16, int(target_h))
            f = max(1, int(fps))
            ts = max(0.1, float(trans_sec))
            hs = max(0.1, float(hold_sec))
        except (ValueError, TypeError):
            nx, ny, nw, nh = 0.0, 0.0, 1.0, 1.0
            tw, th = self._orig_w, self._orig_h
            f, ts, hs = 60, 0.6, 0.8

        if not name_str:
            name_str = f"shot_{len(self._video_queue) + 1:02d}_{tw}x{th}"
        if not name_str.endswith(".mp4"):
            name_str += ".mp4"

        out_path = os.path.join(self._folder_path, name_str).replace("\\", "/")

        job = {
            "name": name_str,
            "out_path": out_path,
            "crop_rect": (nx, ny, nw, nh),
            "nx": nx,
            "ny": ny,
            "nw": nw,
            "nh": nh,
            "target_w": tw,
            "target_h": th,
            "fps": f,
            "trans_sec": ts,
            "hold_sec": hs,
            "summary": f"{tw}x{th} @ {f}fps | Hold: {hs}s, Fade: {ts}s"
        }
        self._video_queue.append(job)
        self._active_index = len(self._video_queue) - 1
        self.queueChanged.emit()
        self.activeSlotChanged.emit()
        self._status = f"Added '{name_str}' to export queue."
        self.statusChanged.emit(self._status)

    @Slot(int)
    def removeVideoSlot(self, index):
        if 0 <= index < len(self._video_queue):
            removed = self._video_queue.pop(index)
            if self._active_index >= len(self._video_queue):
                self._active_index = len(self._video_queue) - 1
            self.queueChanged.emit()
            self.activeSlotChanged.emit()
            self._status = f"Removed '{removed['name']}'."
            self.statusChanged.emit(self._status)

    @Slot()
    def clearQueue(self):
        self._video_queue.clear()
        self._active_index = -1
        self.queueChanged.emit()
        self.activeSlotChanged.emit()
        self._status = "Queue cleared."
        self.statusChanged.emit(self._status)

    @Slot()
    def renderQueue(self):
        if not self._images:
            self._status = "No images to process."
            self.statusChanged.emit(self._status)
            return

        if not self._video_queue:
            self._status = "No video slots queued."
            self.statusChanged.emit(self._status)
            return

        self._status = f"Rendering {len(self._video_queue)} queued video(s)..."
        self.statusChanged.emit(self._status)

        worker = BatchVideoGeneratorThread(self, self._images, list(self._video_queue))
        worker.daemon = True
        worker.start()


if __name__ == "__main__":
    os.environ["QT_QUICK_CONTROLS_STYLE"] = "Basic"
    app = QGuiApplication(sys.argv)
    QQuickStyle.setStyle("Basic")

    engine = QQmlApplicationEngine()
    backend = PingPongBackend()
    engine.rootContext().setContextProperty("backend", backend)

    backend.loadFolder(DEFAULT_DIR)

    qml_file = Path(__file__).resolve().parent / "main.qml"
    engine.load(str(qml_file))

    if not engine.rootObjects():
        sys.exit(-1)

    sys.exit(app.exec())
