// SY_Highlight_1.0.jsx
// ===========================================================
// █▀▀░█░█░░░░░█░█░▀█▀░█▀▀░█░█░█░░░▀█▀░█▀▀░█░█░▀█▀
// ▀▀█░░█░░░░░░█▀█░░█░░█░█░█▀█░█░░░░█░░█░█░█▀█░░█
// ▀▀▀░░▀░░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░░▀
// made with love by Zain Aldin aka Sphiment <3
// ===========================================================

(function (thisObj) {

function SY_Highlight(animRate, overlap) {
	app.beginUndoGroup("SY_Highlight");

	var comp = app.project.activeItem;
	if (!(comp && comp instanceof CompItem)) {
		return;
	}
	var selectedLayers = comp.selectedLayers;
	if (selectedLayers.length < 1) {
		return;
	}

	// RTL detection
	var rtlRegex = /[\u0600-\u08FF]/;

	for (var t = 0; t < selectedLayers.length; t++) {
		var origTextLayer = selectedLayers[t];
		if (!origTextLayer.property("Source Text")) continue;

		var dupTextLayer = origTextLayer.duplicate();
		dupTextLayer.name = origTextLayer.name + " (Temp Measurement)";
		dupTextLayer.enabled = false;

		var origTextProp = origTextLayer.property("Source Text");
		var origDoc = origTextProp.value;
		var origText = origDoc.text;
		var lines = origText.split(/\r\n|\r|\n/);
		var numLines = lines.length;
		var fontSize = origDoc.fontSize;
		var leading = origDoc.leading;
		var xHeight = fontSize / 2;

		var shapeLayer = comp.layers.addShape();
		var layerPos = origTextLayer.transform.position.value;
		shapeLayer.transform.position.setValue(layerPos);
		var layerAnchor = origTextLayer.transform.anchorPoint.value;

		// Convert text-layer local point to shape-layer space
		function textLocalToShape(localPt) {
			var compPt = [
				layerPos[0] + (localPt[0] - layerAnchor[0]),
				layerPos[1] + (localPt[1] - layerAnchor[1])
			];
			var shapePos = shapeLayer.transform.position.value;
			return [compPt[0] - shapePos[0], compPt[1] - shapePos[1]];
		}

		var currentTime = comp.time;
		var offsetTime = origTextLayer.inPoint;

		// Process each text line
		for (var i = 0; i < numLines; i++) {
			var lineText = lines[i];

			var tempDoc = new TextDocument(origDoc.text);
			tempDoc.text = lineText;
			dupTextLayer.property("Source Text").setValue(tempDoc);

			var rLine = dupTextLayer.sourceRectAtTime(currentTime, false);
			var strokeWidth = Math.abs(rLine.top);

			var topLeft = [rLine.left, -xHeight + i * leading];
			var boxHeight = xHeight;
			var extraOffset = (strokeWidth - xHeight) / 2;
			var centerY = topLeft[1] + boxHeight / 2 - extraOffset;

			// Determine endpoints in text-layer local coordinates
			var leftLocal = [topLeft[0], centerY];
			var rightLocal = [topLeft[0] + rLine.width, centerY];

			// Convert endpoints to shape-layer space
			var shapeLeft = textLocalToShape(leftLocal);
			var shapeRight = textLocalToShape(rightLocal);

			// RTL check
			var isRTL = rtlRegex.test(lineText);
			var vertices = isRTL ? [shapeRight, shapeLeft] : [shapeLeft, shapeRight];

			var groupName = "Line " + (i + 1);
			var shapeGroup = shapeLayer.property("ADBE Root Vectors Group")
				.addProperty("ADBE Vector Group");
			shapeGroup.name = groupName;

			var pathGroup = shapeGroup.property("ADBE Vectors Group")
				.addProperty("ADBE Vector Shape - Group");
			var myShape = new Shape();
			myShape.vertices = vertices;
			myShape.inTangents = [[0, 0], [0, 0]];
			myShape.outTangents = [[0, 0], [0, 0]];
			myShape.closed = false;
			pathGroup.property("ADBE Vector Shape").setValue(myShape);

			var strokeProp = shapeGroup.property("ADBE Vectors Group")
				.addProperty("ADBE Vector Graphic - Stroke");
			strokeProp.property("ADBE Vector Stroke Width").setValue(strokeWidth);
			strokeProp.property("ADBE Vector Stroke Color").setValue([1, 0.8, 0]);

			var nonSpaceCount = lineText.replace(/\s/g, "").length;
			var totalFrames = Math.round(comp.frameRate / 10 * nonSpaceCount);
			var dur = totalFrames / comp.frameRate;

			var trimPath = shapeGroup.property("ADBE Vectors Group")
				.addProperty("ADBE Vector Filter - Trim");
			var trimEndProp = trimPath.property("ADBE Vector Trim End");
			var ease = new KeyframeEase(0, 100);

			if (animRate === 0) {
				trimEndProp.setValueAtTime(offsetTime, 100);
			} else {
				var effectiveDur = dur * animRate;
				trimEndProp.setValueAtTime(offsetTime, 0);
				trimEndProp.setValueAtTime(offsetTime + effectiveDur, 100);
				trimEndProp.setTemporalEaseAtKey(2, [ease], [ease]);
				offsetTime += effectiveDur * overlap;
			}
		}

		var tempText = comp.layers.addText();
		tempText.name = origTextLayer.name + " Temp Text";
		tempText.transform.position.setValue(layerPos);
		shapeLayer.parent = tempText;
		tempText.transform.scale.setValue(origTextLayer.transform.scale.value);
		tempText.transform.rotation.setValue(origTextLayer.transform.rotation.value);
		shapeLayer.parent = null;
		shapeLayer.inPoint = origTextLayer.inPoint;
		shapeLayer.outPoint = origTextLayer.outPoint;
		tempText.remove();

		dupTextLayer.remove();
		shapeLayer.moveAfter(origTextLayer);
		shapeLayer.parent = origTextLayer;
		
		if (app.activeViewer && app.activeViewer.type === ViewerType.VIEWER_COMPOSITION) {
			app.activeViewer.setActive();
		}
	}
	app.endUndoGroup();
}

function buildUI(thisObj) {
	var panel = (thisObj instanceof Panel)
		? thisObj
		: new Window("palette", "SY_Highlight.jsx", undefined, { resizable: true });

	if (panel) {
		panel.orientation = "column";
		panel.alignChildren = ["center", "top"];
		panel.spacing = 5;
		panel.margins = 5;

		var group1 = panel.add("group", undefined, { name: "group1" });
		group1.orientation = "row";
		group1.alignChildren = ["center", "center"];
		group1.alignment = ["fill", "top"];

		group1.add("statictext", undefined, "Animation");
		var animSlider = group1.add("slider", undefined, 1, 0, 2);
		animSlider.preferredSize.width = 150;
		var animValueText = group1.add("edittext", undefined, "1.00");
		animValueText.characters = 4;

		animSlider.onChanging = function () {
			animValueText.text = animSlider.value.toFixed(2);
		};
		animValueText.onChange = function () {
			var val = parseFloat(animValueText.text);
			if (isNaN(val)) { val = 1; }
			if (val < 0) { val = 0; }
			if (val > 2) { val = 2; }
			animSlider.value = val;
			animValueText.text = val.toFixed(2);
		};

		var group2 = panel.add("group", undefined, { name: "group2" });
		group2.orientation = "row";
		group2.alignChildren = ["center", "center"];
		group2.alignment = ["fill", "top"];

		group2.add("statictext", undefined, "Overlap");
		var overlapSlider = group2.add("slider", undefined, 1, 0, 2);
		overlapSlider.preferredSize.width = 161;
		var overlapValueText = group2.add("edittext", undefined, "1.00");
		overlapValueText.characters = 4;

		overlapSlider.onChanging = function () {
			overlapValueText.text = overlapSlider.value.toFixed(2);
		};
		overlapValueText.onChange = function () {
			var val = parseFloat(overlapValueText.text);
			if (isNaN(val)) { val = 1; }
			if (val < 0) { val = 0; }
			if (val > 2) { val = 2; }
			overlapSlider.value = val;
			overlapValueText.text = val.toFixed(2);
		};

		var group3 = panel.add("group", undefined, { name: "group3" });
		group3.orientation = "row";
		group3.alignChildren = ["center", "center"];
		group3.alignment = ["fill", "top"];

		var createBtn = group3.add("button", undefined, "Highlight!");
		createBtn.onClick = function () {
			SY_Highlight(animSlider.value, overlapSlider.value);
		};

		panel.onResizing = panel.onResize = function () {
			this.layout.resize();
		};
		panel.layout.layout(true);
	}
	return panel;
}

var myPanel = buildUI(thisObj);
if (myPanel instanceof Window) {
	myPanel.center();
	myPanel.show();
}

})(this);
