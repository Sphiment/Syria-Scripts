(function splitTextByWords() {
    app.beginUndoGroup("Split Text By Words");

    var comp = app.project.activeItem;
    if (!(comp && comp instanceof CompItem)) {
        app.endUndoGroup();
        return;
    }

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) {
        app.endUndoGroup();
        return;
    }

    var tokenRegex = /(\S+|\s+)/g;

    for (var i = 0; i < selectedLayers.length; i++) {
        var originalLayer = selectedLayers[i];
        var sourceTextProp = originalLayer.property("Source Text");

        if (!(sourceTextProp && sourceTextProp.value instanceof TextDocument)) {
            continue;
        }

        var originalDoc = sourceTextProp.value;
        var originalText = originalDoc.text;
        var tokens = originalText.match(tokenRegex);

        if (!tokens || tokens.length === 0) {
            continue;
        }

        var wordIndices = [];
        for (var t = 0; t < tokens.length; t++) {
            if (/\S/.test(tokens[t])) {
                wordIndices.push(t);
            }
        }

        if (wordIndices.length === 0) {
            continue;
        }

        for (var w = 0; w < wordIndices.length; w++) {
            var currentWordIndex = wordIndices[w];

            var newLayer = originalLayer.duplicate();
            var newDoc = newLayer.property("Source Text").value;

            var spacedText = "";
            for (var k = 0; k < tokens.length; k++) {
                if (k === currentWordIndex) {
                    spacedText += tokens[k];
                } else if (/\S/.test(tokens[k])) {
                    spacedText += tokens[k].replace(/\S/g, " ");
                } else {
                    spacedText += tokens[k];
                }
            }

            newDoc.text = spacedText;
            newLayer.property("Source Text").setValue(newDoc);
            newLayer.name = newLayer.name.replace(/^\s+/, "");
        }

        originalLayer.enabled = false;
    }

    app.endUndoGroup();

    if (app.activeViewer) {
        app.activeViewer.setActive();
    }
})();
