// SY_Sequence_1.0.jsx
// ===========================================================
// █▀▀░█░█░░░░░█▀▀░█▀▀░▄▀▄░█░█░█▀▀░█▀█░█▀▀░█▀▀
// ▀▀█░░█░░░░░░▀▀█░█▀▀░█\█░█░█░█▀▀░█░█░█░░░█▀▀
// ▀▀▀░░▀░░▀▀▀░▀▀▀░▀▀▀░░▀\░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀▀▀
// made with love by Zain Aldin aka Sphiment <3
// ===========================================================

(function(thisObj) {

function SY_Sequence(overlapValue, randomOrder) {	app.beginUndoGroup("SY_Sequence");
	var overlap = overlapValue / 100 || 0; // Convert from percentage to decimal

	var comp = app.project.activeItem;
	if (!comp || !(comp instanceof CompItem)) {
		return;
	}
	var selectedLayers = comp.selectedLayers;
	if (selectedLayers.length < 2) {
		return;
	}
	// Store layers in their original selection order
	var layersArray = [];
	for (var i = 0; i < selectedLayers.length; i++) {
		layersArray.push(selectedLayers[i]);
	}

    if (randomOrder) {
		for (var i = layersArray.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var temp = layersArray[i];
			layersArray[i] = layersArray[j];
			layersArray[j] = temp;
		}
	}

	// Find the earliest start and latest end time boundaries
	var earliestStart = Number.MAX_VALUE;
	var latestEnd = Number.MIN_VALUE;
	for (var j = 0; j < layersArray.length; j++) {
		var layer = layersArray[j];
		var startTime = layer.startTime;
		var endTime = layer.startTime + (layer.outPoint - layer.inPoint);
		
		if (startTime < earliestStart) {
			earliestStart = startTime;
		}
		if (endTime > latestEnd) {
			latestEnd = endTime;
		}
	}
	// Calculate total available time span
	var totalTimeSpan = latestEnd - earliestStart;

	var numLayers = layersArray.length;
	// Calculate the layer duration to fit the time span perfectly with overlap
	var denominator = 1 + (numLayers - 1) * (1 - overlap);
	var layerDuration = totalTimeSpan / denominator;
	
	// If overlap is 1 (100%), all layers should have the full duration
	if (overlap >= 1) {
		layerDuration = totalTimeSpan;
	}

	// Place layers with calculated durations and overlap
	var currentTime = earliestStart;
	for (var k = 0; k < layersArray.length; k++) {
		var layer = layersArray[k];
		
		// Set new start time
		layer.startTime = currentTime;
		
		// Set new duration
		var originalInPoint = layer.inPoint;
		layer.outPoint = originalInPoint + layerDuration;
		
		// Calculate next layer start time with overlap
		if (k < layersArray.length - 1) {
			var overlapTime = layerDuration * overlap;
			currentTime = currentTime + layerDuration - overlapTime;
		}
	}

	app.endUndoGroup();
	if (app.activeViewer && app.activeViewer.type === ViewerType.VIEWER_COMPOSITION) {
		app.activeViewer.setActive();
	}
}

function buildUI(thisObj) {
	var panel = (thisObj instanceof Panel)
		? thisObj
		: new Window("palette", "SY_Sequence.jsx", undefined, { resizable: true });

	if (panel) {
		panel.orientation = "column";
		panel.alignChildren = ["center", "top"];
		panel.spacing = 5;
		panel.margins = 5;

		var group1 = panel.add("group", undefined, { name: "group1" });
		group1.orientation = "row";
		group1.alignChildren = ["center", "center"];
		group1.alignment = ["fill", "top"];
        
		group1.add("statictext", undefined, "Overlap");
		var overlapSlider = group1.add("slider", undefined, 0, 0, 100);
		overlapSlider.preferredSize.width = 150;
		var overlapValueText = group1.add("edittext", undefined, "0");
		overlapValueText.characters = 4;

		var randomCheckbox = group1.add("checkbox", undefined, "Random Order");
		randomCheckbox.value = false;

		overlapSlider.onChanging = function () {
			overlapValueText.text = Math.round(this.value).toString();
		};
		overlapValueText.onChange = function () {
			var val = parseInt(this.text);
			if (!isNaN(val) && val >= 0 && val <= 100) {
				overlapSlider.value = val;
			} else {
				this.text = Math.round(overlapSlider.value).toString();
			}
		};

		var group2 = panel.add("group", undefined, { name: "group2" });
		group2.orientation = "row";
		group2.alignChildren = ["center", "center"];
		group2.alignment = ["fill", "top"];

		var sequenceBtn = group2.add("button", undefined, "Sequence!");
		sequenceBtn.onClick = function () {
			var overlapValue = overlapSlider.value;
			var randomOrder = randomCheckbox.value;
			SY_Sequence(overlapValue, randomOrder);
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