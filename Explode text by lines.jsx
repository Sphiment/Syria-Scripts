(function explodeTextByLine() {
    app.beginUndoGroup("Explode Text By Lines");

    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        app.endUndoGroup();
        return;
    }

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) {
        app.endUndoGroup();
        return;
    }

    var originalLayer = selectedLayers[0];
    var sourceTextProp = originalLayer.property("Source Text");
    if (!sourceTextProp || !(sourceTextProp.value instanceof TextDocument)) {
        app.endUndoGroup();
        return;
    }

    // Split text by lines
    var originalText = sourceTextProp.value.text;
    var lines = originalText.split(/[\r\n]+/);

    // Get original text properties
    var originalDoc = sourceTextProp.value;
    var leading = originalDoc.leading > 0 ? originalDoc.leading : originalDoc.fontSize * 1.2;

    // Adjust leading based on scale
    var scaleFactor = originalLayer.transform.scale.value[1] / 100;
    leading *= scaleFactor;

    // Helper function to clear keyframes from properties
    function clearKeyframes(property) {
        if (property.numKeys > 0) {
            while (property.numKeys > 0) {
                property.removeKey(1);
            }
        }
    }

    // Duplicate layers for each line of text
    for (var i = 0; i < lines.length; i++) {
        var newLayer = originalLayer.duplicate();

        // Update the text for the new layer
        var newDoc = newLayer.property("Source Text").value;
        newDoc.text = lines[i];
        newLayer.property("Source Text").setValue(newDoc);

        // Adjust position for the new layer
        var position = originalLayer.transform.position.value;
        position[1] += i * leading;
		
		newLayer.position.dimensionsSeparated = false;
        clearKeyframes(newLayer.transform.position);
        newLayer.transform.position.setValue(position);
		newLayer.position.dimensionsSeparated = true;
    }
	
    // Hide the original layer
    originalLayer.enabled = false;

    app.endUndoGroup();
})();