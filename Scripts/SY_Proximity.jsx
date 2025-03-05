// SY_Proximity_1.0.jsx
// ===========================================================
// █▀▀░█░█░░░░░█▀█░█▀▄░█▀█░█░█░▀█▀░█▄█░▀█▀░▀█▀░█░█
// ▀▀█░░█░░░░░░█▀▀░█▀▄░█░█░▄▀▄░░█░░█░█░░█░░░█░░░█░
// ▀▀▀░░▀░░▀▀▀░▀░░░▀░▀░▀▀▀░▀░▀░▀▀▀░▀░▀░▀▀▀░░▀░░░▀░
// made with love by Zain Aldin aka Sphiment <3
// ===========================================================
(function(thisObj) {

function createProximityExpression() {
	app.beginUndoGroup("Create Proximity Expression");

	// Validate active comp and layer selection
	var comp = app.project.activeItem;
	if (!comp || !(comp instanceof CompItem)) {
		app.endUndoGroup();
		return;
	}
	var selLayers = comp.selectedLayers;
	if (selLayers.length !== 1) {
		app.endUndoGroup();
		return;
	}
	var layer = selLayers[0];
	var selProps = layer.selectedProperties;
	var targetProp = null;
	for (var i = 0; i < selProps.length; i++) {
		if (selProps[i] instanceof Property) {
			targetProp = selProps[i];
			break;
		}
	}
	if (!targetProp) {
		app.endUndoGroup();
		return;
	}
	
	// Main Execution
	var propInfo = getPropTypeInfo(targetProp);
	if (!propInfo) {
		app.endUndoGroup();
		return;
	}
	
	// Create a controller null and move it before the selected layer
	var controllerNull = comp.layers.addNull();
	controllerNull.moveBefore(layer);
	
	// Add a Layer Control effect to link the layer to follow
	var layerControl = controllerNull.Effects.addProperty("ADBE Layer Control");
	layerControl.name = "Layer to follow";
	
	// Set the controller's position to follow the target layer's position
	controllerNull.property("Position").setValue([0, 0]);
	controllerNull.property("Position").expression =
		'x = effect("Layer to follow")("Layer").transform.position[0];\n' +
		'y = effect("Layer to follow")("Layer").transform.position[1];\n' +
		'[x, y]';
	
	// Add distance controls on the controller null
	var minDistFx = addEffect(controllerNull, "ADBE Slider Control", "Min Distance", 0, targetProp.name);
	var maxDistFx = addEffect(controllerNull, "ADBE Slider Control", "Max Distance", 100, targetProp.name);
	
	// Get default values from the current property value
	var currentVal = targetProp.value;
	var defaultVal = getDefaultForDimension(propInfo.dimension, currentVal);
	
	// Add value controls on the controller null
	var minValueFx = addEffect(controllerNull, propInfo.effectName, "Min Value", defaultVal, targetProp.name);
	var maxValueFx = addEffect(controllerNull, propInfo.effectName, "Max Value", defaultVal, targetProp.name);
	
	// Build and assign the expression for the target property
	var exprText = buildExpression(
		propInfo.dimension,
		controllerNull.name,
		propInfo.propName,
		targetProp.name
	);
	targetProp.expression = exprText;
	
	app.endUndoGroup();
	if (app.activeViewer && app.activeViewer.type === ViewerType.VIEWER_COMPOSITION) {
		app.activeViewer.setActive();
	}
}

function getPropTypeInfo(prop) {
	var pType = prop.propertyValueType;
	switch (pType) {
		case PropertyValueType.OneD:
			return { dimension: 1, effectName: "ADBE Slider Control", propName: "Slider" };
		case PropertyValueType.TwoD:
		case PropertyValueType.TwoD_SPATIAL:
			return { dimension: 2, effectName: "ADBE Point Control", propName: "Point" };
		case PropertyValueType.ThreeD:
		case PropertyValueType.ThreeD_SPATIAL:
			return { dimension: 3, effectName: "ADBE Point3D Control", propName: "3D Point" };
		case PropertyValueType.COLOR:
			return { dimension: 4, effectName: "ADBE Color Control", propName: "Color" };
		default:
			return null;
	}
}

function getDefaultForDimension(dim, val) {
	if (dim === 1) {
		return (typeof val === "number") ? val : 0;
	} else if (dim === 2) {
		return (val instanceof Array && val.length >= 2) ? val : [0, 0];
	} else if (dim === 3) {
		return (val instanceof Array && val.length >= 3) ? val : [0, 0, 0];
	} else if (dim === 4) {
		return (val instanceof Array && val.length >= 4) ? val : [0, 0, 0, 1];
	}
	return null;
}

function addEffect(layer, matchName, effectDisplayName, defaultValue, targetName) {
	var fx = layer.Effects.addProperty(matchName);
	fx.name = targetName + " " + effectDisplayName;
	if (defaultValue !== undefined && defaultValue !== null) {
		switch (matchName) {
			case "ADBE Slider Control":
				fx.property("Slider").setValue(defaultValue);
				break;
			case "ADBE Point Control":
				fx.property("Point").setValue(defaultValue);
				break;
			case "ADBE Point3D Control":
				fx.property("3D Point").setValue(defaultValue);
				break;
			case "ADBE Color Control":
				fx.property("Color").setValue(defaultValue);
				break;
		}
	}
	return fx;
}

function buildExpression(dim, ctrlLayerName, ctrlPropName, targetName) {
	var expr = "// Proximity-based expression\n" +
			   "var target = thisComp.layer(\"" + ctrlLayerName + "\");\n" +
			   "var currentPos = thisLayer.position;\n" +
			   "var targetPos  = target.position;\n" +
			   "\n" +
			   "// Calculate bounding box based on current scale\n" +
			   "var rect = thisLayer.sourceRectAtTime(time, false);\n" +
			   "var w = rect.width * (thisLayer.scale[0] / 100);\n" +
			   "var h = rect.height * (thisLayer.scale[1] / 100);\n" +
			   "var left   = currentPos[0] - w / 2;\n" +
			   "var right  = currentPos[0] + w / 2;\n" +
			   "var top    = currentPos[1] - h / 2;\n" +
			   "var bottom = currentPos[1] + h / 2;\n" +
			   "\n" +
			   "var dx = Math.max(left - targetPos[0], 0, targetPos[0] - right);\n" +
			   "var dy = Math.max(top - targetPos[1], 0, targetPos[1] - bottom);\n" +
			   "var distance = Math.sqrt(dx * dx + dy * dy);\n" +
			   "\n" +
			   "var minD = target.effect(\"" + targetName + " Min Distance\")(\"Slider\");\n" +
			   "var maxD = target.effect(\"" + targetName + " Max Distance\")(\"Slider\");\n" +
			   "\n" +
			   "var minVal = target.effect(\"" + targetName + " Min Value\")(\"" + ctrlPropName + "\");\n" +
			   "var maxVal = target.effect(\"" + targetName + " Max Value\")(\"" + ctrlPropName + "\");\n" +
			   "\n";
	if (dim === 1) {
		expr += "var s = ease(distance, minD, maxD, maxVal, minVal);\n" +
				"[s];";
	} else if (dim === 2) {
		expr += "var x = ease(distance, minD, maxD, maxVal[0], minVal[0]);\n" +
				"var y = ease(distance, minD, maxD, maxVal[1], minVal[1]);\n" +
				"[x, y];";
	} else if (dim === 3) {
		expr += "var x = ease(distance, minD, maxD, maxVal[0], minVal[0]);\n" +
				"var y = ease(distance, minD, maxD, maxVal[1], minVal[1]);\n" +
				"var z = ease(distance, minD, maxD, maxVal[2], minVal[2]);\n" +
				"[x, y, z];";
	} else if (dim === 4) {
		expr += "var r = ease(distance, minD, maxD, maxVal[0], minVal[0]);\n" +
				"var g = ease(distance, minD, maxD, maxVal[1], minVal[1]);\n" +
				"var b = ease(distance, minD, maxD, maxVal[2], minVal[2]);\n" +
				"var a = ease(distance, minD, maxD, maxVal[3], minVal[3]);\n" +
				"[r, g, b, a];";
	}
	return expr;
}

function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "SY_Proximity.jsx", undefined, { resizable: true });

        if (panel) {
            panel.orientation = "column";
            panel.alignChildren = ["center", "top"];
            panel.spacing = 5;
            panel.margins = 5;

            var group1 = panel.add("group", undefined, { name: "group1" });
            group1.orientation = "row";
            group1.alignChildren = ["center", "center"];
            group1.alignment = ["fill", "top"];

            var button1 = group1.add("button", undefined, "Apply Proximity!");

            button1.onClick = function () {
                createProximityExpression();
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
