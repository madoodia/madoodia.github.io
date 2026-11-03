/**
 * OSL Studio - Advanced LookDev & Multi-Pass Interactive Inspection
 * Dynamic Viewport Slides, Multi-Curtain Cascading Wipes, and Local A/B Testing
 * madoodia.com - Reza Aarabi
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // 1. Dynamic Manifest & Layer Model
  // ==========================================================================
  const DEFAULT_MANIFEST = {
    "project": "OSL Studio",
    "folders": [
      {
        "id": "Cinematic_Shots",
        "title": "Cinematic_Shots",
        "files": [
          "01.flat.png",
          "02.flat.png",
          "03.render.depth.png",
          "04.render.png",
          "05.dof.debug.png",
          "06.render.post.png",
          "07.render.post.png",
          "08.render.post.png",
          "09.render.post.png",
          "10.render.post.png",
          "11.render.post.png",
          "12.render.post.png",
          "13.render.post.png",
          "14.render.post.png"
        ]
      },
      {
        "id": "Viewport01",
        "title": "Viewport 01",
        "files": [
          "01.wireframe.png",
          "02.3d.png",
          "03.zdepth.png",
          "04.render.png",
          "05.debug.dof.png",
          "06.render.dof.png"
        ]
      },
      {
        "id": "Viewport2",
        "title": "Viewport 2",
        "files": [
          "01.debug.dof.png",
          "02.render.dof.png"
        ]
      }
    ]
  };

  /**
   * Parse layer filename: extracts sequence number and name between '##.' and '.png'
   * Example: '04.debug.dof.png' -> num: '04', name: 'debug.dof'
   * Guarantees no duplicated names in UI badges.
   */
  function parseLayerFile(folderId, filename, layerIndex) {
    const m = filename.match(/^(\d+)\.(.+)\.(png|jpg|jpeg|webp)$/i);
    let num, name;
    if (m) {
      num = m[1];
      name = m[2]; // Clean name between ##. and .png
    } else {
      num = (layerIndex + 1).toString().padStart(2, "0");
      name = filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
    }
    return {
      id: layerIndex + 1,
      num: num,
      name: name,
      shortTitle: name,
      filename: filename,
      src: `../images/oslviewer/${folderId}/${filename}`,
      opacity: 100,
      blend: "normal",
      visible: true
    };
  }

  let foldersList = DEFAULT_MANIFEST.folders;
  let currentFolderIndex = 0;
  let currentFolder = foldersList[0];
  let folderLayers = [];       // All layers available in the active folder
  let selectedLayerIds = [];   // IDs of layers selected for display/curtain
  let activeLayers = [];       // Filtered active layers, ordered by ID
  let multiMode = "curtain";   // Default view mode: Multi-Curtain Wipe
  let curtainPositions = [];
  let activeSoloIndex = null;
  let cycleInterval = null;

  // DOM Elements - Multi Stack
  const multiStageCard = document.getElementById("multi-stage-card");
  const multiCanvas = document.getElementById("multi-canvas");
  const curtainDividers = document.getElementById("multi-curtain-dividers");
  const matrixContainer = document.getElementById("matrix-grid-container");
  const layerRowsList = document.getElementById("layer-rows-list");
  const scrubSlider = document.getElementById("scrub-range-slider");
  const scrubTicksWrap = document.getElementById("scrub-ticks-wrap");
  const activePillNum = document.getElementById("active-layer-num");
  const activePillTitle = document.getElementById("active-layer-title");
  const autoCycleBtn = document.getElementById("btn-auto-cycle");
  const equalizeBtn = document.getElementById("btn-equalize-curtain");
  const curtainStageWrap = document.getElementById("curtain-stage-wrap");
  const curtainLabelsLeft = document.getElementById("curtain-labels-left");
  const curtainLabelsRight = document.getElementById("curtain-labels-right");

  // DOM Elements - Folder Slides Navigation
  const folderPillsWrap = document.getElementById("folder-pills-wrap");
  const btnPrevFolder = document.getElementById("btn-prev-folder");
  const btnNextFolder = document.getElementById("btn-next-folder");

  // DOM Elements - Pass Chooser (Point 5)
  const curtainChipsContainer = document.getElementById("curtain-chips-container");
  const btnCurtainSelectAll = document.getElementById("btn-curtain-select-all");
  const btnCurtainSelectAB = document.getElementById("btn-curtain-select-ab");
  const btnCurtainResetOrder = document.getElementById("btn-curtain-reset-order");

  // DOM Elements - Pass Descriptions
  const btnToggleDescriptions = document.getElementById("btn-toggle-descriptions");
  const btnEditDescriptions = document.getElementById("btn-edit-descriptions");
  const btnDownloadManifest = document.getElementById("btn-download-manifest");
  const descriptionEditor = document.getElementById("pass-description-editor");
  const descriptionEditorList = document.getElementById("description-editor-list");

  // Drag and Drop State for Pass Chips Reordering
  let draggedLayerId = null;
  let isDraggingChip = false;
  let dragJustEnded = false;

  // ==========================================================================
  // 1b. Local Drafts: pass order & descriptions saved in this browser
  // ==========================================================================
  const DRAFTS_KEY = "oslviewer.drafts.v1";
  const SHOW_DESCRIPTIONS_KEY = "oslviewer.showDescriptions.v1";

  // Editing is for the author: local copies, or the live page opened with ?edit
  const canEditDescriptions =
    location.protocol === "file:" ||
    ["localhost", "127.0.0.1"].includes(location.hostname) ||
    new URLSearchParams(location.search).has("edit");

  let showDescriptions = readStorage(SHOW_DESCRIPTIONS_KEY, true) !== false;

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {}
  }

  function saveFolderDraft(folder, field, value) {
    const drafts = readStorage(DRAFTS_KEY, {});
    drafts[folder.id] = { ...drafts[folder.id], [field]: value };
    writeStorage(DRAFTS_KEY, drafts);
  }

  function descriptionsKey(descriptions) {
    return JSON.stringify(Object.entries(descriptions || {}).sort());
  }

  // Layer saved drafts over the manifest. A draft that now matches the manifest has
  // been published, so it is dropped and later manifest changes are not masked by it.
  function applyDrafts() {
    const drafts = readStorage(DRAFTS_KEY, {});
    foldersList.forEach((folder) => {
      const draft = drafts[folder.id];
      if (!draft) return;

      if (draft.order) {
        const kept = draft.order.filter((f) => folder.files.includes(f));
        const merged = kept.concat(folder.files.filter((f) => !kept.includes(f)));
        if (merged.join("\n") === folder.files.join("\n")) delete draft.order;
        else folder.files = merged;
      }

      if (draft.descriptions) {
        if (descriptionsKey(draft.descriptions) === descriptionsKey(folder.descriptions)) delete draft.descriptions;
        else folder.descriptions = draft.descriptions;
      }

      if (Object.keys(draft).length === 0) delete drafts[folder.id];
    });
    writeStorage(DRAFTS_KEY, drafts);
  }

  // ==========================================================================
  // 2. Folder Slides Navigation (Point 2)
  // ==========================================================================
  function renderFolderPills() {
    if (!folderPillsWrap) return;
    folderPillsWrap.innerHTML = "";
    foldersList.forEach((folder, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `folder-slide-pill ${idx === currentFolderIndex ? "active" : ""}`;
      btn.innerHTML = `
        <i class="fa-solid fa-folder-open"></i>
        <span class="folder-pill-name">${folder.title || folder.id}</span>
        <span class="folder-pill-count">${folder.files.length} Passes</span>
      `;
      btn.addEventListener("click", () => switchFolder(idx));
      folderPillsWrap.appendChild(btn);
    });
  }

  function switchFolder(folderIdx) {
    if (folderIdx < 0) folderIdx = foldersList.length - 1;
    if (folderIdx >= foldersList.length) folderIdx = 0;
    currentFolderIndex = folderIdx;
    currentFolder = foldersList[folderIdx];

    // Parse layers for this folder
    folderLayers = currentFolder.files.map((file, i) => parseLayerFile(currentFolder.id, file, i));
    folderLayers.forEach((layer) => {
      layer.description = (currentFolder.descriptions || {})[layer.filename] || "";
    });

    // Default selection: all layers in folder
    selectedLayerIds = folderLayers.map(l => l.id);
    activeLayers = folderLayers.slice();
    activeSoloIndex = null;

    renderFolderPills();
    renderPassSelectorChips();
    renderDescriptionEditor();
    buildMultiCanvasDOM();
    buildScrubberDOM();
    setMultiMode(multiMode);
    updateLocalTesterDefaults();
  }

  if (btnPrevFolder) {
    btnPrevFolder.addEventListener("click", () => switchFolder(currentFolderIndex - 1));
  }
  if (btnNextFolder) {
    btnNextFolder.addEventListener("click", () => switchFolder(currentFolderIndex + 1));
  }

  // ==========================================================================
  // 3. Dynamic Pass Chooser for Multi-Curtain (Drag & Drop Reordering)
  // ==========================================================================
  function renderPassSelectorChips() {
    if (!curtainChipsContainer) return;
    curtainChipsContainer.innerHTML = "";

    folderLayers.forEach((layer) => {
      const isSelected = selectedLayerIds.includes(layer.id);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `pass-chip ${isSelected ? "selected" : ""}`;
      chip.title = `Toggle Pass ${layer.num}: ${layer.name} (Drag to reorder sequence)`;
      chip.setAttribute("draggable", "true");
      chip.setAttribute("data-id", layer.id);

      chip.innerHTML = `
        <span class="chip-drag-handle" title="Drag to reorder pass"><i class="fa-solid fa-grip-vertical"></i></span>
        <span class="chip-check"><i class="fa-solid ${isSelected ? "fa-check" : "fa-plus"}"></i></span>
        <span class="chip-num">${layer.num}</span>
        <span class="chip-name">${layer.name}</span>
      `;

      // Drag and Drop Event Handlers
      chip.addEventListener("dragstart", (e) => {
        draggedLayerId = layer.id;
        isDraggingChip = true;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", layer.id.toString());
        chip.classList.add("dragging");
      });

      chip.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (draggedLayerId === layer.id) {
          chip.classList.remove("drag-over-left", "drag-over-right");
          return;
        }
        const rect = chip.getBoundingClientRect();
        const isRight = (e.clientX - rect.left) > rect.width / 2;
        chip.classList.toggle("drag-over-left", !isRight);
        chip.classList.toggle("drag-over-right", isRight);
      });

      chip.addEventListener("dragleave", () => {
        chip.classList.remove("drag-over-left", "drag-over-right");
      });

      chip.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        chip.classList.remove("drag-over-left", "drag-over-right");
        if (draggedLayerId === null || draggedLayerId === layer.id) return;

        const srcIdx = folderLayers.findIndex((l) => l.id === draggedLayerId);
        if (srcIdx < 0) return;

        const rect = chip.getBoundingClientRect();
        const isRight = (e.clientX - rect.left) > rect.width / 2;

        const [movedItem] = folderLayers.splice(srcIdx, 1);
        let tgtIdx = folderLayers.findIndex((l) => l.id === layer.id);
        if (isRight) tgtIdx += 1;
        folderLayers.splice(tgtIdx, 0, movedItem);

        applyPassOrder();
      });

      chip.addEventListener("dragend", () => {
        chip.classList.remove("dragging");
        if (curtainChipsContainer) {
          curtainChipsContainer.querySelectorAll(".pass-chip").forEach((c) => {
            c.classList.remove("drag-over-left", "drag-over-right", "dragging");
          });
        }
        dragJustEnded = true;
        setTimeout(() => {
          dragJustEnded = false;
          isDraggingChip = false;
          draggedLayerId = null;
        }, 120);
      });

      chip.addEventListener("click", () => {
        if (dragJustEnded || isDraggingChip) return;
        togglePassSelection(layer.id);
      });

      curtainChipsContainer.appendChild(chip);
    });
  }

  // Rebuild every view from folderLayers and remember the order for this folder
  function applyPassOrder() {
    activeLayers = folderLayers.filter((l) => selectedLayerIds.includes(l.id));
    currentFolder.files = folderLayers.map((l) => l.filename);
    saveFolderDraft(currentFolder, "order", currentFolder.files);

    renderPassSelectorChips();
    renderDescriptionEditor();
    buildMultiCanvasDOM();
    buildScrubberDOM();

    if (multiMode === "curtain") {
      setupMultiCurtain();
    } else {
      renderMultiLayers();
    }
  }

  // Handle dropping onto container empty space (moves dragged chip to the end)
  if (curtainChipsContainer) {
    curtainChipsContainer.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    curtainChipsContainer.addEventListener("drop", (e) => {
      if (e.target === curtainChipsContainer && draggedLayerId !== null) {
        e.preventDefault();
        const srcIdx = folderLayers.findIndex((l) => l.id === draggedLayerId);
        if (srcIdx >= 0) {
          const [movedItem] = folderLayers.splice(srcIdx, 1);
          folderLayers.push(movedItem);
          applyPassOrder();
        }
      }
    });
  }

  function togglePassSelection(layerId) {
    const idx = selectedLayerIds.indexOf(layerId);
    if (idx >= 0) {
      // Prevent deselecting if only 1 layer remains
      if (selectedLayerIds.length <= 1) return;
      selectedLayerIds.splice(idx, 1);
    } else {
      selectedLayerIds.push(layerId);
    }

    // Preserve the user-defined order of folderLayers from left to right
    activeLayers = folderLayers.filter((l) => selectedLayerIds.includes(l.id));

    renderPassSelectorChips();
    buildMultiCanvasDOM();
    buildScrubberDOM();

    if (multiMode === "curtain") {
      setupMultiCurtain();
    } else {
      renderMultiLayers();
    }
  }

  if (btnCurtainSelectAll) {
    btnCurtainSelectAll.addEventListener("click", () => {
      selectedLayerIds = folderLayers.map((l) => l.id);
      activeLayers = folderLayers.slice();
      renderPassSelectorChips();
      buildMultiCanvasDOM();
      buildScrubberDOM();
      if (multiMode === "curtain") setupMultiCurtain();
      else renderMultiLayers();
    });
  }

  if (btnCurtainSelectAB) {
    btnCurtainSelectAB.addEventListener("click", () => {
      if (folderLayers.length >= 2) {
        selectedLayerIds = [folderLayers[0].id, folderLayers[folderLayers.length - 1].id];
      } else {
        selectedLayerIds = [folderLayers[0].id];
      }
      activeLayers = folderLayers.filter((l) => selectedLayerIds.includes(l.id));
      renderPassSelectorChips();
      buildMultiCanvasDOM();
      buildScrubberDOM();
      if (multiMode === "curtain") setupMultiCurtain();
      else renderMultiLayers();
    });
  }

  if (btnCurtainResetOrder) {
    btnCurtainResetOrder.addEventListener("click", () => {
      // Restore default numerical sequence (01, 02, 03, ...) from the filenames
      folderLayers.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
      applyPassOrder();
    });
  }

  // ==========================================================================
  // 3b. Pass Descriptions (Editor, Show/Hide Toggle, Manifest Export)
  // ==========================================================================
  const LOGO_ON_DARK = "../images/OSL_Studio_White.png";
  const LOGO_ON_LIGHT = "../images/OSL_Studio_Black.png";
  const LUMA_BUCKETS = 20;
  const bottomLumaCache = {};

  // Average brightness of the image's bottom strip, in LUMA_BUCKETS columns left to right
  function measureBottomLuma(src) {
    if (!bottomLumaCache[src]) {
      bottomLumaCache[src] = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const rows = 8, perBucket = 4;
            const canvas = document.createElement("canvas");
            canvas.width = LUMA_BUCKETS * perBucket;
            canvas.height = rows;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.imageSmoothingQuality = "high";
            const h = img.naturalHeight;
            ctx.drawImage(img, 0, h * 0.85, img.naturalWidth, h * 0.15, 0, 0, canvas.width, rows);
            const data = ctx.getImageData(0, 0, canvas.width, rows).data;

            const lumas = new Array(LUMA_BUCKETS).fill(0);
            for (let y = 0; y < rows; y++) {
              for (let x = 0; x < canvas.width; x++) {
                const i = (y * canvas.width + x) * 4;
                lumas[Math.floor(x / perBucket)] += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
              }
            }
            resolve(lumas.map((sum) => sum / (rows * perBucket)));
          } catch (err) {
            resolve(null); // Pages opened from file:// cannot read pixels
          }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }
    return bottomLumaCache[src];
  }

  // Black logo over bright areas, white logo over dark ones (white when unknown)
  function updateLogoTone(overlay, leftPct) {
    const logo = overlay.querySelector(".pass-logo");
    measureBottomLuma(overlay.dataset.src).then((lumas) => {
      let luma = 0;
      if (lumas) {
        const i = Math.min(LUMA_BUCKETS - 1, Math.floor((leftPct / 100) * LUMA_BUCKETS));
        luma = (lumas[i] + lumas[Math.min(LUMA_BUCKETS - 1, i + 1)]) / 2;
      }
      const next = luma > 0.6 ? LOGO_ON_LIGHT : LOGO_ON_DARK;
      if (logo.getAttribute("src") !== next) logo.src = next;
    });
  }

  // OSL Studio logo (bottom-left) and, when asked for, the description (top-left) over one image
  function createPassOverlay(layer, withCaption) {
    const overlay = document.createElement("div");
    overlay.className = "pass-overlay";
    overlay.dataset.src = layer.src;

    if (withCaption) {
      const caption = document.createElement("div");
      caption.className = "pass-caption";
      caption.dataset.layer = layer.id;
      caption.dir = "auto";
      caption.textContent = layer.description;
      caption.hidden = !layer.description;
      overlay.appendChild(caption);
    }

    const logo = document.createElement("img");
    logo.className = "pass-logo";
    logo.alt = "OSL Studio";

    overlay.appendChild(logo);
    updateLogoTone(overlay, 0);
    return overlay;
  }

  function updateLayerDescription(layer, text) {
    layer.description = text.trim();

    const descriptions = { ...currentFolder.descriptions };
    if (layer.description) descriptions[layer.filename] = layer.description;
    else delete descriptions[layer.filename];
    currentFolder.descriptions = descriptions;
    saveFolderDraft(currentFolder, "descriptions", descriptions);

    // Stage and matrix captions update live while typing
    document.querySelectorAll(`.pass-caption[data-layer="${layer.id}"]`).forEach((el) => {
      el.textContent = layer.description;
      el.hidden = !layer.description;
    });
  }

  function renderDescriptionEditor() {
    if (!descriptionEditorList) return;
    descriptionEditorList.innerHTML = "";

    folderLayers.forEach((layer) => {
      const row = document.createElement("label");
      row.className = "description-row";

      const heading = document.createElement("span");
      heading.className = "description-row-heading";
      const num = document.createElement("span");
      num.className = "description-row-num";
      num.textContent = layer.num;
      heading.append(num, ` ${layer.name}`);

      const input = document.createElement("textarea");
      input.className = "description-input";
      input.rows = 2;
      input.dir = "auto";
      input.placeholder = "Describe this pass...";
      input.value = layer.description;
      input.addEventListener("input", () => updateLayerDescription(layer, input.value));

      row.append(heading, input);
      descriptionEditorList.appendChild(row);
    });
  }

  function syncDescriptionToggle() {
    if (multiStageCard) multiStageCard.classList.toggle("hide-descriptions", !showDescriptions);
    if (!btnToggleDescriptions) return;
    btnToggleDescriptions.classList.toggle("active", showDescriptions);
    btnToggleDescriptions.setAttribute("aria-pressed", showDescriptions.toString());
    btnToggleDescriptions.innerHTML = `<i class="fa-regular ${showDescriptions ? "fa-eye" : "fa-eye-slash"}"></i> Descriptions: ${showDescriptions ? "On" : "Off"}`;
  }

  if (btnToggleDescriptions) {
    btnToggleDescriptions.addEventListener("click", () => {
      showDescriptions = !showDescriptions;
      writeStorage(SHOW_DESCRIPTIONS_KEY, showDescriptions);
      syncDescriptionToggle();
    });
  }
  syncDescriptionToggle();

  if (btnEditDescriptions) {
    btnEditDescriptions.hidden = !canEditDescriptions;
    btnEditDescriptions.addEventListener("click", () => {
      descriptionEditor.hidden = !descriptionEditor.hidden;
      btnEditDescriptions.classList.toggle("active", !descriptionEditor.hidden);
      btnEditDescriptions.setAttribute("aria-expanded", (!descriptionEditor.hidden).toString());
    });
  }

  if (btnDownloadManifest) {
    btnDownloadManifest.addEventListener("click", () => {
      const manifest = { ...DEFAULT_MANIFEST, folders: foldersList };
      const blob = new Blob([JSON.stringify(manifest, null, 2) + "\n"], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "manifest.json";
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }

  // ==========================================================================
  // 4. Multi-Canvas DOM Builder (No Duplicated Names)
  // ==========================================================================
  function buildMultiCanvasDOM() {
    if (!multiCanvas) return;
    multiCanvas.innerHTML = "";

    activeLayers.forEach((layer, idx) => {
      const layerEl = document.createElement("div");
      layerEl.id = `stack-layer-${layer.id}`;
      layerEl.className = "stack-layer";
      layerEl.style.zIndex = (idx + 1).toString();
      layerEl.style.opacity = "1";
      layerEl.innerHTML = `<img src="${layer.src}" alt="${layer.name}" />`;
      layerEl.appendChild(createPassOverlay(layer, false));
      multiCanvas.appendChild(layerEl);
    });

    // Dividers container placed on top of all canvas layers
    const dividers = document.createElement("div");
    dividers.id = "multi-curtain-dividers";
    dividers.className = "multi-curtain-dividers";
    dividers.style.display = multiMode === "curtain" ? "block" : "none";
    multiCanvas.appendChild(dividers);
  }

  // ==========================================================================
  // 5. Multi-Curtain Mode (Cascading Push & Vertically Staggered Knobs)
  // ==========================================================================
  function pushCurtainDividers(dragIdx, targetPct) {
    const M = activeLayers.length - 1;
    if (M < 1) return;

    // Zero gap: allows all divider lines and handles to collapse onto ONE single vertical line at either end
    const clamped = Math.max(0, Math.min(100, targetPct));
    curtainPositions[dragIdx] = clamped;

    // Push right: forward cascade
    for (let j = dragIdx + 1; j < M; j++) {
      if (curtainPositions[j] < curtainPositions[j - 1]) {
        curtainPositions[j] = curtainPositions[j - 1];
      }
    }

    // Push left: backward cascade
    for (let j = dragIdx - 1; j >= 0; j--) {
      if (curtainPositions[j] > curtainPositions[j + 1]) {
        curtainPositions[j] = curtainPositions[j + 1];
      }
    }

    updateCurtainSlices();
  }

  // Pass names beside the stage: one per pass, on the side its slice sits, level with its knob
  let curtainLabels = [];   // One label per active layer, same order
  let curtainKnobTops = []; // Vertical position (%) of each divider knob
  const LABEL_GRAY = [108, 109, 130]; // --text-dim
  const LABEL_CYAN = [0, 240, 255];   // --accent-cyan

  function clearCurtainLabels() {
    curtainLabels = [];
    [curtainLabelsLeft, curtainLabelsRight].forEach((c) => {
      if (c) c.innerHTML = "";
    });
  }

  function createCurtainLabel(layer) {
    const label = document.createElement("div");
    label.className = "curtain-label";
    label.title = layer.filename;

    const num = document.createElement("span");
    num.className = "curtain-label-num";
    num.textContent = layer.num;
    const name = document.createElement("span");
    name.className = "curtain-label-name";
    name.textContent = layer.name;

    label.append(num, name);
    return label;
  }

  if (curtainStageWrap && multiCanvas && window.ResizeObserver) {
    new ResizeObserver(() => {
      curtainStageWrap.style.setProperty("--canvas-h", `${multiCanvas.offsetHeight}px`);
    }).observe(multiCanvas);
  }

  function updateCurtainSlices() {
    const count = activeLayers.length;
    if (count === 0) return;

    if (count === 1) {
      const singleLayer = activeLayers[0];
      const layerEl = document.getElementById(`stack-layer-${singleLayer.id}`);
      if (layerEl) {
        layerEl.style.clipPath = "none";
        layerEl.style.opacity = "1";
        layerEl.style.display = "block";
      }
      return;
    }

    activeLayers.forEach((layer, idx) => {
      const layerEl = document.getElementById(`stack-layer-${layer.id}`);
      if (!layerEl) return;

      const left = (idx === 0) ? 0 : curtainPositions[idx - 1];
      const right = (idx === count - 1) ? 100 : curtainPositions[idx];

      layerEl.style.clipPath = `polygon(${left}% 0%, ${right}% 0%, ${right}% 100%, ${left}% 100%)`;
      layerEl.style.opacity = "1";
      layerEl.style.display = "block";
      layerEl.style.mixBlendMode = "normal";

      // Keep the caption and logo inside their own slice
      const overlay = layerEl.querySelector(".pass-overlay");
      if (overlay) {
        overlay.style.left = `${left}%`;
        overlay.style.width = `${right - left}%`;
        updateLogoTone(overlay, left);
      }
    });

    // Each name sits on the side its slice is on, level with the knob on its outer edge.
    // Its color runs from gray (squeezed shut: loaded, but not showing) to cyan
    // (an equal share of the width or more).
    const equalShare = 100 / count;
    curtainLabels.forEach((label, idx) => {
      const left = (idx === 0) ? 0 : curtainPositions[idx - 1];
      const right = (idx === count - 1) ? 100 : curtainPositions[idx];
      const onLeft = idx === 0 || (idx !== count - 1 && (left + right) / 2 < 50);

      const side = onLeft ? curtainLabelsLeft : curtainLabelsRight;
      if (side && label.parentElement !== side) side.appendChild(label);
      // --canvas-h is the image height, so the label lines up with its knob
      const knobTop = curtainKnobTops[onLeft ? idx : idx - 1];
      label.style.top = `calc(var(--canvas-h, 0px) * ${knobTop / 100})`;

      const t = Math.min(1, (right - left) / equalShare);
      const rgb = LABEL_GRAY.map((g, i) => Math.round(g + (LABEL_CYAN[i] - g) * t));
      label.style.color = `rgb(${rgb.join(", ")})`;
      label.style.opacity = (0.5 + 0.5 * t).toFixed(3);
    });

    const M = count - 1;
    for (let k = 0; k < M; k++) {
      if (curtainPositions[k] !== undefined) {
        const pos = curtainPositions[k];
        const line = document.getElementById(`curtain-line-${k}`);
        const knob = document.getElementById(`curtain-knob-${k}`);
        if (line) line.style.left = `${pos}%`;
        if (knob) knob.style.left = `${pos}%`;
      }
    }
  }

  function setupMultiCurtain() {
    const dividers = document.getElementById("multi-curtain-dividers");
    if (!dividers) return;
    dividers.style.display = "block";
    dividers.innerHTML = "";
    clearCurtainLabels();

    const count = activeLayers.length;
    if (count < 2) {
      curtainPositions = [];
      updateCurtainSlices();
      if (activePillNum && activePillTitle && activeLayers[0]) {
        activePillNum.textContent = activeLayers[0].num;
        activePillTitle.textContent = `${activeLayers[0].num}. ${activeLayers[0].name}`;
      }
      return;
    }

    const M = count - 1;

    // Initialize evenly spaced divider positions if not already matching count
    if (!curtainPositions || curtainPositions.length !== M) {
      curtainPositions = [];
      for (let k = 0; k < M; k++) {
        curtainPositions.push(((k + 1) * 100) / count);
      }
    }

    curtainKnobTops = [];
    curtainLabels = activeLayers.map((layer) => createCurtainLabel(layer));

    // Build interactive draggable divider lines and decoupled knobs (knobs above lines)
    for (let k = 0; k < M; k++) {
      const prevLayer = activeLayers[k];
      const nextLayer = activeLayers[k + 1];
      const dividerTitle = `Divider ${k + 1}: ${prevLayer.name} | ${nextLayer.name}`;
      const topPct = (M <= 1) ? 50 : Math.round(20 + (k / (M - 1)) * 60);
      curtainKnobTops.push(topPct);

      // 1. Divider Line
      const divLine = document.createElement("div");
      divLine.className = "curtain-divider-line";
      divLine.id = `curtain-line-${k}`;
      divLine.style.left = `${curtainPositions[k]}%`;
      divLine.style.zIndex = (40 + k).toString();
      dividers.appendChild(divLine);

      // 2. Divider Knob Handle (sitting above all lines in z-index)
      const knob = document.createElement("div");
      knob.className = "curtain-divider-knob";
      knob.id = `curtain-knob-${k}`;
      knob.setAttribute("data-k", k.toString());
      knob.style.left = `${curtainPositions[k]}%`;
      knob.style.top = `${topPct}%`;
      knob.style.zIndex = (60 + k).toString();
      knob.setAttribute("title", dividerTitle);
      knob.setAttribute("aria-label", dividerTitle);
      knob.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M8.5 7l-5 5 5 5V7zm7 10l5-5-5-5v10z"/>
        </svg>
      `;

      let isDragging = false;

      function startDrag(e) {
        e.stopPropagation();
        e.preventDefault();
        isDragging = true;
        divLine.classList.add("dragging");
        knob.classList.add("dragging");
        knob.style.zIndex = "85";
        divLine.style.zIndex = "84";
        knob.setPointerCapture(e.pointerId);
      }

      function onPointerMove(e) {
        if (!isDragging) return;
        const rect = multiCanvas.getBoundingClientRect();
        if (!rect.width) return;
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        pushCurtainDividers(k, pct);
      }

      function stopDrag(e) {
        if (isDragging) {
          isDragging = false;
          divLine.classList.remove("dragging");
          knob.classList.remove("dragging");
          knob.style.zIndex = (60 + k).toString();
          divLine.style.zIndex = (40 + k).toString();
          try {
            knob.releasePointerCapture(e.pointerId);
          } catch (err) {}
        }
      }

      knob.addEventListener("pointerdown", startDrag);
      knob.addEventListener("pointermove", onPointerMove);
      knob.addEventListener("pointerup", stopDrag);
      knob.addEventListener("pointercancel", stopDrag);

      divLine.addEventListener("pointerdown", startDrag);
      divLine.addEventListener("pointermove", onPointerMove);
      divLine.addEventListener("pointerup", stopDrag);
      divLine.addEventListener("pointercancel", stopDrag);

      knob.addEventListener("dblclick", () => setupMultiCurtain());
      divLine.addEventListener("dblclick", () => setupMultiCurtain());

      dividers.appendChild(knob);
    }

    updateCurtainSlices();

    if (activePillNum && activePillTitle) {
      activePillNum.textContent = "||";
      activePillTitle.textContent = `Multi-Curtain Wipe (${count} Passes)`;
    }
  }

  // Equalize Slices Button
  if (equalizeBtn) {
    equalizeBtn.addEventListener("click", () => setupMultiCurtain());
  }

  // ==========================================================================
  // 6. View Mode Switching (Multi-Curtain, Mixer, Matrix)
  // ==========================================================================
  const multiViewBtns = document.querySelectorAll(".multi-view-btn");
  multiViewBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      multiViewBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.getAttribute("data-multimode");
      setMultiMode(mode);
    });
  });

  function setMultiMode(mode) {
    multiMode = mode;
    multiStageCard.classList.remove("view-curtain", "view-matrix");

    const dividers = document.getElementById("multi-curtain-dividers");
    if (dividers) dividers.style.display = "none";
    clearCurtainLabels();

    if (equalizeBtn) {
      equalizeBtn.style.display = (mode === "curtain") ? "inline-flex" : "none";
    }

    activeLayers.forEach((l) => {
      const layerEl = document.getElementById(`stack-layer-${l.id}`);
      if (layerEl) {
        layerEl.style.clipPath = "none";
        const overlay = layerEl.querySelector(".pass-overlay");
        if (overlay) {
          overlay.style.left = "";
          overlay.style.width = "";
          updateLogoTone(overlay, 0);
        }
      }
    });

    if (mode === "curtain") {
      activeSoloIndex = null;
      multiStageCard.classList.add("view-curtain");
      setupMultiCurtain();
    } else if (mode === "matrix") {
      multiStageCard.classList.add("view-matrix");
      renderMatrixUI();
    } else {
      renderMultiLayers();
      if (activeSoloIndex !== null) {
        toggleSolo(activeSoloIndex);
      }
    }
  }

  // Apply Layer State in Composite Mixer Mode
  function renderMultiLayers() {
    if (multiMode === "curtain") return;

    // Stacked layers would pile their overlays up, so only the top visible one shows
    const topLayer = activeLayers.filter((l) => l.visible).pop();

    activeLayers.forEach((layer) => {
      const layerEl = document.getElementById(`stack-layer-${layer.id}`);
      if (!layerEl) return;

      const overlay = layerEl.querySelector(".pass-overlay");
      if (overlay) overlay.classList.toggle("covered", activeSoloIndex === null && layer !== topLayer);

      if (activeSoloIndex !== null) {
        if (layer.id === activeSoloIndex) {
          layerEl.style.opacity = "1";
          layerEl.style.display = "block";
          layerEl.style.mixBlendMode = "normal";
        } else {
          layerEl.style.opacity = "0";
          layerEl.style.display = "none";
        }
      } else {
        layerEl.style.display = layer.visible ? "block" : "none";
        layerEl.style.opacity = (layer.opacity / 100).toString();
        layerEl.style.mixBlendMode = layer.blend;
      }
    });

    renderLayerDeckUI();
    renderMatrixUI();
  }

  // Toggle Solo Layer
  function toggleSolo(layerId) {
    if (multiMode === "curtain") {
      setMultiMode("mixer");
      multiViewBtns.forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-multimode") === "mixer");
      });
    }

    if (activeSoloIndex === layerId && activeLayers.length > 1) {
      activeSoloIndex = null;
      if (activePillNum) activePillNum.textContent = "Mix";
      if (activePillTitle) activePillTitle.textContent = "Custom Composite Stack";
    } else {
      activeSoloIndex = layerId;
      const target = activeLayers.find((l) => l.id === layerId);
      if (activePillNum) activePillNum.textContent = target ? target.num : layerId;
      if (activePillTitle) activePillTitle.textContent = target ? `${target.num}. ${target.name}` : `Pass ${layerId}`;
      if (scrubSlider) scrubSlider.value = layerId;
      updateScrubTicks(layerId);
    }
    renderMultiLayers();
  }

  // Render Layer Compositing Deck
  function renderLayerDeckUI() {
    if (!layerRowsList) return;
    layerRowsList.innerHTML = "";

    activeLayers.forEach((layer) => {
      const isSolo = activeSoloIndex === layer.id;
      const row = document.createElement("div");
      row.className = `layer-row-card ${isSolo ? "soloed" : ""} ${!layer.visible ? "hidden-layer" : ""}`;

      row.innerHTML = `
        <div class="layer-num-badge" title="Shortcut Key: ${layer.id}">${layer.num}</div>
        <div class="layer-thumb-mini">
          <img src="${layer.src}" alt="${layer.name}">
        </div>
        <div class="layer-title-box">
          <input type="text" class="layer-name-input" value="${layer.name}" data-id="${layer.id}" title="Click to rename pass">
          <span class="layer-sub-txt">${layer.filename}</span>
        </div>
        <div class="layer-opacity-control">
          <input type="range" min="0" max="100" value="${layer.opacity}" data-id="${layer.id}" class="layer-opacity-slider" title="Layer Opacity">
          <span class="layer-opacity-val">${layer.opacity}%</span>
        </div>
        <select class="layer-blend-select" data-id="${layer.id}" title="Layer Blend Mode">
          <option value="normal" ${layer.blend === "normal" ? "selected" : ""}>Normal</option>
          <option value="difference" ${layer.blend === "difference" ? "selected" : ""}>Difference (Diff)</option>
          <option value="multiply" ${layer.blend === "multiply" ? "selected" : ""}>Multiply</option>
          <option value="screen" ${layer.blend === "screen" ? "selected" : ""}>Screen</option>
          <option value="overlay" ${layer.blend === "overlay" ? "selected" : ""}>Overlay</option>
        </select>
        <div class="layer-btn-actions">
          <button type="button" class="layer-icon-btn solo-btn ${isSolo ? "active" : ""}" data-id="${layer.id}" title="Solo pass ${layer.num}">
            <i class="fa-solid fa-bullseye"></i>
          </button>
          <button type="button" class="layer-icon-btn eye-btn ${layer.visible ? "active" : ""}" data-id="${layer.id}" title="Toggle visibility">
            <i class="fa-regular ${layer.visible ? "fa-eye" : "fa-eye-slash"}"></i>
          </button>
        </div>
      `;

      // Event Listeners for Row Controls
      const nameInput = row.querySelector(".layer-name-input");
      nameInput.addEventListener("change", (e) => {
        layer.name = e.target.value;
      });

      const opSlider = row.querySelector(".layer-opacity-slider");
      const opVal = row.querySelector(".layer-opacity-val");
      opSlider.addEventListener("input", (e) => {
        layer.opacity = parseInt(e.target.value, 10);
        opVal.textContent = `${layer.opacity}%`;
        const layerEl = document.getElementById(`stack-layer-${layer.id}`);
        if (layerEl && multiMode !== "curtain") {
          layerEl.style.opacity = (layer.opacity / 100).toString();
        }
      });

      const blendSelect = row.querySelector(".layer-blend-select");
      blendSelect.addEventListener("change", (e) => {
        layer.blend = e.target.value;
        const layerEl = document.getElementById(`stack-layer-${layer.id}`);
        if (layerEl && multiMode !== "curtain") {
          layerEl.style.mixBlendMode = layer.blend;
        }
      });

      const soloBtn = row.querySelector(".solo-btn");
      soloBtn.addEventListener("click", () => toggleSolo(layer.id));

      const eyeBtn = row.querySelector(".eye-btn");
      eyeBtn.addEventListener("click", () => {
        layer.visible = !layer.visible;
        renderMultiLayers();
      });

      layerRowsList.appendChild(row);
    });
  }

  // Render Synchronized Matrix Grid
  function renderMatrixUI() {
    if (!matrixContainer) return;
    matrixContainer.innerHTML = "";

    activeLayers.forEach((layer) => {
      const cell = document.createElement("div");
      cell.className = "matrix-cell";
      cell.innerHTML = `
        <div class="matrix-thumb-wrap">
          <img src="${layer.src}" alt="${layer.name}">
          <span class="matrix-badge">${layer.num}</span>
        </div>
        <div class="matrix-footer">
          <span class="layer-name-txt">${layer.name}</span>
          <button type="button" class="matrix-solo-btn" data-id="${layer.id}">
            <i class="fa-solid fa-bullseye"></i> Solo
          </button>
        </div>
      `;
      cell.querySelector(".matrix-thumb-wrap").appendChild(createPassOverlay(layer, true));

      cell.querySelector(".matrix-solo-btn").addEventListener("click", () => {
        setMultiMode("mixer");
        multiViewBtns.forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-multimode") === "mixer");
        });
        toggleSolo(layer.id);
      });

      matrixContainer.appendChild(cell);
    });
  }

  // Continuous Scrubber Strip
  function buildScrubberDOM() {
    if (!scrubSlider || !scrubTicksWrap) return;
    const count = activeLayers.length;
    scrubSlider.min = "1";
    scrubSlider.max = Math.max(1, count).toString();
    scrubSlider.step = "0.02";
    scrubSlider.value = "1";

    scrubTicksWrap.innerHTML = "";
    activeLayers.forEach((layer, idx) => {
      const tick = document.createElement("span");
      tick.className = `scrub-tick-item ${idx === 0 ? "active" : ""}`;
      tick.setAttribute("data-scrub", idx + 1);
      tick.textContent = `[${layer.num}] ${layer.name}`;
      tick.addEventListener("click", () => {
        scrubSlider.value = (idx + 1).toString();
        toggleSolo(layer.id);
      });
      scrubTicksWrap.appendChild(tick);
    });
  }

  function updateScrubTicks(num) {
    document.querySelectorAll(".scrub-tick-item").forEach((tick) => {
      const scrubVal = parseInt(tick.getAttribute("data-scrub"), 10);
      tick.classList.toggle("active", scrubVal === Math.round(num));
    });
  }

  if (scrubSlider) {
    scrubSlider.addEventListener("input", (e) => {
      if (multiMode === "curtain") {
        setMultiMode("mixer");
        multiViewBtns.forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-multimode") === "mixer");
        });
      }
      const val = parseFloat(e.target.value);
      applyScrubPosition(val);
    });
  }

  function applyScrubPosition(pos) {
    const count = activeLayers.length;
    if (count <= 1) return;

    const baseIndex = Math.floor(pos) - 1;
    const fraction = pos - Math.floor(pos);

    activeSoloIndex = null;
    activeLayers.forEach((layer, idx) => {
      const layerEl = document.getElementById(`stack-layer-${layer.id}`);
      if (!layerEl) return;
      layerEl.style.display = "block";
      layerEl.style.mixBlendMode = "normal";

      // The crossfade below already fades each overlay with its layer
      const overlay = layerEl.querySelector(".pass-overlay");
      if (overlay) overlay.classList.remove("covered");

      if (idx === baseIndex) {
        layerEl.style.opacity = (1 - fraction).toFixed(3);
      } else if (idx === baseIndex + 1 && baseIndex + 1 < count) {
        layerEl.style.opacity = fraction.toFixed(3);
      } else {
        layerEl.style.opacity = "0";
      }
    });

    const activeLayer = activeLayers[Math.min(count - 1, Math.round(pos) - 1)];
    if (activePillNum && activePillTitle && activeLayer) {
      activePillNum.textContent = activeLayer.num;
      activePillTitle.textContent = `${activeLayer.num}. ${activeLayer.name}`;
    }
    updateScrubTicks(pos);
  }

  // Auto-Cycle Turntable
  if (autoCycleBtn) {
    autoCycleBtn.addEventListener("click", () => {
      if (cycleInterval) {
        clearInterval(cycleInterval);
        cycleInterval = null;
        autoCycleBtn.innerHTML = '<i class="fa-solid fa-play"></i> Auto-Cycle Turntable';
        autoCycleBtn.classList.remove("active");
      } else {
        autoCycleBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Turntable';
        autoCycleBtn.classList.add("active");
        let currentCycleIdx = 0;
        cycleInterval = setInterval(() => {
          if (activeLayers.length === 0) return;
          currentCycleIdx = (currentCycleIdx + 1) % activeLayers.length;
          toggleSolo(activeLayers[currentCycleIdx].id);
        }, 1400);
      }
    });
  }

  // ==========================================================================
  // 7. Test Custom Renders Locally (A/B Pair) (Points 3, 7)
  // ==========================================================================
  const localImgBefore = document.getElementById("local-img-before");
  const localImgAfter = document.getElementById("local-img-after");
  const localBadgeBefore = document.getElementById("local-badge-before-txt");
  const localBadgeAfter = document.getElementById("local-badge-after-txt");
  const localLayerBefore = document.getElementById("local-layer-before");
  const localSliderBar = document.getElementById("local-slider-bar");
  const localSliderKnob = document.getElementById("local-slider-knob");
  const localRangeInput = document.getElementById("local-range-slider-input");
  const localDiffAlert = document.getElementById("local-diff-alert");
  const localBtnReset = document.getElementById("btn-reset-local-pair");
  const localInputFileBefore = document.getElementById("local-input-file-before");
  const localInputFileAfter = document.getElementById("local-input-file-after");
  const localLabelBefore = document.getElementById("local-file-before-label");
  const localLabelAfter = document.getElementById("local-file-after-label");
  const localBox = document.getElementById("local-comparison-box");

  let localSplitPct = 50;
  let localMode = "split"; // 'split', 'difference', 'opacity'
  let isDraggingLocal = false;

  function updateLocalPosition(pct) {
    localSplitPct = Math.max(0, Math.min(100, pct));
    if (localRangeInput) localRangeInput.value = localSplitPct.toString();

    if (localMode === "split") {
      if (localLayerBefore) localLayerBefore.style.clipPath = `polygon(0 0, ${localSplitPct}% 0, ${localSplitPct}% 100%, 0 100%)`;
      if (localLayerBefore) localLayerBefore.style.opacity = "1";
      if (localSliderBar) localSliderBar.style.left = `${localSplitPct}%`;
      if (localSliderKnob) localSliderKnob.style.left = `${localSplitPct}%`;
    } else if (localMode === "opacity") {
      if (localLayerBefore) localLayerBefore.style.clipPath = "none";
      if (localLayerBefore) localLayerBefore.style.opacity = (localSplitPct / 100).toString();
      if (localSliderBar) localSliderBar.style.left = `${localSplitPct}%`;
      if (localSliderKnob) localSliderKnob.style.left = `${localSplitPct}%`;
    } else if (localMode === "difference") {
      if (localLayerBefore) localLayerBefore.style.clipPath = "none";
      if (localLayerBefore) localLayerBefore.style.opacity = "1";
    }
  }

  function setLocalMode(mode) {
    localMode = mode;
    document.querySelectorAll("[data-local-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-local-mode") === mode);
    });

    if (mode === "difference") {
      if (localLayerBefore) {
        localLayerBefore.style.mixBlendMode = "difference";
        localLayerBefore.style.clipPath = "none";
        localLayerBefore.style.opacity = "1";
      }
      if (localSliderBar) localSliderBar.style.display = "none";
      if (localSliderKnob) localSliderKnob.style.display = "none";
      if (localDiffAlert) localDiffAlert.style.display = "flex";
    } else {
      if (localLayerBefore) localLayerBefore.style.mixBlendMode = "normal";
      if (localSliderBar) localSliderBar.style.display = "block";
      if (localSliderKnob) localSliderKnob.style.display = "flex";
      if (localDiffAlert) localDiffAlert.style.display = "none";
      updateLocalPosition(localSplitPct);
    }
  }

  document.querySelectorAll("[data-local-mode]").forEach((btn) => {
    btn.addEventListener("click", () => setLocalMode(btn.getAttribute("data-local-mode")));
  });

  document.querySelectorAll(".quick-pct-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pct = parseFloat(btn.getAttribute("data-pct"));
      updateLocalPosition(pct);
    });
  });

  if (localRangeInput) {
    localRangeInput.addEventListener("input", (e) => {
      updateLocalPosition(parseFloat(e.target.value));
    });
  }

  // Pointer drag for comparison box
  if (localBox) {
    localBox.addEventListener("pointerdown", (e) => {
      isDraggingLocal = true;
      localBox.setPointerCapture(e.pointerId);
      const rect = localBox.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      updateLocalPosition(pct);
    });

    localBox.addEventListener("pointermove", (e) => {
      if (!isDraggingLocal) return;
      const rect = localBox.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      updateLocalPosition(pct);
    });

    const stopLocalDrag = (e) => {
      if (isDraggingLocal) {
        isDraggingLocal = false;
        try {
          localBox.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    };

    localBox.addEventListener("pointerup", stopLocalDrag);
    localBox.addEventListener("pointercancel", stopLocalDrag);
  }

  // Local File Input Handlers (Point 3: Standard click-to-browse, no drag & drop)
  if (localInputFileBefore) {
    localInputFileBefore.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        if (localImgBefore) localImgBefore.src = url;
        if (localBadgeBefore) localBadgeBefore.textContent = file.name;
        if (localLabelBefore) localLabelBefore.textContent = file.name;
      }
    });
  }

  if (localInputFileAfter) {
    localInputFileAfter.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        if (localImgAfter) localImgAfter.src = url;
        if (localBadgeAfter) localBadgeAfter.textContent = file.name;
        if (localLabelAfter) localLabelAfter.textContent = file.name;
      }
    });
  }

  function updateLocalTesterDefaults() {
    if (folderLayers.length >= 2) {
      const first = folderLayers[0];
      const last = folderLayers[folderLayers.length - 1];
      if (localImgBefore) localImgBefore.src = first.src;
      if (localImgAfter) localImgAfter.src = last.src;
      if (localBadgeBefore) localBadgeBefore.textContent = `${first.num}. ${first.name}`;
      if (localBadgeAfter) localBadgeAfter.textContent = `${last.num}. ${last.name}`;
      if (localLabelBefore) localLabelBefore.textContent = `Default: ${first.filename}`;
      if (localLabelAfter) localLabelAfter.textContent = `Default: ${last.filename}`;
    }
    updateLocalPosition(50);
  }

  if (localBtnReset) {
    localBtnReset.addEventListener("click", () => updateLocalTesterDefaults());
  }

  // ==========================================================================
  // 8. Keyboard Shortcuts
  // ==========================================================================
  window.addEventListener("keydown", (e) => {
    // Typing a description or a pass name must not trigger shortcuts
    if (e.target.closest && e.target.closest('textarea, input[type="text"]')) return;

    // Digits 1-9 solo active layers
    if (e.key >= "1" && e.key <= "9") {
      const num = parseInt(e.key, 10);
      if (num <= activeLayers.length) {
        toggleSolo(activeLayers[num - 1].id);
      }
    }
    // Arrow Left / Right for Viewport Slides
    if (e.altKey && e.key === "ArrowLeft") {
      switchFolder(currentFolderIndex - 1);
    } else if (e.altKey && e.key === "ArrowRight") {
      switchFolder(currentFolderIndex + 1);
    }
  });

  // ==========================================================================
  // 9. Initial Boot: Attempt Manifest Fetch with Built-in Fallback
  // ==========================================================================
  fetch("../images/oslviewer/manifest.json")
    .then((res) => {
      if (!res.ok) throw new Error("Manifest fetch returned non-200");
      return res.json();
    })
    .then((data) => {
      if (data && data.folders && data.folders.length > 0) {
        foldersList = data.folders;
      }
      applyDrafts();
      switchFolder(0);
    })
    .catch(() => {
      // Offline / file:// protocol fallback
      foldersList = DEFAULT_MANIFEST.folders;
      applyDrafts();
      switchFolder(0);
    });
});
