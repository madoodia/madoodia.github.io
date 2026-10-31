/**
 * OSL Shader Studio & Multi-Style Interactive Viewer Controller
 * madoodia.com - Reza Aarabi
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // 1. Two-Image A/B Comparator Controller
  // ==========================================================================
  const stage = document.getElementById("comparator-stage");
  const compBox = document.getElementById("comparison-box");
  const rangeInput = document.getElementById("range-slider-input");
  const imgBefore = document.getElementById("img-before");
  const imgAfter = document.getElementById("img-after");
  const posDisplay = document.getElementById("slider-pct-display");
  const flashBtn = document.getElementById("flash-compare-btn");
  const fullscreenBtn = document.getElementById("btn-fullscreen");
  
  const defaultBefore = "../images/oslviewer/Render_01_before.png";
  const defaultAfter = "../images/oslviewer/Render_01_after.png";

  let currentPosition = 50;
  let currentMode = "split";
  let isDragging = false;
  let isFlashing = false;

  function updatePosition(pct) {
    pct = Math.max(0, Math.min(100, pct));
    currentPosition = pct;
    stage.style.setProperty("--pos", `${pct}%`);
    stage.style.setProperty("--opacity-val", `${pct}`);
    
    if (rangeInput && rangeInput.value != pct) {
      rangeInput.value = pct;
    }
    if (posDisplay) {
      posDisplay.textContent = `${Math.round(pct)}%`;
    }
  }

  if (rangeInput) {
    rangeInput.addEventListener("input", (e) => {
      updatePosition(parseFloat(e.target.value));
    });
  }

  function getPosFromEvent(e) {
    const rect = compBox.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    return (x / rect.width) * 100;
  }

  if (compBox) {
    compBox.addEventListener("pointerdown", (e) => {
      if (currentMode === "side-by-side") return;
      isDragging = true;
      compBox.setPointerCapture(e.pointerId);
      updatePosition(getPosFromEvent(e));
    });

    compBox.addEventListener("pointermove", (e) => {
      if (!isDragging || currentMode === "side-by-side") return;
      updatePosition(getPosFromEvent(e));
    });

    const stopDragging = (e) => {
      if (isDragging) {
        isDragging = false;
        try {
          compBox.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    };

    compBox.addEventListener("pointerup", stopDragging);
    compBox.addEventListener("pointercancel", stopDragging);
  }

  // Quick Percentage Jump Buttons
  document.querySelectorAll(".quick-pct-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      updatePosition(parseFloat(btn.getAttribute("data-pct")));
    });
  });

  // Mode Selection
  const modeButtons = document.querySelectorAll(".mode-btn");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.getAttribute("data-mode");
      setMode(mode);
    });
  });

  function setMode(mode) {
    currentMode = mode;
    stage.classList.remove("mode-difference", "mode-opacity", "mode-side-by-side");
    if (mode === "difference") {
      stage.classList.add("mode-difference");
    } else if (mode === "opacity") {
      stage.classList.add("mode-opacity");
    } else if (mode === "side-by-side") {
      stage.classList.add("mode-side-by-side");
    }
  }

  // Flash A/B Toggle
  function flashStart() {
    isFlashing = true;
    if (flashBtn) flashBtn.classList.add("active");
    stage.style.setProperty("--pos", "100%");
  }

  function flashEnd() {
    isFlashing = false;
    if (flashBtn) flashBtn.classList.remove("active");
    stage.style.setProperty("--pos", `${currentPosition}%`);
  }

  if (flashBtn) {
    flashBtn.addEventListener("mousedown", flashStart);
    flashBtn.addEventListener("mouseup", flashEnd);
    flashBtn.addEventListener("mouseleave", () => {
      if (isFlashing) flashEnd();
    });
    flashBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      flashStart();
    });
    flashBtn.addEventListener("touchend", flashEnd);
  }

  // Fullscreen Mode Toggle
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        stage.requestFullscreen().catch((err) => console.warn(err));
      } else {
        document.exitFullscreen();
      }
    });

    document.addEventListener("fullscreenchange", () => {
      const icon = fullscreenBtn.querySelector("i");
      if (document.fullscreenElement) {
        icon.className = "fa-solid fa-compress";
      } else {
        icon.className = "fa-solid fa-expand";
      }
    });
  }

  // Custom 2-Image Upload Handling
  const dropZoneBefore = document.getElementById("drop-zone-before");
  const dropZoneAfter = document.getElementById("drop-zone-after");
  const inputBefore = document.getElementById("input-file-before");
  const inputAfter = document.getElementById("input-file-after");
  const btnResetPair = document.getElementById("btn-reset-pair");

  function handleFileSelect(file, targetImg, labelElem) {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please upload a valid image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    targetImg.src = url;
    if (labelElem) labelElem.textContent = file.name;
  }

  if (dropZoneBefore && inputBefore) {
    dropZoneBefore.addEventListener("click", () => inputBefore.click());
    inputBefore.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0], imgBefore, dropZoneBefore.querySelector(".zone-label"));
      }
    });
    ["dragenter", "dragover"].forEach((evt) => {
      dropZoneBefore.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZoneBefore.classList.add("drag-over");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      dropZoneBefore.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZoneBefore.classList.remove("drag-over");
      });
    });
    dropZoneBefore.addEventListener("drop", (e) => {
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0], imgBefore, dropZoneBefore.querySelector(".zone-label"));
      }
    });
  }

  if (dropZoneAfter && inputAfter) {
    dropZoneAfter.addEventListener("click", () => inputAfter.click());
    inputAfter.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0], imgAfter, dropZoneAfter.querySelector(".zone-label"));
      }
    });
    ["dragenter", "dragover"].forEach((evt) => {
      dropZoneAfter.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZoneAfter.classList.add("drag-over");
      });
    });
    ["dragleave", "drop"].forEach((evt) => {
      dropZoneAfter.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZoneAfter.classList.remove("drag-over");
      });
    });
    dropZoneAfter.addEventListener("drop", (e) => {
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0], imgAfter, dropZoneAfter.querySelector(".zone-label"));
      }
    });
  }

  if (btnResetPair) {
    btnResetPair.addEventListener("click", () => {
      imgBefore.src = defaultBefore;
      imgAfter.src = defaultAfter;
      if (dropZoneBefore) dropZoneBefore.querySelector(".zone-label").textContent = "Render_01_before.png";
      if (dropZoneAfter) dropZoneAfter.querySelector(".zone-label").textContent = "Render_01_after.png";
      updatePosition(50);
    });
  }

  // ==========================================================================
  // 2. Multi-Style Layer Stack (4–6 Images Comparison Suite)
  // ==========================================================================
  const multiStageCard = document.getElementById("multi-stage-card");
  const multiCanvas = document.getElementById("multi-canvas");
  const curtainDividers = document.getElementById("multi-curtain-dividers");
  const matrixContainer = document.getElementById("matrix-grid-container");
  const layerRowsList = document.getElementById("layer-rows-list");
  const scrubSlider = document.getElementById("scrub-range-slider");
  const activePillNum = document.getElementById("active-layer-num");
  const activePillTitle = document.getElementById("active-layer-title");
  const autoCycleBtn = document.getElementById("btn-auto-cycle");
  const bulkFileInput = document.getElementById("bulk-file-input");
  const bulkUploaderCard = document.getElementById("bulk-uploader-card");
  const btnResetMulti = document.getElementById("btn-reset-multi-defaults");

  // Initial 6 Style Layers Model
  const multiLayers = [
    {
      id: 1,
      name: "Beauty Pass (OSL Shader)",
      tag: "Final OSL",
      opacity: 100,
      blend: "normal",
      visible: true,
      src: defaultAfter,
      filter: "none"
    },
    {
      id: 2,
      name: "Baseline Reference",
      tag: "Ground Truth",
      opacity: 0,
      blend: "normal",
      visible: true,
      src: defaultBefore,
      filter: "none"
    },
    {
      id: 3,
      name: "Difference Heatmap",
      tag: "Pixel Diff",
      opacity: 0,
      blend: "difference",
      visible: true,
      src: defaultBefore,
      filter: "contrast(180%) brightness(140%)"
    },
    {
      id: 4,
      name: "Specular / Roughness",
      tag: "Specular AOV",
      opacity: 0,
      blend: "normal",
      visible: true,
      src: defaultAfter,
      filter: "contrast(220%) brightness(120%) grayscale(60%)"
    },
    {
      id: 5,
      name: "Clay / Surface Form",
      tag: "Clay Occlusion",
      opacity: 0,
      blend: "normal",
      visible: true,
      src: defaultAfter,
      filter: "grayscale(100%) contrast(110%) brightness(95%)"
    },
    {
      id: 6,
      name: "Silhouette / Edge Contour",
      tag: "Normal & Silhouette",
      opacity: 0,
      blend: "normal",
      visible: true,
      src: defaultAfter,
      filter: "invert(85%) hue-rotate(180deg) contrast(140%)"
    }
  ];

  let multiMode = "mixer"; // 'mixer', 'curtain', 'matrix'
  let activeSoloIndex = null;
  let cycleInterval = null;

  // Apply Layer State to DOM
  function renderMultiLayers() {
    multiLayers.forEach((layer) => {
      const layerEl = document.getElementById(`stack-layer-${layer.id}`);
      if (!layerEl) return;

      const img = layerEl.querySelector("img");
      if (img && img.src !== layer.src) {
        img.src = layer.src;
      }

      // Check Solo state
      if (activeSoloIndex !== null) {
        if (layer.id === activeSoloIndex) {
          layerEl.style.opacity = "1";
          layerEl.style.display = "block";
          layerEl.style.mixBlendMode = "normal";
          layerEl.style.filter = layer.filter;
        } else {
          layerEl.style.opacity = "0";
          layerEl.style.display = "none";
        }
      } else {
        layerEl.style.display = layer.visible ? "block" : "none";
        layerEl.style.opacity = (layer.opacity / 100).toString();
        layerEl.style.mixBlendMode = layer.blend;
        layerEl.style.filter = layer.filter;
      }
    });

    renderLayerDeckUI();
    renderMatrixUI();
  }

  // Render Layer Deck Controls
  function renderLayerDeckUI() {
    if (!layerRowsList) return;
    layerRowsList.innerHTML = "";

    multiLayers.forEach((layer) => {
      const isSolo = activeSoloIndex === layer.id;
      const row = document.createElement("div");
      row.className = `layer-row-card ${isSolo ? "soloed" : ""} ${!layer.visible ? "hidden-layer" : ""}`;

      row.innerHTML = `
        <div class="layer-num-badge" title="Shortcut Key: ${layer.id}">${layer.id}</div>
        <div class="layer-thumb-mini">
          <img src="${layer.src}" alt="${layer.name}">
        </div>
        <div class="layer-title-box">
          <input type="text" class="layer-name-input" value="${layer.name}" data-id="${layer.id}" title="Click to rename style">
          <span class="layer-sub-txt">${layer.tag}</span>
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
          <button type="button" class="layer-icon-btn solo-btn ${isSolo ? "active" : ""}" data-id="${layer.id}" title="Solo style ${layer.id}">
            <i class="fa-solid fa-bullseye"></i>
          </button>
          <button type="button" class="layer-icon-btn eye-btn ${layer.visible ? "active" : ""}" data-id="${layer.id}" title="Toggle visibility">
            <i class="fa-regular ${layer.visible ? "fa-eye" : "fa-eye-slash"}"></i>
          </button>
          <label class="layer-icon-btn layer-file-btn" title="Replace image for style ${layer.id}">
            <i class="fa-solid fa-folder-open"></i>
            <input type="file" accept="image/*" class="replace-layer-input" data-id="${layer.id}">
          </label>
        </div>
      `;

      // Event Listeners for Row
      const nameInput = row.querySelector(".layer-name-input");
      nameInput.addEventListener("change", (e) => {
        layer.name = e.target.value;
        if (activeSoloIndex === layer.id) {
          activePillTitle.textContent = layer.name;
        }
        renderMatrixUI();
      });

      const opSlider = row.querySelector(".layer-opacity-slider");
      const opVal = row.querySelector(".layer-opacity-val");
      opSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        layer.opacity = val;
        opVal.textContent = `${val}%`;
        const layerEl = document.getElementById(`stack-layer-${layer.id}`);
        if (layerEl && activeSoloIndex === null) {
          layerEl.style.opacity = (val / 100).toString();
        }
      });

      const blendSel = row.querySelector(".layer-blend-select");
      blendSel.addEventListener("change", (e) => {
        layer.blend = e.target.value;
        const layerEl = document.getElementById(`stack-layer-${layer.id}`);
        if (layerEl) layerEl.style.mixBlendMode = layer.blend;
      });

      const soloBtn = row.querySelector(".solo-btn");
      soloBtn.addEventListener("click", () => {
        toggleSolo(layer.id);
      });

      const eyeBtn = row.querySelector(".eye-btn");
      eyeBtn.addEventListener("click", () => {
        layer.visible = !layer.visible;
        renderMultiLayers();
      });

      const fileInput = row.querySelector(".replace-layer-input");
      fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          layer.src = URL.createObjectURL(file);
          layer.name = file.name.replace(/\.[^/.]+$/, "");
          renderMultiLayers();
        }
      });

      layerRowsList.appendChild(row);
    });
  }

  // Render Synchronized Matrix (3x2 Grid)
  function renderMatrixUI() {
    if (!matrixContainer) return;
    matrixContainer.innerHTML = "";

    multiLayers.forEach((layer) => {
      const cell = document.createElement("div");
      cell.className = "matrix-cell";
      cell.innerHTML = `
        <div class="matrix-thumb-wrap">
          <img src="${layer.src}" alt="${layer.name}" style="filter: ${layer.filter}">
          <span class="matrix-badge">Style ${layer.id}</span>
        </div>
        <div class="matrix-footer">
          <span class="layer-name-txt">${layer.name}</span>
          <button type="button" class="matrix-solo-btn" data-id="${layer.id}">
            <i class="fa-solid fa-bullseye"></i> Solo
          </button>
        </div>
      `;

      cell.querySelector(".matrix-solo-btn").addEventListener("click", () => {
        setMultiMode("mixer");
        toggleSolo(layer.id);
      });

      matrixContainer.appendChild(cell);
    });
  }

  // Toggle Solo for a Style
  function toggleSolo(layerId) {
    if (activeSoloIndex === layerId) {
      activeSoloIndex = null;
      activePillNum.textContent = "Mix";
      activePillTitle.textContent = "Custom Composite Stack";
    } else {
      activeSoloIndex = layerId;
      activePillNum.textContent = layerId;
      const target = multiLayers.find((l) => l.id === layerId);
      activePillTitle.textContent = target ? target.name : `Style ${layerId}`;
      if (scrubSlider) scrubSlider.value = layerId;
      updateScrubTicks(layerId);
    }
    renderMultiLayers();
  }

  // Multi-View Mode Switcher (Mixer, Curtain, Matrix)
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
    
    if (curtainDividers) curtainDividers.style.display = "none";
    
    // Clear clipping
    multiLayers.forEach((l) => {
      const layerEl = document.getElementById(`stack-layer-${l.id}`);
      if (layerEl) layerEl.style.clipPath = "none";
    });

    if (mode === "curtain") {
      multiStageCard.classList.add("view-curtain");
      setupMultiCurtain();
    } else if (mode === "matrix") {
      multiStageCard.classList.add("view-matrix");
    } else {
      renderMultiLayers();
    }
  }

  // Setup Multi-Curtain Mode (Dividing screen into 6 vertical zones)
  function setupMultiCurtain() {
    if (!curtainDividers) return;
    curtainDividers.style.display = "block";
    curtainDividers.innerHTML = "";

    const count = multiLayers.length;
    const sliceWidth = 100 / count;

    multiLayers.forEach((layer, idx) => {
      const layerEl = document.getElementById(`stack-layer-${layer.id}`);
      if (!layerEl) return;

      const left = idx * sliceWidth;
      const right = (idx + 1) * sliceWidth;

      // Set polygon clip for this vertical slice
      layerEl.style.clipPath = `polygon(${left}% 0, ${right}% 0, ${right}% 100%, ${left}% 100%)`;
      layerEl.style.opacity = "1";
      layerEl.style.display = "block";
      layerEl.style.mixBlendMode = "normal";

      // Divider lines
      if (idx > 0) {
        const divLine = document.createElement("div");
        divLine.className = "curtain-divider-line";
        divLine.style.left = `${left}%`;
        divLine.innerHTML = `<span class="curtain-divider-tag">Style ${idx} | ${idx + 1}</span>`;
        curtainDividers.appendChild(divLine);
      }
    });
  }

  // Continuous Scrubber
  function updateScrubTicks(num) {
    document.querySelectorAll(".scrub-tick-item").forEach((tick) => {
      const scrubVal = parseInt(tick.getAttribute("data-scrub"), 10);
      tick.classList.toggle("active", scrubVal === Math.round(num));
    });
  }

  if (scrubSlider) {
    scrubSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      applyScrubPosition(val);
    });
  }

  function applyScrubPosition(val) {
    updateScrubTicks(val);
    const count = multiLayers.length;
    const baseIdx = Math.floor(val);
    const progress = val - baseIdx;

    activeSoloIndex = null;
    activePillNum.textContent = Math.round(val);
    const target = multiLayers[Math.min(count - 1, Math.max(0, Math.round(val) - 1))];
    activePillTitle.textContent = target ? target.name : `Scrubbing ${val.toFixed(1)}`;

    multiLayers.forEach((layer) => {
      const layerEl = document.getElementById(`stack-layer-${layer.id}`);
      if (!layerEl) return;

      let op = 0;
      if (layer.id === baseIdx) {
        op = 1 - progress;
      } else if (layer.id === baseIdx + 1) {
        op = progress;
      } else if (val >= count && layer.id === count) {
        op = 1;
      }

      layerEl.style.opacity = op.toFixed(3);
      layerEl.style.display = op > 0.01 ? "block" : "none";
      layerEl.style.mixBlendMode = layer.blend;
    });
  }

  // Click on tick mark to jump
  document.querySelectorAll(".scrub-tick-item").forEach((tick) => {
    tick.addEventListener("click", () => {
      const num = parseInt(tick.getAttribute("data-scrub"), 10);
      if (scrubSlider) scrubSlider.value = num;
      toggleSolo(num);
    });
  });

  // Auto-Cycle Turntable
  if (autoCycleBtn) {
    autoCycleBtn.addEventListener("click", () => {
      if (cycleInterval) {
        clearInterval(cycleInterval);
        cycleInterval = null;
        autoCycleBtn.classList.remove("playing");
        autoCycleBtn.innerHTML = '<i class="fa-solid fa-play"></i> Auto-Cycle Turntable';
      } else {
        autoCycleBtn.classList.add("playing");
        autoCycleBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Cycle';
        let currentCycle = activeSoloIndex || 1;

        cycleInterval = setInterval(() => {
          currentCycle = (currentCycle % multiLayers.length) + 1;
          toggleSolo(currentCycle);
        }, 1200);
      }
    });
  }

  // Keyboard Shortcuts (Space for A/B flip, 1-6 for Solo Styles)
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      updatePosition(currentPosition - 5);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      updatePosition(currentPosition + 5);
    } else if (e.code === "Space" && !isFlashing) {
      e.preventDefault();
      flashStart();
    } else if (["1", "2", "3", "4", "5", "6"].includes(e.key)) {
      const num = parseInt(e.key, 10);
      toggleSolo(num);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && isFlashing) {
      e.preventDefault();
      flashEnd();
    }
  });

  // Bulk Multi-Image Uploader (4 to 6 Images)
  if (bulkUploaderCard && bulkFileInput) {
    bulkUploaderCard.addEventListener("click", (e) => {
      if (e.target !== btnResetMulti && !btnResetMulti.contains(e.target)) {
        bulkFileInput.click();
      }
    });

    bulkFileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        loadBulkFiles(Array.from(e.target.files));
      }
    });

    ["dragenter", "dragover"].forEach((evt) => {
      bulkUploaderCard.addEventListener(evt, (e) => {
        e.preventDefault();
        bulkUploaderCard.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((evt) => {
      bulkUploaderCard.addEventListener(evt, (e) => {
        e.preventDefault();
        bulkUploaderCard.classList.remove("drag-over");
      });
    });

    bulkUploaderCard.addEventListener("drop", (e) => {
      if (e.dataTransfer.files.length > 0) {
        loadBulkFiles(Array.from(e.dataTransfer.files));
      }
    });
  }

  function loadBulkFiles(files) {
    const imgFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imgFiles.length === 0) {
      alert("Please upload valid image files (PNG, JPG, WebP).");
      return;
    }

    imgFiles.slice(0, 6).forEach((file, idx) => {
      if (multiLayers[idx]) {
        multiLayers[idx].src = URL.createObjectURL(file);
        multiLayers[idx].name = file.name.replace(/\.[^/.]+$/, "");
        multiLayers[idx].tag = `Uploaded (${file.name})`;
        multiLayers[idx].filter = "none";
      }
    });

    // Reset view to mixer and solo Layer 1
    setMultiMode("mixer");
    toggleSolo(1);
    alert(`Successfully loaded ${Math.min(imgFiles.length, 6)} styles into the layer stack!`);
  }

  // Reset to default 6 passes
  if (btnResetMulti) {
    btnResetMulti.addEventListener("click", (e) => {
      e.stopPropagation();
      multiLayers[0].src = defaultAfter;
      multiLayers[0].name = "Beauty Pass (OSL Shader)";
      multiLayers[1].src = defaultBefore;
      multiLayers[1].name = "Baseline Reference";
      multiLayers[2].src = defaultBefore;
      multiLayers[2].name = "Difference Heatmap";
      multiLayers[3].src = defaultAfter;
      multiLayers[3].name = "Specular / Roughness";
      multiLayers[4].src = defaultAfter;
      multiLayers[4].name = "Clay / Surface Form";
      multiLayers[5].src = defaultAfter;
      multiLayers[5].name = "Silhouette / Edge Contour";
      toggleSolo(1);
    });
  }

  // ==========================================================================
  // 3. Gallery Lightbox and Load Actions
  // ==========================================================================
  const lightbox = document.getElementById("lightbox-modal");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxClose = document.getElementById("lightbox-close-btn");

  document.querySelectorAll(".btn-load-compare").forEach((btn) => {
    btn.addEventListener("click", () => {
      const beforeSrc = btn.getAttribute("data-before");
      const afterSrc = btn.getAttribute("data-after");
      if (beforeSrc) imgBefore.src = beforeSrc;
      if (afterSrc) imgAfter.src = afterSrc;
      document.getElementById("comparator").scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll(".btn-open-lightbox").forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.getAttribute("data-full");
      const title = btn.getAttribute("data-title") || "Render Preview";
      if (lightbox && lightboxImg) {
        lightboxImg.src = src;
        if (lightboxCaption) lightboxCaption.textContent = title;
        lightbox.classList.add("active");
      }
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener("click", () => {
      lightbox.classList.remove("active");
    });
  }

  if (lightbox) {
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) {
        lightbox.classList.remove("active");
      }
    });
  }

  // Initialize
  updatePosition(50);
  renderMultiLayers();
  toggleSolo(1);
});
