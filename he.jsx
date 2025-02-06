function splitTextByWords() {
    app.beginUndoGroup("Split Text By Words (Restore Original Alignment)");

    var comp = app.project.activeItem;
    var selectedLayers = comp.selectedLayers;
    var currentTime = comp.time;

    // --- Pre-process: If a text layer is multi-line, split it into separate single-line layers ---
    var layersToProcess = [];
    for (var i = 0; i < selectedLayers.length; i++) {
        var origLayer = selectedLayers[i];
        var origSourceText = origLayer.property("Source Text");
        if (!origSourceText) continue;
        var origTextDoc = origSourceText.value;
        // Check for newline characters
            var lines = origTextDoc.text.split(/\r\n|\r|\n/);
            // Determine effective leading:
            // If a positive leading is set, use it; otherwise assume auto leading ~ fontSize * 1.2
            var effectiveLeading = (origTextDoc.leading > 0) ? origTextDoc.leading : origTextDoc.fontSize * 1.2;
            var origPosition = origLayer.transform.position.value;
            for (var l = 0; l < lines.length; l++) {
                var lineLayer = origLayer.duplicate();
                updateLayerText(lineLayer, lines[l], origTextDoc.justification);
                // Adjust vertical position so that the block remains centered
                var pos = lineLayer.transform.position.value;
				var scaleFactor = origLayer.transform.scale.value[1] / 100;
				var origRotation = origLayer.transform.rotation.value;
				var rotationRad = origRotation * Math.PI / 180;
				var adjustedLeading = effectiveLeading * scaleFactor;
				
                pos[0] = origPosition[0] + (l * adjustedLeading * Math.sin(rotationRad) * -1);
                pos[1] = origPosition[1] + (l * adjustedLeading * Math.cos(rotationRad));
				var wasSeparated = origLayer.property("Position").dimensionsSeparated;
				if (wasSeparated) {
					lineLayer.property("Position").dimensionsSeparated = false;
					lineLayer.property("Position").addKey(comp.time)
				}
                lineLayer.transform.position.setValueAtTime(comp.time, pos);
                layersToProcess.push(lineLayer);
            }
			origLayer.enabled = false;
    }

    // --- Process each (now single-line) layer with the original word-splitting code ---
    for (var i = 0; i < layersToProcess.length; i++) {
        var origLayer = layersToProcess[i];
        var origSourceText = origLayer.property("Source Text");
        if (!origSourceText) continue;
		
        // --- 1. Store the original transform values ---
        var origPosition = origLayer.transform.position.value;
        var origScale    = origLayer.transform.scale.value;
        var origRotation = origLayer.transform.rotation.value;
        var origAnchor	 = origLayer.transform.anchorPoint.value;
		
        // --- 2. Create a temporary work layer (duplicate) ---
        var tempLayer = origLayer.duplicate();
		tempLayer.enabled = false;
        // Remove any position keyframes from the temp layer so math is not affected
        var posProp = tempLayer.transform.position;
        while (posProp.numKeys > 0) {
            posProp.removeKey(1);
        }
        tempLayer.transform.position.setValue(origPosition);
		
        var rotProp = tempLayer.transform.rotation;
        while (rotProp.numKeys > 0) {
            rotProp.removeKey(1);
        }
        tempLayer.transform.rotation.setValue(0);

        var scaProp = tempLayer.transform.scale;
        while (scaProp.numKeys > 0) {
            scaProp.removeKey(1);
        }
        tempLayer.transform.scale.setValue([100, 100]);
		
        var ancProp = tempLayer.transform.anchorPoint;
        while (ancProp.numKeys > 0) {
            ancProp.removeKey(1);
        }
        tempLayer.transform.anchorPoint.setValue(origAnchor);
		
        // --- 3. Get text info and prepare to split ---
        var sourceTextProp = tempLayer.property("Source Text");
        var origTextDoc = sourceTextProp.value;
        var fullText = origTextDoc.text;
        var origJustification = origTextDoc.justification;
		
	
		
        // Build an array of words (non-whitespace sequences) along with their starting indices.
        var wordMatches = [];
        var regex = /\S+/g;
        var m;
        while ((m = regex.exec(fullText)) !== null) {
            wordMatches.push({ word: m[0], index: m.index });
        }

        // Calculate the original left/right absolute positions from the temp layer.
        var tempPos = tempLayer.property("Position").value;
        var tempRect = tempLayer.sourceRectAtTime(currentTime, false);
        var tempLeftAbs = tempPos[0] + tempRect.left;
        var tempRightAbs = tempPos[0] + tempRect.left + tempRect.width;
		
        // Prepare an array to store the word layers (so we can later reapply the original transform)
        var wordLayers = [];

        // --- 4. Loop over each found word to create separate layers ---
        for (var w = 0; w < wordMatches.length; w++) {
            var match = wordMatches[w];
            // Use substring so that the left/right strings preserve extra spacing.
			// Check the match text itself for RTL characters.
			// This regex covers a range of RTL Unicode characters (adjust as needed).
			var rtlRegex = /[\u0590-\u08FF]/;
			var textDirection = rtlRegex.test(match.word) ? "1" : "0";  // "1" for RTL, "0" for LTR

					
			if (textDirection == "0") {
				var leftString = fullText.substring(0, match.index + match.word.length);
				var rightString = fullText.substring(match.index);
				
			} else if (textDirection == "1") {
				var leftString = fullText.substring(match.index);
				var rightString = fullText.substring(0, match.index + match.word.length);
			}

            // Duplicate the temp layer to use for left/right positioning.
            var leftLayer = tempLayer.duplicate();
            var rightLayer = tempLayer.duplicate();

            updateLayerText(leftLayer, leftString);
            alignLeftPreserve(leftLayer, tempLeftAbs, currentTime);
			
            updateLayerText(rightLayer, rightString);
            alignRightPreserve(rightLayer, tempRightAbs, currentTime);

            var leftRectNew = leftLayer.sourceRectAtTime(currentTime, false);
            var leftLayerPos = leftLayer.property("Position").value;
            var wordRight = leftLayerPos[0] + leftRectNew.left + leftRectNew.width;

            var rightRectNew = rightLayer.sourceRectAtTime(currentTime, false);
            var rightLayerPos = rightLayer.property("Position").value;
            var wordLeft = rightLayerPos[0] + rightRectNew.left;

            // Create the actual word layer
            var wordLayer = tempLayer.duplicate();
            updateLayerText(wordLayer, match.word, origJustification);
            wordLayer.name = match.word; // Name the layer after the word

            var wordRect = wordLayer.sourceRectAtTime(currentTime, false);
            var currentPos = wordLayer.property("Position").value;
            var newPosX;
            if (origJustification === ParagraphJustification.LEFT_JUSTIFY) {
                newPosX = wordLeft - wordRect.left;
            } else if (origJustification === ParagraphJustification.RIGHT_JUSTIFY) {
                newPosX = wordRight - wordRect.left - wordRect.width;
            } else if (origJustification === ParagraphJustification.CENTER_JUSTIFY) {
                newPosX = ((wordLeft + wordRight) / 2) - (wordRect.left + wordRect.width / 2);
            } else {
                newPosX = wordLeft - wordRect.left;
            }
            wordLayer.property("Position").setValue([newPosX, currentPos[1]]);

            centerAnchor(wordLayer, currentTime);

            // Restore dimension-separation state if necessary
            if (wasSeparated) {
                wordLayer.property("Position").dimensionsSeparated = true;
            }

            // Save the newly created word layer for later transformation.
            wordLayers.push(wordLayer);

            // Remove the helper left/right layers
            leftLayer.remove();
            rightLayer.remove();
        }

        // Hide the original layer and remove the temp layer.
		origLayer.remove();
        tempLayer.remove();

        // Create a temp text and set its transform to the original values.
        var tempText = comp.layers.addText();
        tempText.transform.position.setValue(origPosition);
		
        // Parent each word layer to the temp text.
        for (var j = 0; j < wordLayers.length; j++) {
            wordLayers[j].parent = tempText;
        }
        tempText.transform.scale.setValue(origScale);
        tempText.transform.rotation.setValue(origRotation);
        tempText.remove();
		for (var j = 0; j < wordLayers.length; j++) {
            wordLayers[j].enabled = true;
        }
    }

    app.endUndoGroup();
    if (app.activeViewer && app.activeViewer.type === ViewerType.VIEWER_COMPOSITION) {
        app.activeViewer.setActive();
    }
}


// -------------------
// Helper functions
// -------------------

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


// -------------------
// Run the script
// -------------------
splitTextByWords();