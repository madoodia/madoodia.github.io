import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs

ApplicationWindow {
    id: root
    visible: true
    width: 980
    height: 760
    minimumWidth: 800
    minimumHeight: 560
    title: "In-Place Batch Renamer"
    color: "#1a1b20"

    FolderDialog {
        id: sourceFolderDialog
        title: "Select Working Directory"
        currentFolder: "file:///" + (backend.folderPath ? backend.folderPath : "D:/madoodia/dev/OSLViewer/RenderOutputs")
        onAccepted: backend.loadFolder(selectedFolder.toString())
    }

    FileDialog {
        id: watermarkImageDialog
        title: "Select Watermark / Stamp Image"
        nameFilters: ["Images (*.png *.jpg *.jpeg *.svg)"]
        onAccepted: backend.watermarkImagePath = selectedFile.toString()
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 14
        spacing: 10

        // --- Path Row ---
        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            Text {
                text: "Directory:"
                color: "#9999a5"
                font.pixelSize: 13
                font.bold: true
                Layout.preferredWidth: 65
            }

            TextField {
                id: sourcePathInput
                Layout.fillWidth: true
                text: backend.folderPath
                placeholderText: "Folder path..."
                placeholderTextColor: "#666"
                color: "#e0e0e0"
                font.family: "Consolas, Monospace"
                background: Rectangle {
                    color: "#252630"
                    radius: 4
                    border.color: "#373846"
                }
                onAccepted: backend.loadFolder(text)
            }

            Button {
                text: "Browse..."
                onClicked: sourceFolderDialog.open()
                contentItem: Text {
                    text: parent.text
                    color: "#f0f0f0"
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
                background: Rectangle {
                    color: parent.down ? "#444654" : (parent.hovered ? "#353744" : "#282a35")
                    radius: 4
                }
            }
        }

        // --- Extension Filters Row ---
        RowLayout {
            Layout.fillWidth: true
            Layout.preferredHeight: 30
            spacing: 8

            Text {
                text: "Filter:"
                color: "#9999a5"
                font.pixelSize: 13
                font.bold: true
                Layout.preferredWidth: 65
            }

            ListView {
                id: extListView
                Layout.fillWidth: true
                Layout.preferredHeight: 28
                orientation: ListView.Horizontal
                spacing: 6
                clip: true
                model: backend.detectedExtensions

                delegate: Rectangle {
                    height: 26
                    width: extRow.implicitWidth + 12
                    radius: 4
                    color: extCheck.checked ? "#2c3b59" : "#24252e"
                    border.color: extCheck.checked ? "#4a76c9" : "#373846"

                    RowLayout {
                        id: extRow
                        anchors.centerIn: parent
                        spacing: 4

                        CheckBox {
                            id: extCheck
                            checked: backend.isExtensionActive(modelData)

                            // Remove default control padding so it doesn't inflate row bounds
                            padding: 0
                            topPadding: 0
                            bottomPadding: 0
                            leftPadding: 0
                            rightPadding: 0

                            Layout.alignment: Qt.AlignVCenter
                            implicitWidth: 14
                            implicitHeight: 14

                            indicator: Rectangle {
                                implicitWidth: 14
                                implicitHeight: 14
                                anchors.centerIn: parent
                                radius: 2
                                color: extCheck.checked ? "#4a76c9" : "#1a1b20"
                                border.color: "#6b7280"
                            }

                            onToggled: backend.toggleExtension(modelData, checked, patternInput.text)
                        }

                        Text {
                            text: modelData
                            color: "#e0e0e0"
                            font.pixelSize: 12
                            font.family: "Monospace"
                        }
                    }
                }
            }
        }

        // --- Template Pattern Row ---
        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            Text {
                text: "Pattern:"
                color: "#9999a5"
                font.pixelSize: 13
                font.bold: true
                Layout.preferredWidth: 65
            }

            TextField {
                id: patternInput
                Layout.fillWidth: true
                text: "[##].[name].[ext]"
                color: "#81c784"
                font.family: "Consolas, Monospace"
                font.pixelSize: 13
                background: Rectangle {
                    color: "#252630"
                    radius: 4
                    border.color: "#373846"
                }
                onTextChanged: backend.generatePreview(text)
            }

            Text {
                text: "Tokens: [##], [name], [ext], [0], [1]"
                color: "#666"
                font.pixelSize: 11
            }
        }

        // --- List Header ---
        Rectangle {
            Layout.fillWidth: true
            height: 28
            color: "#22232c"
            radius: 4

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 10
                anchors.rightMargin: 10
                spacing: 10

                Text {
                    text: "Order"
                    color: "#888899"
                    font.bold: true
                    font.pixelSize: 11
                    Layout.preferredWidth: 26
                }

                Text {
                    text: "Preview"
                    color: "#888899"
                    font.bold: true
                    font.pixelSize: 11
                    Layout.preferredWidth: 76
                }

                Text {
                    text: "Target Filename (Click to Edit)"
                    color: "#888899"
                    font.bold: true
                    font.pixelSize: 11
                    Layout.fillWidth: true
                }
            }
        }

        // --- File List View ---
        ListView {
            id: fileListView
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            model: backend.previewData
            spacing: 4

            delegate: Rectangle {
                id: delegateRect
                width: fileListView.width
                height: 62
                color: index % 2 === 0 ? "#202129" : "#24252f"
                radius: 4

                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 4
                    spacing: 10

                    // Up / Down Reorder Controls
                    Column {
                        Layout.preferredWidth: 24
                        spacing: 4
                        anchors.verticalCenter: parent.verticalCenter

                        Rectangle {
                            width: 24
                            height: 24
                            radius: 3
                            color: upMouse.containsMouse ? "#3f4254" : "#2d2f3b"
                            Text {
                                text: "▲"
                                color: "#ccc"
                                font.pixelSize: 10
                                anchors.centerIn: parent
                            }
                            MouseArea {
                                id: upMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                onClicked: backend.moveItem(index, index - 1, patternInput.text)
                            }
                        }

                        Rectangle {
                            width: 24
                            height: 24
                            radius: 3
                            color: downMouse.containsMouse ? "#3f4254" : "#2d2f3b"
                            Text {
                                text: "▼"
                                color: "#ccc"
                                font.pixelSize: 10
                                anchors.centerIn: parent
                            }
                            MouseArea {
                                id: downMouse
                                anchors.fill: parent
                                hoverEnabled: true
                                onClicked: backend.moveItem(index, index + 1, patternInput.text)
                            }
                        }
                    }

                    // Scaled Thumbnail Preview (72x54)
                    Rectangle {
                        Layout.preferredWidth: 76
                        Layout.preferredHeight: 54
                        color: "#141518"
                        radius: 3
                        border.color: "#30323d"

                        Image {
                            anchors.fill: parent
                            anchors.margins: 2
                            source: modelData.url
                            sourceSize.width: 152
                            sourceSize.height: 108
                            fillMode: Image.PreserveAspectFit
                            asynchronous: true
                            cache: false
                        }
                    }

                    // Inline Editable Name Field
                    TextField {
                        id: nameEditField
                        Layout.fillWidth: true
                        text: modelData.new
                        color: modelData.old === modelData.new ? "#888899" : "#a5d6a7"
                        font.family: "Consolas, Monospace"
                        font.pixelSize: 13
                        selectByMouse: true

                        background: Rectangle {
                            color: nameEditField.activeFocus ? "#2d2f3c" : "#1a1b22"
                            radius: 3
                            border.color: nameEditField.activeFocus ? "#4a76c9" : "#30323d"
                        }

                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.IBeamCursor
                            propagateComposedEvents: true
                            onPressed: mouse => {
                                nameEditField.forceActiveFocus();
                                nameEditField.selectAll();
                                mouse.accepted = false;
                            }
                        }

                        onEditingFinished: backend.updateManualName(index, text)
                    }
                }
            }
        }

        // --- Watermark Options Section ---
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: wmCol.implicitHeight + 12
            color: "#22232c"
            radius: 4
            border.color: backend.watermarkEnabled ? "#388bfd" : "#30323d"
            border.width: 1

            ColumnLayout {
                id: wmCol
                anchors.fill: parent
                anchors.margins: 6
                spacing: 6

                RowLayout {
                    Layout.fillWidth: true
                    spacing: 10

                    CheckBox {
                        id: wmCheck
                        checked: backend.watermarkEnabled
                        onToggled: backend.watermarkEnabled = checked
                        text: "Print Watermark / Stamp on images before renaming"
                        contentItem: Text {
                            text: wmCheck.text
                            color: wmCheck.checked ? "#79c0ff" : "#9999a5"
                            font.bold: true
                            font.pixelSize: 12
                            verticalAlignment: Text.AlignVCenter
                            leftPadding: wmCheck.indicator.width + 6
                        }
                    }

                    Item { Layout.fillWidth: true }

                    Text {
                        text: "Type:"
                        color: "#9999a5"
                        font.pixelSize: 11
                        visible: backend.watermarkEnabled
                    }

                    ComboBox {
                        id: wmTypeCombo
                        visible: backend.watermarkEnabled
                        model: ["Image", "Text"]
                        currentIndex: backend.watermarkType === "Text" ? 1 : 0
                        onActivated: backend.watermarkType = currentText
                        implicitWidth: 85
                        implicitHeight: 24
                    }

                    Text {
                        text: "Placement:"
                        color: "#9999a5"
                        font.pixelSize: 11
                        visible: backend.watermarkEnabled
                    }

                    ComboBox {
                        id: wmPosCombo
                        visible: backend.watermarkEnabled
                        model: ["Bottom-Left", "Bottom-Right", "Top-Left", "Top-Right", "Center"]
                        currentIndex: {
                            var p = backend.watermarkPosition;
                            for (var i = 0; i < model.length; ++i) if (model[i] === p) return i;
                            return 0;
                        }
                        onActivated: backend.watermarkPosition = currentText
                        implicitWidth: 115
                        implicitHeight: 24
                    }

                    Text {
                        text: "Padding:"
                        color: "#9999a5"
                        font.pixelSize: 11
                        visible: backend.watermarkEnabled
                    }

                    SpinBox {
                        visible: backend.watermarkEnabled
                        from: 0
                        to: 200
                        value: backend.watermarkPadding
                        stepSize: 4
                        editable: true
                        onValueModified: backend.watermarkPadding = value
                        implicitWidth: 80
                        implicitHeight: 24
                    }
                }

                // Row for Text value or Image Path
                RowLayout {
                    Layout.fillWidth: true
                    visible: backend.watermarkEnabled
                    spacing: 8

                    Text {
                        text: backend.watermarkType === "Text" ? "Text to print:" : "Stamp Image:"
                        color: "#c9d1d9"
                        font.pixelSize: 11
                        Layout.preferredWidth: 85
                    }

                    TextField {
                        id: wmValueField
                        Layout.fillWidth: true
                        text: backend.watermarkType === "Text" ? backend.watermarkText : backend.watermarkImagePath
                        color: "#ffffff"
                        font.family: "Consolas, Monospace"
                        font.pixelSize: 12
                        placeholderText: backend.watermarkType === "Text" ? "e.g. © 2026 madoodia.com" : "Select image file..."
                        background: Rectangle {
                            color: "#161b22"
                            radius: 3
                            border.color: "#30363d"
                        }
                        onEditingFinished: {
                            if (backend.watermarkType === "Text")
                                backend.watermarkText = text;
                            else
                                backend.watermarkImagePath = text;
                        }
                    }

                    Button {
                        visible: backend.watermarkType === "Image"
                        text: "Browse..."
                        implicitHeight: 24
                        onClicked: watermarkImageDialog.open()
                    }
                }
            }
        }

        // --- Bottom Controls ---
        RowLayout {
            Layout.fillWidth: true
            spacing: 12

            Text {
                text: backend.statusMessage
                color: "#e5c07b"
                font.pixelSize: 12
                Layout.fillWidth: true
                elide: Text.ElideRight
            }

            Button {
                text: "Rename In-Place"
                enabled: backend.previewData.length > 0
                contentItem: Text {
                    text: parent.text
                    color: parent.enabled ? "#ffffff" : "#666666"
                    font.bold: true
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
                background: Rectangle {
                    color: parent.enabled ? (parent.down ? "#2e7d32" : (parent.hovered ? "#388e3c" : "#43a047")) : "#262b26"
                    radius: 4
                }
                onClicked: backend.applyInPlaceRename()
            }
        }
    }
}
