import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs

ApplicationWindow {
    id: root
    visible: true
    width: 1300
    height: 860
    minimumWidth: 1080
    minimumHeight: 700
    title: "RenderPass Ping-Pong Multi-Shot Generator"
    color: "#121318"

    property bool isSyncing: false

    FolderDialog {
        id: folderDialog
        title: "Select Sequence Directory"
        currentFolder: "file:///" + (backend.folderPath ? backend.folderPath : "D:/madoodia/dev/madoodia.github.io/images/oslviewer/Cinematic_Shots")
        onAccepted: backend.loadFolder(selectedFolder.toString())
    }

    function resetPreview() {
        var res = backend.getCrossfadeInfo(0.0);
        previewA.source = res[0];
        previewB.source = res[1];
        previewB.opacity = 0.0;
        scrubSlider.value = 0.0;
    }

    function pushParamsToActiveSlot() {
        if (isSyncing || backend.activeSlotIndex < 0)
            return;
        var w = parseInt(targetWidthInput.text) || backend.sampleWidth || 1080;
        var h = parseInt(targetHeightInput.text) || backend.sampleHeight || 1080;
        var fps = parseInt(fpsInput.text) || 60;
        var fadeVal = (fadeSecSpin.value || 6) / 10.0;
        var holdVal = (holdSecSpin.value || 8) / 10.0;

        backend.updateSlotParams(backend.activeSlotIndex, slotNameInput.text, w, h, fps, fadeVal, holdVal);
    }

    function syncCropToActiveSlot() {
        if (backend.activeSlotIndex >= 0) {
            var d = backend.getSlotData(backend.activeSlotIndex);
            if (d && d.target_w) {
                isSyncing = true;
                slotNameInput.text = d.name.replace(/\.mp4$/i, "");
                targetWidthInput.text = d.target_w.toString();
                targetHeightInput.text = d.target_h.toString();
                fpsInput.text = d.fps.toString();
                fadeSecSpin.value = Math.round(d.trans_sec * 10);
                holdSecSpin.value = Math.round(d.hold_sec * 10);
                cropBox.applyNormalized(d.nx, d.ny, d.nw, d.nh);
                isSyncing = false;
            }
        }
    }

    Connections {
        target: backend
        function onExportFinished(success, msg) {
            progressBar.value = success ? 100 : 0;
            statusText.text = msg;
            statusText.color = success ? "#81c784" : "#e57373";
            renderAllBtn.enabled = true;
        }
        function onProgressChanged(p) {
            progressBar.value = p;
        }
        function onImagesLoaded() {
            resetPreview();
            syncCropToActiveSlot();
        }
        function onActiveSlotChanged() {
            syncCropToActiveSlot();
        }
    }

    Component.onCompleted: {
        resetPreview();
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 14
        spacing: 10

        // --- Top Path Bar ---
        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            Text {
                text: "Source Folder:"
                color: "#8e91a4"
                font.bold: true
                font.pixelSize: 12
                Layout.preferredWidth: 95
            }

            Rectangle {
                Layout.fillWidth: true
                height: 32
                color: "#1a1c23"
                radius: 4
                border.color: pathField.activeFocus ? "#4a76c9" : "#2a2d39"

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 8
                    anchors.rightMargin: 8

                    TextInput {
                        id: pathField
                        Layout.fillWidth: true
                        text: backend.folderPath
                        color: "#e2e4ea"
                        font.family: "Consolas, Monospace"
                        font.pixelSize: 12
                        selectByMouse: true
                        activeFocusOnTab: true
                        KeyNavigation.tab: slotNameInput
                        onAccepted: backend.loadFolder(text)
                    }
                }
            }

            Button {
                text: "Browse..."
                implicitHeight: 32
                implicitWidth: 84
                onClicked: folderDialog.open()
                contentItem: Text {
                    text: parent.text
                    color: "#f0f0f4"
                    font.bold: true
                    font.pixelSize: 11
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
                background: Rectangle {
                    color: parent.down ? "#2e3240" : (parent.hovered ? "#262936" : "#1e212b")
                    radius: 4
                    border.color: "#333748"
                }
            }
        }

        // --- Center Canvas: Interactive Scrub + Letterbox Crop Mask ---
        Rectangle {
            id: canvasContainer
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: "#0a0b0e"
            radius: 6
            border.color: "#1d202a"
            clip: true

            Item {
                id: imageViewport
                anchors.fill: parent
                anchors.margins: 16

                Image {
                    id: previewA
                    anchors.fill: parent
                    fillMode: Image.PreserveAspectFit
                    cache: false
                    asynchronous: false
                    onStatusChanged: {
                        if (status === Image.Ready) {
                            cropBox.recalculateCrop();
                        }
                    }
                }

                Image {
                    id: previewB
                    anchors.fill: parent
                    fillMode: Image.PreserveAspectFit
                    opacity: 0.0
                    cache: false
                    asynchronous: false
                }

                readonly property real paintedX: (imageViewport.width - previewA.paintedWidth) / 2
                readonly property real paintedY: (imageViewport.height - previewA.paintedHeight) / 2
                readonly property real paintedW: previewA.paintedWidth
                readonly property real paintedH: previewA.paintedHeight

                onPaintedWChanged: cropBox.recalculateCrop()
                onPaintedHChanged: cropBox.recalculateCrop()

                // Cutout / Active Viewport Rectangle
                Item {
                    id: cropBox
                    visible: backend.activeSlotIndex >= 0 && imageViewport.paintedW > 20

                    property real normX: 0.0
                    property real normY: 0.0
                    property real normW: 1.0
                    property real normH: 1.0

                    function recalculateCrop() {
                        if (imageViewport.paintedW <= 0 || imageViewport.paintedH <= 0)
                            return;
                        var w = parseInt(targetWidthInput.text) || backend.sampleWidth || 1080;
                        var h = parseInt(targetHeightInput.text) || backend.sampleHeight || 1080;
                        var targetAspect = w / h;

                        var boxH = imageViewport.paintedH;
                        var boxW = boxH * targetAspect;

                        if (boxW > imageViewport.paintedW) {
                            boxW = imageViewport.paintedW;
                            boxH = boxW / targetAspect;
                        }

                        width = boxW;
                        height = boxH;
                        x = imageViewport.paintedX + (imageViewport.paintedW - boxW) / 2;
                        y = imageViewport.paintedY + (imageViewport.paintedH - boxH) / 2;
                        updateFromPixel();
                    }

                    function applyNormalized(nx, ny, nw, nh) {
                        if (imageViewport.paintedW <= 0 || imageViewport.paintedH <= 0)
                            return;
                        normX = nx;
                        normY = ny;
                        normW = nw;
                        normH = nh;
                        x = imageViewport.paintedX + nx * imageViewport.paintedW;
                        y = imageViewport.paintedY + ny * imageViewport.paintedH;
                        width = nw * imageViewport.paintedW;
                        height = nh * imageViewport.paintedH;
                    }

                    function updateFromPixel() {
                        if (imageViewport.paintedW > 0 && imageViewport.paintedH > 0) {
                            normX = Math.max(0.0, (x - imageViewport.paintedX) / imageViewport.paintedW);
                            normY = Math.max(0.0, (y - imageViewport.paintedY) / imageViewport.paintedH);
                            normW = Math.min(1.0 - normX, width / imageViewport.paintedW);
                            normH = Math.min(1.0 - normY, height / imageViewport.paintedH);
                            if (backend.activeSlotIndex >= 0) {
                                backend.updateSlotCrop(backend.activeSlotIndex, normX, normY, normW, normH);
                            }
                        }
                    }

                    // Top Dashed Line
                    Row {
                        anchors.top: parent.top
                        anchors.left: parent.left
                        anchors.right: parent.right
                        spacing: 8
                        clip: true
                        Repeater {
                            model: Math.ceil(cropBox.width / 16)
                            Rectangle {
                                width: 8
                                height: 3
                                color: "#ffcc00"
                            }
                        }
                    }

                    // Bottom Dashed Line
                    Row {
                        anchors.bottom: parent.bottom
                        anchors.left: parent.left
                        anchors.right: parent.right
                        spacing: 8
                        clip: true
                        Repeater {
                            model: Math.ceil(cropBox.width / 16)
                            Rectangle {
                                width: 8
                                height: 3
                                color: "#ffcc00"
                            }
                        }
                    }

                    // Left Dashed Line
                    Column {
                        anchors.top: parent.top
                        anchors.bottom: parent.bottom
                        anchors.left: parent.left
                        spacing: 8
                        clip: true
                        Repeater {
                            model: Math.ceil(cropBox.height / 16)
                            Rectangle {
                                width: 3
                                height: 8
                                color: "#ffcc00"
                            }
                        }
                    }

                    // Right Dashed Line
                    Column {
                        anchors.top: parent.top
                        anchors.bottom: parent.bottom
                        anchors.right: parent.right
                        spacing: 8
                        clip: true
                        Repeater {
                            model: Math.ceil(cropBox.height / 16)
                            Rectangle {
                                width: 3
                                height: 8
                                color: "#ffcc00"
                            }
                        }
                    }

                    // L-Corner Brackets
                    Item {
                        anchors.fill: parent

                        Rectangle {
                            x: -2
                            y: -2
                            width: 30
                            height: 6
                            color: "#ffcc00"
                        }
                        Rectangle {
                            x: -2
                            y: -2
                            width: 6
                            height: 30
                            color: "#ffcc00"
                        }

                        Rectangle {
                            x: parent.width - 28
                            y: -2
                            width: 30
                            height: 6
                            color: "#ffcc00"
                        }
                        Rectangle {
                            x: parent.width - 4
                            y: -2
                            width: 6
                            height: 30
                            color: "#ffcc00"
                        }

                        Rectangle {
                            x: -2
                            y: parent.height - 4
                            width: 30
                            height: 6
                            color: "#ffcc00"
                        }
                        Rectangle {
                            x: -2
                            y: parent.height - 28
                            width: 6
                            height: 30
                            color: "#ffcc00"
                        }

                        Rectangle {
                            x: parent.width - 28
                            y: parent.height - 4
                            width: 30
                            height: 6
                            color: "#ffcc00"
                        }
                        Rectangle {
                            x: parent.width - 4
                            y: parent.height - 28
                            width: 6
                            height: 30
                            color: "#ffcc00"
                        }
                    }

                    // Inner Title Tag Box
                    Rectangle {
                        id: tagPlate
                        color: "#ffcc00"
                        height: 24
                        width: tagText.implicitWidth + 16
                        radius: 3
                        anchors.top: parent.top
                        anchors.topMargin: 10
                        anchors.left: parent.left
                        anchors.leftMargin: 10

                        Text {
                            id: tagText
                            anchors.centerIn: parent
                            text: "Shot Size: " + targetWidthInput.text + "x" + targetHeightInput.text
                            color: "#000000"
                            font.bold: true
                            font.pixelSize: 11
                        }
                    }

                    MouseArea {
                        anchors.fill: parent
                        drag.target: cropBox
                        drag.axis: Drag.XAndYAxis
                        drag.minimumX: imageViewport.paintedX
                        drag.maximumX: imageViewport.paintedX + imageViewport.paintedW - cropBox.width
                        drag.minimumY: imageViewport.paintedY
                        drag.maximumY: imageViewport.paintedY + imageViewport.paintedH - cropBox.height
                        cursorShape: Qt.SizeAllCursor
                        onPositionChanged: cropBox.updateFromPixel()
                    }
                }
            }

            // Timeline Scrub Bar
            Rectangle {
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                height: 38
                color: "#dd121318"

                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 8
                    spacing: 10

                    Text {
                        text: "Scrub Loop:"
                        color: "#8e91a4"
                        font.pixelSize: 11
                        font.bold: true
                    }

                    Slider {
                        id: scrubSlider
                        Layout.fillWidth: true
                        from: 0.0
                        to: 1.0
                        value: 0.0

                        background: Rectangle {
                            x: scrubSlider.leftPadding
                            y: scrubSlider.topPadding + scrubSlider.availableHeight / 2 - height / 2
                            width: scrubSlider.availableWidth
                            height: 4
                            radius: 2
                            color: "#2a2d39"

                            Rectangle {
                                width: scrubSlider.visualPosition * parent.width
                                height: parent.height
                                color: "#ffd54f"
                                radius: 2
                            }
                        }

                        handle: Rectangle {
                            x: scrubSlider.leftPadding + scrubSlider.visualPosition * (scrubSlider.availableWidth - width)
                            y: scrubSlider.topPadding + scrubSlider.availableHeight / 2 - height / 2
                            implicitWidth: 14
                            implicitHeight: 14
                            radius: 7
                            color: scrubSlider.pressed ? "#ffe082" : "#ffd54f"
                            border.color: "#121318"
                            border.width: 2
                        }

                        onValueChanged: {
                            var res = backend.getCrossfadeInfo(value);
                            previewA.source = res[0];
                            previewB.source = res[1];
                            previewB.opacity = res[2];
                        }
                    }
                }
            }
        }

        // --- Video Export Slots List ---
        Rectangle {
            Layout.fillWidth: true
            height: 130
            color: "#161820"
            radius: 6
            border.color: "#232632"

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 8
                spacing: 6

                RowLayout {
                    Layout.fillWidth: true
                    Text {
                        text: "Configured Export Slots (" + backend.videoQueue.length + ")"
                        color: "#e2e4ea"
                        font.bold: true
                        font.pixelSize: 12
                    }
                    Text {
                        text: "— Select a slot to display its crop box on the canvas"
                        color: "#6b7082"
                        font.pixelSize: 11
                    }
                    Item {
                        Layout.fillWidth: true
                    }
                    Button {
                        text: "Clear All"
                        implicitHeight: 24
                        implicitWidth: 64
                        enabled: backend.videoQueue.length > 0
                        onClicked: backend.clearQueue()
                        background: Rectangle {
                            color: "#1e212b"
                            radius: 3
                            border.color: "#2d3140"
                        }
                        contentItem: Text {
                            text: parent.text
                            color: "#9a9cb0"
                            font.pixelSize: 10
                            anchors.centerIn: parent
                        }
                    }
                }

                ListView {
                    id: queueList
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    spacing: 4
                    model: backend.videoQueue

                    delegate: Rectangle {
                        width: queueList.width
                        height: 34
                        color: backend.activeSlotIndex === index ? "#212738" : "#1a1c24"
                        radius: 4
                        border.color: backend.activeSlotIndex === index ? "#4a76c9" : "#252835"
                        border.width: backend.activeSlotIndex === index ? 1.5 : 1

                        MouseArea {
                            anchors.fill: parent
                            onClicked: backend.selectSlot(index)
                        }

                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 10
                            anchors.rightMargin: 10
                            spacing: 8

                            Rectangle {
                                width: 8
                                height: 8
                                radius: 4
                                color: backend.activeSlotIndex === index ? "#ffd54f" : "#444758"
                            }

                            Text {
                                text: modelData.name
                                color: backend.activeSlotIndex === index ? "#ffffff" : "#c6c8d4"
                                font.bold: true
                                font.pixelSize: 12
                                Layout.preferredWidth: 220
                                elide: Text.ElideRight
                            }

                            Text {
                                text: modelData.summary
                                color: "#828699"
                                font.pixelSize: 11
                                Layout.fillWidth: true
                            }

                            Rectangle {
                                Layout.preferredWidth: 22
                                Layout.preferredHeight: 22
                                Layout.alignment: Qt.AlignVCenter
                                color: delMouse.containsMouse ? "#3d2228" : "#261a20"
                                radius: 4
                                border.color: delMouse.containsMouse ? "#e57373" : "#3d2a32"

                                Text {
                                    text: "✕"
                                    color: delMouse.containsMouse ? "#ff8a80" : "#e57373"
                                    font.pixelSize: 10
                                    anchors.centerIn: parent
                                }

                                MouseArea {
                                    id: delMouse
                                    anchors.fill: parent
                                    hoverEnabled: true
                                    onClicked: backend.removeVideoSlot(index)
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- Bottom Parameter Bar ---
        Rectangle {
            Layout.fillWidth: true
            height: 74
            color: "#161820"
            radius: 6
            border.color: "#232632"

            RowLayout {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 12

                // Section 1: Shot Name & Format
                ColumnLayout {
                    spacing: 3
                    Text {
                        text: "Shot Name & Format:"
                        color: "#828699"
                        font.bold: true
                        font.pixelSize: 10
                    }
                    RowLayout {
                        spacing: 6

                        Rectangle {
                            width: 140
                            height: 32
                            color: "#1e212b"
                            radius: 4
                            border.color: slotNameInput.activeFocus ? "#4a76c9" : "#303444"
                            TextInput {
                                id: slotNameInput
                                anchors.fill: parent
                                anchors.margins: 6
                                text: "shot_native_pass"
                                color: "#e2e4ea"
                                font.pixelSize: 11
                                activeFocusOnTab: true
                                KeyNavigation.tab: presetCombo
                                onTextChanged: pushParamsToActiveSlot()
                            }
                        }

                        // Presets
                        ComboBox {
                            id: presetCombo
                            model: ["Original Size (" + backend.sampleWidth + "x" + backend.sampleHeight + ")", "9:16 Shorts (1080x1920)", "16:9 Standard (1920x1080)", "1:1 Square (1080x1080)", "Custom"]
                            currentIndex: 0
                            implicitWidth: 190
                            implicitHeight: 32
                            activeFocusOnTab: true
                            KeyNavigation.tab: targetWidthInput

                            background: Rectangle {
                                color: "#1e212b"
                                radius: 4
                                border.color: presetCombo.activeFocus ? "#4a76c9" : "#303444"
                            }
                            contentItem: Text {
                                text: presetCombo.displayText
                                color: "#e2e4ea"
                                font.pixelSize: 11
                                verticalAlignment: Text.AlignVCenter
                                leftPadding: 8
                                rightPadding: 26
                                elide: Text.ElideRight
                            }

                            indicator: Canvas {
                                x: presetCombo.width - width - 8
                                y: (presetCombo.height - height) / 2
                                width: 10
                                height: 6
                                onPaint: {
                                    var ctx = getContext("2d");
                                    ctx.reset();
                                    ctx.moveTo(0, 0);
                                    ctx.lineTo(width, 0);
                                    ctx.lineTo(width / 2, height);
                                    ctx.closePath();
                                    ctx.fillStyle = "#8a8ea0";
                                    ctx.fill();
                                }
                            }

                            popup: Popup {
                                y: presetCombo.height + 2
                                width: presetCombo.width
                                implicitHeight: contentItem.implicitHeight
                                padding: 2
                                background: Rectangle {
                                    color: "#1a1c24"
                                    radius: 4
                                    border.color: "#303444"
                                }
                                contentItem: ListView {
                                    clip: true
                                    implicitHeight: contentHeight
                                    model: presetCombo.popup.visible ? presetCombo.delegateModel : null
                                    currentIndex: presetCombo.highlightedIndex
                                }
                            }

                            delegate: ItemDelegate {
                                width: presetCombo.width
                                height: 28
                                highlighted: presetCombo.highlightedIndex === index
                                background: Rectangle {
                                    color: highlighted ? "#2b3144" : "#1a1c24"
                                }
                                contentItem: Text {
                                    text: modelData
                                    color: highlighted ? "#ffd54f" : "#e2e4ea"
                                    font.pixelSize: 11
                                    verticalAlignment: Text.AlignVCenter
                                    leftPadding: 6
                                }
                            }

                            onCurrentIndexChanged: {
                                if (currentIndex === 0) {
                                    targetWidthInput.text = backend.sampleWidth.toString();
                                    targetHeightInput.text = backend.sampleHeight.toString();
                                } else if (currentIndex === 1) {
                                    targetWidthInput.text = "1080";
                                    targetHeightInput.text = "1920";
                                } else if (currentIndex === 2) {
                                    targetWidthInput.text = "1920";
                                    targetHeightInput.text = "1080";
                                } else if (currentIndex === 3) {
                                    targetWidthInput.text = "1080";
                                    targetHeightInput.text = "1080";
                                }
                                cropBox.recalculateCrop();
                                pushParamsToActiveSlot();
                            }
                        }

                        Rectangle {
                            width: 56
                            height: 32
                            color: "#1e212b"
                            radius: 4
                            border.color: targetWidthInput.activeFocus ? "#4a76c9" : "#303444"
                            TextInput {
                                id: targetWidthInput
                                anchors.fill: parent
                                anchors.margins: 6
                                text: backend.sampleWidth.toString()
                                color: "#a5d6a7"
                                font.pixelSize: 11
                                activeFocusOnTab: true
                                KeyNavigation.tab: targetHeightInput
                                onTextChanged: {
                                    cropBox.recalculateCrop();
                                    pushParamsToActiveSlot();
                                }
                            }
                        }
                        Text {
                            text: "×"
                            color: "#666"
                            font.pixelSize: 11
                        }
                        Rectangle {
                            width: 56
                            height: 32
                            color: "#1e212b"
                            radius: 4
                            border.color: targetHeightInput.activeFocus ? "#4a76c9" : "#303444"
                            TextInput {
                                id: targetHeightInput
                                anchors.fill: parent
                                anchors.margins: 6
                                text: backend.sampleHeight.toString()
                                color: "#a5d6a7"
                                font.pixelSize: 11
                                activeFocusOnTab: true
                                KeyNavigation.tab: fpsInput
                                onTextChanged: {
                                    cropBox.recalculateCrop();
                                    pushParamsToActiveSlot();
                                }
                            }
                        }
                    }
                }

                // Section 2: Timing & FPS
                ColumnLayout {
                    spacing: 3
                    Text {
                        text: "Timing & Framerate:"
                        color: "#828699"
                        font.bold: true
                        font.pixelSize: 10
                    }
                    RowLayout {
                        spacing: 8

                        Text {
                            text: "Fade:"
                            color: "#9a9cb0"
                            font.pixelSize: 11
                        }
                        Rectangle {
                            width: 82
                            height: 32
                            color: "#1e212b"
                            radius: 4
                            border.color: "#303444"
                            RowLayout {
                                anchors.fill: parent
                                spacing: 0
                                Rectangle {
                                    width: 22
                                    height: parent.height
                                    color: "transparent"
                                    Text {
                                        text: "−"
                                        color: "#bbb"
                                        anchors.centerIn: parent
                                        font.bold: true
                                    }
                                    MouseArea {
                                        anchors.fill: parent
                                        onClicked: if (fadeSecSpin.value > 1)
                                            fadeSecSpin.value -= 1
                                    }
                                }
                                Text {
                                    id: fadeSecSpin
                                    property int value: 6
                                    Layout.fillWidth: true
                                    horizontalAlignment: Text.AlignHCenter
                                    text: (value / 10.0).toFixed(1) + "s"
                                    color: "#e2e4ea"
                                    font.pixelSize: 11
                                    onValueChanged: pushParamsToActiveSlot()
                                }
                                Rectangle {
                                    width: 22
                                    height: parent.height
                                    color: "transparent"
                                    Text {
                                        text: "+"
                                        color: "#bbb"
                                        anchors.centerIn: parent
                                        font.bold: true
                                    }
                                    MouseArea {
                                        anchors.fill: parent
                                        onClicked: if (fadeSecSpin.value < 50)
                                            fadeSecSpin.value += 1
                                    }
                                }
                            }
                        }

                        Text {
                            text: "Hold:"
                            color: "#9a9cb0"
                            font.pixelSize: 11
                        }
                        Rectangle {
                            width: 82
                            height: 32
                            color: "#1e212b"
                            radius: 4
                            border.color: "#303444"
                            RowLayout {
                                anchors.fill: parent
                                spacing: 0
                                Rectangle {
                                    width: 22
                                    height: parent.height
                                    color: "transparent"
                                    Text {
                                        text: "−"
                                        color: "#bbb"
                                        anchors.centerIn: parent
                                        font.bold: true
                                    }
                                    MouseArea {
                                        anchors.fill: parent
                                        onClicked: if (holdSecSpin.value > 1)
                                            holdSecSpin.value -= 1
                                    }
                                }
                                Text {
                                    id: holdSecSpin
                                    property int value: 8
                                    Layout.fillWidth: true
                                    horizontalAlignment: Text.AlignHCenter
                                    text: (value / 10.0).toFixed(1) + "s"
                                    color: "#e2e4ea"
                                    font.pixelSize: 11
                                    onValueChanged: pushParamsToActiveSlot()
                                }
                                Rectangle {
                                    width: 22
                                    height: parent.height
                                    color: "transparent"
                                    Text {
                                        text: "+"
                                        color: "#bbb"
                                        anchors.centerIn: parent
                                        font.bold: true
                                    }
                                    MouseArea {
                                        anchors.fill: parent
                                        onClicked: if (holdSecSpin.value < 50)
                                            holdSecSpin.value += 1
                                    }
                                }
                            }
                        }

                        Text {
                            text: "FPS:"
                            color: "#9a9cb0"
                            font.pixelSize: 11
                        }
                        Rectangle {
                            width: 44
                            height: 32
                            color: "#1e212b"
                            radius: 4
                            border.color: fpsInput.activeFocus ? "#4a76c9" : "#303444"
                            TextInput {
                                id: fpsInput
                                anchors.fill: parent
                                anchors.margins: 6
                                text: "60"
                                color: "#ffd54f"
                                font.pixelSize: 11
                                horizontalAlignment: Text.AlignHCenter
                                activeFocusOnTab: true
                                KeyNavigation.tab: addSlotBtn
                                onTextChanged: pushParamsToActiveSlot()
                            }
                        }
                    }
                }

                Item {
                    Layout.fillWidth: true
                }

                // Section 3: Buttons
                RowLayout {
                    spacing: 10

                    Button {
                        id: addSlotBtn
                        text: "+ Add Slot"
                        implicitHeight: 34
                        implicitWidth: 100
                        activeFocusOnTab: true
                        KeyNavigation.tab: renderAllBtn
                        enabled: backend.imageCount > 0

                        contentItem: Text {
                            text: parent.text
                            color: "#fff"
                            font.bold: true
                            font.pixelSize: 11
                            horizontalAlignment: Text.AlignHCenter
                            verticalAlignment: Text.AlignVCenter
                        }
                        background: Rectangle {
                            color: parent.down ? "#286834" : (parent.hovered ? "#317a3f" : "#3b8e4c")
                            radius: 4
                            border.color: parent.activeFocus ? "#ffffff" : "transparent"
                        }
                        onClicked: {
                            var w = parseInt(targetWidthInput.text) || backend.sampleWidth || 1080;
                            var h = parseInt(targetHeightInput.text) || backend.sampleHeight || 1080;
                            var fps = parseInt(fpsInput.text) || 60;
                            var fadeVal = (fadeSecSpin.value || 6) / 10.0;
                            var holdVal = (holdSecSpin.value || 8) / 10.0;
                            var nx = isNaN(cropBox.normX) ? 0.0 : cropBox.normX;
                            var ny = isNaN(cropBox.normY) ? 0.0 : cropBox.normY;
                            var nw = isNaN(cropBox.normW) ? 1.0 : cropBox.normW;
                            var nh = isNaN(cropBox.normH) ? 1.0 : cropBox.normH;

                            backend.addVideoSlot(slotNameInput.text, nx, ny, nw, nh, w, h, fps, fadeVal, holdVal);
                        }
                    }

                    ColumnLayout {
                        Layout.preferredWidth: 190
                        spacing: 3

                        ProgressBar {
                            id: progressBar
                            Layout.fillWidth: true
                            from: 0
                            to: 100
                            value: 0
                        }

                        Button {
                            id: renderAllBtn
                            text: "Render All Slots (" + backend.videoQueue.length + ")"
                            Layout.fillWidth: true
                            implicitHeight: 34
                            activeFocusOnTab: true
                            enabled: backend.videoQueue.length > 0

                            contentItem: Text {
                                text: parent.text
                                color: parent.enabled ? "#ffffff" : "#666"
                                font.bold: true
                                font.pixelSize: 11
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                            }
                            background: Rectangle {
                                color: parent.enabled ? (parent.down ? "#1558a6" : (parent.hovered ? "#1967c2" : "#1e78e3")) : "#22252e"
                                radius: 4
                                border.color: parent.activeFocus ? "#ffffff" : "transparent"
                            }
                            onClicked: {
                                renderAllBtn.enabled = false;
                                backend.renderQueue();
                            }
                        }
                    }
                }
            }
        }

        // --- Status Footer ---
        RowLayout {
            Layout.fillWidth: true
            Text {
                id: statusText
                text: backend.statusMessage
                color: "#e5c07b"
                font.pixelSize: 11
                Layout.fillWidth: true
                elide: Text.ElideRight
            }
        }
    }
}
