(function(thisObj) {

function SY_TextSplitter(mode) {
app.beginUndoGroup("SY_TextSplitter");
var splitMode = mode;

var comp = app.project.activeItem;
if (!comp || !(comp instanceof CompItem)) {
	return;
}
var selectedLayers = comp.selectedLayers;
var currentTime = comp.time;

var layersToProcess = [];
for (var i = 0; i < selectedLayers.length; i++) {
	var origLayer = selectedLayers[i];
	var wasSeparated = origLayer.property("Position").dimensionsSeparated;
	var origSourceText = origLayer.property("Source Text");
	if (!origSourceText) continue;
	var origTextDoc = origSourceText.value;
	var lines = origTextDoc.text.split(/\r\n|\r|\n/);
	var effectiveLeading = (origTextDoc.leading > 0) ? origTextDoc.leading : origTextDoc.fontSize * 1.2;
	var origPosition = origLayer.transform.position.value;
	var scaleY = origLayer.transform.scale.value[1];
	var origRotation = origLayer.transform.rotation.value;
	var rotationRad = origRotation * Math.PI / 180;
	var scaleFactor = scaleY / 100;
	var adjustedLeading = effectiveLeading * scaleFactor;

	for (var l = 0; l < lines.length; l++) {
		var lineLayer = origLayer.duplicate();
		updateLayerText(lineLayer, lines[l], origTextDoc.justification);
		var pos = lineLayer.transform.position.value;
		pos[0] = origPosition[0] - (l * adjustedLeading * Math.sin(rotationRad));
		pos[1] = origPosition[1] + (l * adjustedLeading * Math.cos(rotationRad));

		if (wasSeparated) {
			lineLayer.property("Position").dimensionsSeparated = false;
		}
		removeAllKeys(lineLayer.transform.position);
		lineLayer.transform.position.setValue(pos);
		lineLayer.myWasSeparated = wasSeparated;
		layersToProcess.push(lineLayer);
	}
	origLayer.enabled = false;
}

for (var i = 0; i < layersToProcess.length; i++) {
	var origLayer = layersToProcess[i];
	var wasSeparated = origLayer.myWasSeparated;
	var origScale    = origLayer.transform.scale.value;
	var origRotation = origLayer.transform.rotation.value;
	var origAnchor   = origLayer.transform.anchorPoint.value;
	var origSourceText = origLayer.property("Source Text");
	var origPosition = origLayer.transform.position.value;
	var tempLayer = origLayer.duplicate();
	removeAllKeys(tempLayer.transform.position);
	tempLayer.transform.position.setValue(origPosition);
	removeAllKeys(tempLayer.transform.rotation);
	tempLayer.transform.rotation.setValue(0);
	removeAllKeys(tempLayer.transform.scale);
	tempLayer.transform.scale.setValue([100, 100]);
	removeAllKeys(tempLayer.transform.anchorPoint);
	tempLayer.transform.anchorPoint.setValue(origAnchor);
		
	var tempPos = tempLayer.property("Position").value;
	var tempRect = tempLayer.sourceRectAtTime(currentTime, false);
	var tempLeftAbs = tempPos[0] + tempRect.left;
	var tempRightAbs = tempPos[0] + tempRect.left + tempRect.width;
	var tempText = comp.layers.addText();
	tempText.transform.position.setValue(origPosition);
		
	var origTextDoc = tempLayer.property("Source Text").value;
	var fullText = origTextDoc.text;
	var origJustification = origTextDoc.justification;
		
	var matches = [];
	if (splitMode === 2) {
		var regex = /\S+/g, m;
		while ((m = regex.exec(fullText)) !== null) {
			matches.push({ text: m[0], index: m.index });
		}
	} else if (splitMode === 3) {
		for (var c = 0; c < fullText.length; c++) {
			var ch = fullText.charAt(c);
			if (/\S/.test(ch)) {
				matches.push({ text: ch, index: c });
			}
		}
	}
		
	var leftHelper = tempLayer.duplicate();
	leftHelper.enabled = false;
	var rightHelper = tempLayer.duplicate();
	rightHelper.enabled = false;
		
	var rtlRegex = /[\u0600-\u08FF]/;
	var splitLayers = [];
	var j = 0;
	if (splitMode === 1) {
		tempLayer.name = fullText;
		centerAnchor(tempLayer, currentTime);
		if (wasSeparated) {
			tempLayer.property("Position").dimensionsSeparated = true;
		}
		tempLayer.parent = tempText;
		tempLayer.selected = false;
	} else if (splitMode === 2 || splitMode === 3) {
		while (j < matches.length) {
			var match = matches[j];
			var isRTL = rtlRegex.test(match.text);
			var leftString, rightString, displayText;
			if (!isRTL) {
				if (splitMode === 2) {
					leftString = fullText.substring(0, match.index + match.text.length);
					rightString = fullText.substring(match.index);
					displayText = match.text;
				} else { 
					leftString = fullText.substring(0, match.index + 1);
					rightString = fullText.substring(match.index);
					displayText = match.text;
				}
				updateLayerText(leftHelper, leftString);
				alignLeftPreserve(leftHelper, tempLeftAbs, currentTime);
				updateLayerText(rightHelper, rightString);
				alignRightPreserve(rightHelper, tempRightAbs, currentTime);
				
				var rightRectNew = rightHelper.sourceRectAtTime(currentTime, false);
				var rightHelperPos = rightHelper.property("Position").value;
				var newLeft = rightHelperPos[0] + rightRectNew.left;
				
				var splitLayer = tempLayer.duplicate();
				updateLayerText(splitLayer, displayText, origJustification);
				splitLayer.name = displayText;
				
				var splitRect = splitLayer.sourceRectAtTime(currentTime, false);
				var currentPos = splitLayer.property("Position").value;
				var newPosX = newLeft - splitRect.left;
				splitLayer.property("Position").setValue([newPosX, currentPos[1]]);
				
				centerAnchor(splitLayer, currentTime);
				if (wasSeparated) {
					splitLayer.property("Position").dimensionsSeparated = true;
				}
				splitLayers.push(splitLayer);
				splitLayer.parent = tempText;
				splitLayer.selected = false;
			} else {
				var blockStart = match.index;
				var blockEnd = match.index + match.text.length;
				displayText = fullText.substring(blockStart, blockEnd);
				while (j + 1 < matches.length && rtlRegex.test(matches[j + 1].text)) {
					j++;
					var nextMatch = matches[j];
					blockEnd = nextMatch.index + nextMatch.text.length;
					displayText = fullText.substring(blockStart, blockEnd);
				}
				while (blockEnd < fullText.length && /\s/.test(fullText.charAt(blockEnd))) {
					blockEnd++;
				}
				leftString = fullText.substring(0, blockEnd);
				rightString = fullText.substring(blockStart);
				
				updateLayerText(leftHelper, leftString);
				alignLeftPreserve(leftHelper, tempLeftAbs, currentTime);
				updateLayerText(rightHelper, rightString);
				alignRightPreserve(rightHelper, tempRightAbs, currentTime);
				
				var rightRectNew = rightHelper.sourceRectAtTime(currentTime, false);
				var rightHelperPos = rightHelper.property("Position").value;
				var newLeft = rightHelperPos[0] + rightRectNew.left;
				
				var splitLayer = tempLayer.duplicate();
				updateLayerText(splitLayer, displayText, origJustification);
				splitLayer.name = displayText;
				
				var splitRect = splitLayer.sourceRectAtTime(currentTime, false);
				var currentPos = splitLayer.property("Position").value;
				var newPosX = newLeft - splitRect.left;
				splitLayer.property("Position").setValue([newPosX, currentPos[1]]);
				
				var swordLayer = splitLayer; 
				var stempLayer = swordLayer.duplicate();
				var stempPos = stempLayer.property("Position").value;
				var stempRect = stempLayer.sourceRectAtTime(currentTime, false);
				var stempLeftAbs = stempPos[0] + stempRect.left;
				var stempRightAbs = stempPos[0] + stempRect.left + stempRect.width;
				
				var ssourceTextProp = swordLayer.property("Source Text");
				var sorigTextDoc = ssourceTextProp.value;
				var sfullText = sorigTextDoc.text;
				var sRegex = /\S+/g, sMatch;
				var swordMatches = [];
				while ((sMatch = sRegex.exec(sfullText)) !== null) {
					swordMatches.push({ word: sMatch[0], index: sMatch.index });
				}
				
				var sLeftHelper = stempLayer.duplicate();
				sLeftHelper.enabled = false;
				var sRightHelper = stempLayer.duplicate();
				sRightHelper.enabled = false;
				
				var s = 0;
				while (s < swordMatches.length) {
					var sMatchObj = swordMatches[s];
					var sLeftString = sfullText.substring(sMatchObj.index);
					var sRightString = sfullText.substring(0, sMatchObj.index + sMatchObj.word.length);
					
					updateLayerText(sLeftHelper, sLeftString);
					alignLeftPreserve(sLeftHelper, stempLeftAbs, currentTime);
					
					updateLayerText(sRightHelper, sRightString);
					alignRightPreserve(sRightHelper, stempRightAbs, currentTime);
					
					var sRightRectNew = sRightHelper.sourceRectAtTime(currentTime, false);
					var sRightHelperPos = sRightHelper.property("Position").value;
					var sWordLeft = sRightHelperPos[0] + sRightRectNew.left;
					
					var sWordLayer = stempLayer.duplicate();
					updateLayerText(sWordLayer, sMatchObj.word, origJustification);
					sWordLayer.name = sMatchObj.word;
					
					var sWordRect = sWordLayer.sourceRectAtTime(currentTime, false);
					var sCurrentPos = sWordLayer.property("Position").value;
					var sNewPosX = sWordLeft - sWordRect.left;
					sWordLayer.property("Position").setValue([sNewPosX, sCurrentPos[1]]);
					
					centerAnchor(sWordLayer, currentTime);
					if (wasSeparated) {
						sWordLayer.property("Position").dimensionsSeparated = true;
					}
					splitLayers.push(sWordLayer);
					sWordLayer.parent = tempText;
					sWordLayer.selected = false;
					s++;
				}
				swordLayer.remove();
				stempLayer.remove();
				sLeftHelper.remove();
				sRightHelper.remove();
			}
			j++;
		}
		tempLayer.remove();
	}
	tempText.transform.scale.setValue(origScale);
	tempText.transform.rotation.setValue(origRotation);
	tempText.remove();
	origLayer.remove();
	leftHelper.remove();
	rightHelper.remove();
}

if (app.activeViewer && app.activeViewer.type === ViewerType.VIEWER_COMPOSITION) {
	app.activeViewer.setActive();
}
app.endUndoGroup();
}

function removeAllKeys(prop) {
while (prop.numKeys > 0) {
	prop.removeKey(1);
}
}

function updateLayerText(layer, text, justification) {
var sourceTextProp = layer.property("Source Text");
var textDoc = sourceTextProp.value;
textDoc.text = text;
if (justification !== undefined) {
	textDoc.justification = justification;
}
sourceTextProp.setValue(textDoc);
}

function alignLeftPreserve(layer, origLeftAbs, time) {
var sourceTextProp = layer.property("Source Text");
var textDoc = sourceTextProp.value;
textDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
sourceTextProp.setValue(textDoc);

var rect = layer.sourceRectAtTime(time, false);
var pos = layer.property("Position").value;
var newPosX = origLeftAbs - rect.left;
layer.property("Position").setValue([newPosX, pos[1]]);
}

function alignRightPreserve(layer, origRightAbs, time) {
var sourceTextProp = layer.property("Source Text");
var textDoc = sourceTextProp.value;
textDoc.justification = ParagraphJustification.RIGHT_JUSTIFY;
sourceTextProp.setValue(textDoc);

var rect = layer.sourceRectAtTime(time, false);
var pos = layer.property("Position").value;
var newPosX = origRightAbs - rect.left - rect.width;
layer.property("Position").setValue([newPosX, pos[1]]);
}

function centerAnchor(layer, time) {
var rect = layer.sourceRectAtTime(time, false);
var newAnchor = [rect.left + rect.width / 2, rect.top + rect.height / 2];
var oldAnchor = layer.anchorPoint.value;
var delta = [newAnchor[0] - oldAnchor[0], newAnchor[1] - oldAnchor[1]];
layer.anchorPoint.setValue(newAnchor);

var pos = layer.property("Position").value;
layer.property("Position").setValue([pos[0] + delta[0], pos[1] + delta[1]]);
}


 function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "SY_TextSplitter-v1.jsx", undefined, { resizable: true });

        if (panel) {
            panel.orientation = "column";
            panel.alignChildren = ["center", "top"];
            panel.spacing = 5;
            panel.margins = 5;

            var group1 = panel.add("group", undefined, { name: "group1" });
            group1.orientation = "row";
            group1.alignChildren = ["center", "center"];
            // group1.spacing = 5;
            // group1.margins = 5;
            group1.alignment = ["fill", "top"];

            var group2 = panel.add("group", undefined, { name: "group2" });
            group2.orientation = "row";
            group2.alignChildren = ["center", "center"];
            // group2.spacing = 5;
            // group2.margins = 5;
            group2.alignment = ["fill", "top"];

            var button1 = group1.add("button", undefined, "Split!");
            var dropDown1 = group2.add("dropdownlist", undefined, ["Lines", "Words", "Characters"]);
            dropDown1.selection = 0;

            button1.onClick = function () {
                var mode = dropDown1.selection.index + 1;
                SY_TextSplitter(mode);
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