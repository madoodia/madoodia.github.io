/**
 * OSL Shader Studio & Multi-Style Interactive Viewer Controller
 * Multiple Ordered Samples Support
 * madoodia.com - Reza Aarabi
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // Sample Data Model: Organizes Renders in Logical & Pipeline Order
  // ==========================================================================
  const SAMPLES = {
    optix: {
      id: "optix",
      title: "Sample 1: OptiX Ray-Tracing Passes",
      subtitle: "High-resolution 1920x1080 pipeline: Raw Shading → Depth Buffer → DOF Debug → Post-Processed",
      layers: [
        { id: 1, name: "Render07: OptiX Raw Ray-Traced Shading", tag: "Pass 1: Raw Render", src: "../images/oslviewer/Render07.png" },
        { id: 2, name: "Render04: Z-Depth Buffer Pass", tag: "Pass 2: Depth Pass", src: "../images/oslviewer/Render04.png" },
        { id: 3, name: "Render05: Depth of Field Debug", tag: "Pass 3: DOF Debug", src: "../images/oslviewer/Render05.png" },
        { id: 4, name: "Render08: OptiX Post-Processed Render", tag: "Pass 4: Post Final", src: "../images/oslviewer/Render08.png" }
      ],
      comparatorPair: {
        before: "../images/oslviewer/Render07.png",
        after: "../images/oslviewer/Render08.png",
        beforeTitle: "Render07: Raw Shading",
        afterTitle: "Render08: Post Render"
      }
    },
    flat: {
      id: "flat",
      title: "Sample 2: Viewport Flat Shading",
      subtitle: "Geometry & viewport shading inspection: Angle A → Flat Base → Flat Post",
      layers: [
        { id: 1, name: "Render01: Flat Shaded (Angle A)", tag: "Pass 1: Flat Angle A", src: "../images/oslviewer/Render01.png" },
        { id: 2, name: "Render02: Flat Shaded Base (Angle B)", tag: "Pass 2: Flat Base B", src: "../images/oslviewer/Render02.png" },
        { id: 3, name: "Render03: Flat Post-Processed (Angle B)", tag: "Pass 3: Flat Post B", src: "../images/oslviewer/Render03.png" }
      ],
      comparatorPair: {
        before: "../images/oslviewer/Render02.png",
        after: "../images/oslviewer/Render03.png",
        beforeTitle: "Render02: Flat Base",
        afterTitle: "Render03: Flat Post"
      }
    },
    osl: {
      id: "osl",
      title: "Sample 3: OSL Shader Benchmark",
      subtitle: "Differential shading evaluation: Baseline Reference vs Custom OSL Shader",
      layers: [
        { id: 1, name: "Render06: Baseline Ground Truth", tag: "Pass 1: Baseline Reference", src: "../images/oslviewer/Render06.png" },
        { id: 2, name: "Render After: OSL Beauty Shading", tag: "Pass 2: OSL Beauty", src: "../images/oslviewer/Render_01_after.png" }
      ],
      comparatorPair: {
        before: "../images/oslviewer/Render06.png",
        after: "../images/oslviewer/Render_01_after.png",
        beforeTitle: "Render06: Baseline",
        afterTitle: "OSL Beauty Render"
      }
    },
    all: {
      id: "all",
      title: "Sample 4: Complete Sequence (Render 01–08)",
      subtitle: "All 8 project renders arranged in numerical order",
      layers: [
        { id: 1, name: "Render01: Flat Angle A", tag: "Pass 1", src: "../images/oslviewer/Render01.png" },
        { id: 2, name: "Render02: Flat Base B", tag: "Pass 2", src: "../images/oslviewer/Render02.png" },
        { id: 3, name: "Render03: Flat Post B", tag: "Pass 3", src: "../images/oslviewer/Render03.png" },
        { id: 4, name: "Render04: Depth Buffer", tag: "Pass 4", src: "../images/oslviewer/Render04.png" },
        { id: 5, name: "Render05: DOF Debug Pass", tag: "Pass 5", src: "../images/oslviewer/Render05.png" },
        { id: 6, name: "Render06: Baseline Reference", tag: "Pass 6", src: "../images/oslviewer/Render06.png" },
        { id: 7, name: "Render07: Raw Shading", tag: "Pass 7", src: "../images/oslviewer/Render07.png" },
        { id: 8, name: "Render08: Post Final", tag: "Pass 8", src: "../images/oslviewer/Render08.png" }
      ],
      comparatorPair: {
        before: "../images/oslviewer/Render07.png",
        after: "../images/oslviewer/Render08.png",
        beforeTitle: "Render07: Raw",
        afterTitle: "Render08: Post"
      }
    }
  };

  let currentSampleKey = "optix";
  let activeSample = SAMPLES[currentSampleKey];

  // Working state for active sample layers
  let activeLayers = [];

  function loadSample(sampleKey) {
    if (!SAMPLES[sampleKey]) return;
    currentSampleKey = sampleKey;
    activeSample = SAMPLES[sampleKey];

    // Clone layers with default state
    activeLayers = activeSample.layers.map((l, index) => ({
      ...l,
      opacity: index === 0 ? 100 : 0,
      blend: "normal",
      visible: true
    }));

    activeSoloIndex = 1;

    // Update Sample Selector Buttons
    document.querySelectorAll(".sample-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-sample") === sampleKey);
    });

    // Update A/B Comparator with this sample's hero pair
    if (activeSample.comparatorPair) {
      if (imgBefore) imgBefore.src = activeSample.comparatorPair.before;
      if (imgAfter) imgAfter.src = activeSample.comparatorPair.after;
      if (badgeBeforeTxt) badgeBeforeTxt.textContent = activeSample.comparatorPair.beforeTitle;
      if (badgeAfterTxt) badgeAfterTxt.textContent = activeSample.comparatorPair.afterTitle;
      updatePosition(50);
    }

    // Rebuild DOM and UI
    buildMultiCanvasDOM();
    buildScrubberDOM();
    renderMultiLayers();
    toggleSolo(1);

    if (multiMode === "curtain") {
      setupMultiCurtain();
    }
  }

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
  const badgeBeforeTxt = document.getElementById("badge-before-txt");
  const badgeAfterTxt = document.getElementById("badge-after-txt");

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

  // Preset Pair Buttons for A/B Comparator
  document.querySelectorAll(".pair-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pair-preset-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const bSrc = btn.getAttribute("data-before");
      const aSrc = btn.getAttribute("data-after");
      const bTitle = btn.getAttribute("data-before-title") || "Before";
      const aTitle = btn.getAttribute("data-after-title") || "After";

      if (imgBefore && bSrc) imgBefore.src = bSrc;
      if (imgAfter && aSrc) imgAfter.src = aSrc;
      if (badgeBeforeTxt) badgeBeforeTxt.textContent = bTitle;
      if (badgeAfterTxt) badgeAfterTxt.textContent = aTitle;
      updatePosition(50);
    });
  });

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
      loadSample(currentSampleKey);
    });
  }

  // ==========================================================================
  // 2. Multi-Style Layer Stack (Ordered Samples Engine)
  // ==========================================================================
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
  const bulkFileInput = document.getElementById("bulk-file-input");
  const bulkUploaderCard = document.getElementById("bulk-uploader-card");
  const btnResetMulti = document.getElementById("btn-reset-multi-defaults");

  let multiMode = "mixer"; // 'mixer', 'curtain', 'matrix'
  let activeSoloIndex = 1;
  let cycleInterval = null;

  // Build Canvas Layers dynamically for the active sample
  function buildMultiCanvasDOM() {
    if (!multiCanvas) return;
    // Keep curtain dividers container intact
    multiCanvas.innerHTML = '<div id="multi-curtain-dividers" class="multi-curtain-dividers" style="display: none;"></div>';

    activeLayers.forEach((layer) => {
      const layerEl = document.createElement("div");
      layerEl.id = `stack-layer-${layer.id}`;
      layerEl.className = "stack-layer";
      layerEl.style.zIndex = layer.id;
      layerEl.style.opacity = layer.id === 1 ? "1" : "0";
      layerEl.innerHTML = `<img src="${layer.src}" alt="${layer.name}" />`;
      multiCanvas.appendChild(layerEl);
    });
  }

  // Build Continuous Scrubber DOM for active sample length
  function buildScrubberDOM() {
    if (!scrubSlider || !scrubTicksWrap) return;
    const count = activeLayers.length;
    scrubSlider.min = "1";
    scrubSlider.max = count.toString();
    scrubSlider.step = "0.02";
    scrubSlider.value = "1";

    scrubTicksWrap.innerHTML = "";
    activeLayers.forEach((layer) => {
      const tick = document.createElement("span");
      tick.className = `scrub-tick-item ${layer.id === 1 ? "active" : ""}`;
      tick.setAttribute("data-scrub", layer.id);
      tick.textContent = `[${layer.id}] ${layer.tag}`;
      tick.addEventListener("click", () => {
        scrubSlider.value = layer.id;
        toggleSolo(layer.id);
      });
      scrubTicksWrap.appendChild(tick);
    });
  }

  // Apply Layer State to DOM
  function renderMultiLayers() {
    activeLayers.forEach((layer) => {
      const layerEl = document.getElementById(`stack-layer-${layer.id}`);
      if (!layerEl) return;

      const img = layerEl.querySelector("img");
      if (img && img.src !== layer.src) {
        img.src = layer.src;
      }

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

  // Render Layer Deck Controls
  function renderLayerDeckUI() {
    if (!layerRowsList) return;
    layerRowsList.innerHTML = "";

    activeLayers.forEach((layer) => {
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

      // Event Listeners
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

  // Render Synchronized Matrix View
  function renderMatrixUI() {
    if (!matrixContainer) return;
    matrixContainer.innerHTML = "";

    activeLayers.forEach((layer) => {
      const cell = document.createElement("div");
      cell.className = "matrix-cell";
      cell.innerHTML = `
        <div class="matrix-thumb-wrap">
          <img src="${layer.src}" alt="${layer.name}">
          <span class="matrix-badge">${layer.tag}</span>
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
    if (activeSoloIndex === layerId && activeLayers.length > 1) {
      activeSoloIndex = null;
      activePillNum.textContent = "Mix";
      activePillTitle.textContent = "Custom Composite Stack";
    } else {
      activeSoloIndex = layerId;
      activePillNum.textContent = layerId;
      const target = activeLayers.find((l) => l.id === layerId);
      activePillTitle.textContent = target ? target.name : `Pass ${layerId}`;
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
    
    const dividers = document.getElementById("multi-curtain-dividers");
    if (dividers) dividers.style.display = "none";
    
    activeLayers.forEach((l) => {
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

  // Setup Multi-Curtain Mode (Splitting screen into N vertical zones in exact order)
  function setupMultiCurtain() {
    const dividers = document.getElementById("multi-curtain-dividers");
    if (!dividers) return;
    dividers.style.display = "block";
    dividers.innerHTML = "";

    const count = activeLayers.length;
    const sliceWidth = 100 / count;

    activeLayers.forEach((layer, idx) => {
      const layerEl = document.getElementById(`stack-layer-${layer.id}`);
      if (!layerEl) return;

      const left = idx * sliceWidth;
      const right = (idx + 1) * sliceWidth;

      layerEl.style.clipPath = `polygon(${left}% 0, ${right}% 0, ${right}% 100%, ${left}% 100%)`;
      layerEl.style.opacity = "1";
      layerEl.style.display = "block";
      layerEl.style.mixBlendMode = "normal";

      if (idx > 0) {
        const divLine = document.createElement("div");
        divLine.className = "curtain-divider-line";
        divLine.style.left = `${left}%`;
        divLine.innerHTML = `<span class="curtain-divider-tag">[${idx}] | [${idx + 1}]</span>`;
        dividers.appendChild(divLine);
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
    const count = activeLayers.length;
    const baseIdx = Math.floor(val);
    const progress = val - baseIdx;

    activeSoloIndex = null;
    activePillNum.textContent = Math.round(val);
    const target = activeLayers[Math.min(count - 1, Math.max(0, Math.round(val) - 1))];
    activePillTitle.textContent = target ? target.name : `Scrubbing ${val.toFixed(1)}`;

    activeLayers.forEach((layer) => {
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
          currentCycle = (currentCycle % activeLayers.length) + 1;
          toggleSolo(currentCycle);
        }, 1200);
      }
    });
  }

  // Keyboard Shortcuts (Space for A/B flip, 1-8 for Solo Styles)
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
    } else if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(e.key)) {
      const num = parseInt(e.key, 10);
      if (num <= activeLayers.length) {
        toggleSolo(num);
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" && isFlashing) {
      e.preventDefault();
      flashEnd();
    }
  });

  // Sample Selector Button Clicks
  document.querySelectorAll(".sample-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sampleKey = btn.getAttribute("data-sample");
      loadSample(sampleKey);
    });
  });

  // Bulk Multi-Image Uploader
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

    imgFiles.slice(0, activeLayers.length).forEach((file, idx) => {
      if (activeLayers[idx]) {
        activeLayers[idx].src = URL.createObjectURL(file);
        activeLayers[idx].name = file.name.replace(/\.[^/.]+$/, "");
        activeLayers[idx].tag = `Custom Upload (${file.name})`;
      }
    });

    setMultiMode("mixer");
    toggleSolo(1);
    alert(`Successfully loaded ${Math.min(imgFiles.length, activeLayers.length)} images into the sample!`);
  }

  // Reset to default sample
  if (btnResetMulti) {
    btnResetMulti.addEventListener("click", (e) => {
      e.stopPropagation();
      loadSample(currentSampleKey);
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
      const bTitle = btn.getAttribute("data-before-title") || "Before";
      const aTitle = btn.getAttribute("data-after-title") || "After";

      if (beforeSrc && imgBefore) imgBefore.src = beforeSrc;
      if (afterSrc && imgAfter) imgAfter.src = afterSrc;
      if (badgeBeforeTxt) badgeBeforeTxt.textContent = bTitle;
      if (badgeAfterTxt) badgeAfterTxt.textContent = aTitle;
      
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

  // Initialize with Sample 1 (OptiX Ray-Tracing Passes)
  loadSample("optix");
});
