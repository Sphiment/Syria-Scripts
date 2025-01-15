(function splitTextByLine() {
    app.beginUndoGroup("Split Text By Line");

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

    for (var s = 0; s < selectedLayers.length; s++) {
        var originalLayer = selectedLayers[s];
        var sourceTextProp = originalLayer.property("Source Text");
        
        if (!sourceTextProp || !(sourceTextProp.value instanceof TextDocument)) {
            continue;
        }

        var originalDoc = sourceTextProp.value;
        var originalText = originalDoc.text;
        var lines = originalText.split(/[\r\n]+/);

        var leading = originalDoc.leading > 0 ? originalDoc.leading : originalDoc.fontSize * 1.2;
		
        var scaleFactor = originalLayer.transform.scale.value[1] / 100;
        var adjustedLeading = leading * scaleFactor;

        for (var i = 0; i < lines.length; i++) {
            var newLayer = originalLayer.duplicate();
            var newDoc = newLayer.property("Source Text").value;
            newDoc.text = lines[i];
            newLayer.property("Source Text").setValue(newDoc);

            var wasSeparated = newLayer.transform.position.dimensionsSeparated;
            if (wasSeparated) {
                newLayer.transform.position.dimensionsSeparated = false;
            }

            var posProp = newLayer.transform.position;
            while (posProp.numKeys > 0) {
                posProp.removeKey(1);
            }

            var basePos = originalLayer.transform.position.value;
            basePos[1] += i * adjustedLeading;
            newLayer.transform.position.setValue(basePos);

            if (wasSeparated) {
                newLayer.transform.position.dimensionsSeparated = true;
            }

            newLayer.parent = originalLayer;
        }

        originalLayer.enabled = false;
    }

    app.endUndoGroup();
    app.activeViewer && app.activeViewer.setActive();
})();
