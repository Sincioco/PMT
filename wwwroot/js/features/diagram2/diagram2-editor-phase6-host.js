import {
  annotationClipboardHasImage,
  annotationClipboardImageFile,
  annotationFieldMappingImages
} from "../../components/image-annotation.js?v=20260730-diagram2-phase6-v1";
import {
  diagram2CropCornerPatch,
  diagram2CropPatchFromInsets,
  diagram2ResetCropPatch
} from "./diagram2-editor-crop.js?v=20260730-diagram2-phase6-v1";
import {
  isDiagram2ImageFile,
  loadDiagram2ImageDimensions
} from "./diagram2-editor-images.js?v=20260730-diagram2-phase6-v1";
import {
  isDiagram2FieldRectangle
} from "./diagram2-editor-field-rectangles.js?v=20260730-diagram2-phase6-v1";
import {
  openDiagram2EntityAnnotationEditor,
  openDiagram2FieldMappingImageChooser,
  openDiagram2FieldRectangleMappingEditor
} from "./diagram2-editor-shell.js?v=20260730-diagram2-phase6-v1";

export function createDiagram2Phase6Host(options = {}) {
  const root = options.root;
  const controller = options.controller;
  const renderer = options.renderer;

  function bind(signal) {
    const input = root?.querySelector?.("[data-diagram2-image-input]");
    input?.addEventListener("change", event => {
      const files = [...(event.target.files || [])].filter(isDiagram2ImageFile);
      event.target.value = "";
      if (files.length) void addImageFiles(files);
    }, { signal });

    const canvas = root?.querySelector?.("[data-diagram2-viewer-canvas]");
    canvas?.addEventListener("dragover", event => {
      if (!diagram2DragHasImage(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      canvas.classList.add("is-image-drop-target");
    }, { signal });
    canvas?.addEventListener("dragleave", event => {
      if (event.relatedTarget && canvas.contains(event.relatedTarget)) return;
      canvas.classList.remove("is-image-drop-target");
    }, { signal });
    canvas?.addEventListener("drop", event => {
      canvas.classList.remove("is-image-drop-target");
      const files = [...(event.dataTransfer?.files || [])].filter(isDiagram2ImageFile);
      if (!files.length) return;
      event.preventDefault();
      void addImageFiles(files, event);
    }, { signal });
  }

  async function handleAction(action) {
    if (action === "add-diagram2-image") {
      root?.querySelector?.("[data-diagram2-image-input]")?.click();
      return true;
    }
    if (action === "reset-diagram2-crop") {
      await resetCrop();
      return true;
    }
    if (action === "permanently-crop-diagram2-image") {
      await permanentlyCrop();
      return true;
    }
    if (action === "edit-diagram2-entity-annotation") {
      await editEntityAnnotation();
      return true;
    }
    if (action === "map-diagram2-field-rectangle") {
      await mapFieldRectangle();
      return true;
    }
    if (action === "generate-diagram2-field-mapping-table") {
      await generateFieldMappingTable();
      return true;
    }
    return false;
  }

  async function addImageFiles(filesInput, dropEvent = null) {
    if (!canMutate()) return false;
    if (typeof options.uploadEmbeddedImage !== "function") {
      notify("Image uploads are not available in Diagram 2.");
      return false;
    }
    const files = (Array.isArray(filesInput) ? filesInput : []).filter(isDiagram2ImageFile);
    if (!files.length) return false;
    let addedCount = 0;
    const start = insertionPoint(dropEvent);
    for (const [index, file] of files.entries()) {
      try {
        notify(`Uploading ${file.name || "image"}...`);
        const stored = await options.uploadEmbeddedImage(file);
        const source = String(stored?.url || stored || "").trim();
        if (!source) throw new Error("The uploaded image URL is invalid.");
        const dimensions = await loadDiagram2ImageDimensions(source);
        const center = {
          x: start.x + (index * 24),
          y: start.y + (index * 24)
        };
        const added = await controller.addEmbeddedImage({
          name: uniqueImageName(file.name || "Image"),
          source,
          x: center.x - (dimensions.width / 2),
          y: center.y - (dimensions.height / 2),
          width: dimensions.width,
          height: dimensions.height,
          isOriginalImage: false
        }, {
          label: files.length > 1 ? "Add images" : "Add image",
          reason: dropEvent ? "drop image" : "upload image"
        });
        if (added) addedCount += 1;
      } catch (error) {
        notify(error?.message || `${file.name || "The image"} could not be added.`);
      }
    }
    if (!addedCount) return false;
    controller.setActiveTool("select");
    await afterMutation();
    notify(`${addedCount} image${addedCount === 1 ? "" : "s"} added to the canvas.`);
    return true;
  }

  async function pasteImageEvent(event) {
    const clipboardData = event?.clipboardData;
    if (!clipboardData || !annotationClipboardHasImage(clipboardData)) return false;
    event.preventDefault();
    const file = await annotationClipboardImageFile(clipboardData);
    if (!file) {
      notify("The clipboard image could not be read.");
      return false;
    }
    return addImageFiles([file]);
  }

  async function applyCropInsets(values) {
    const image = selectedImage();
    const patch = image ? diagram2CropPatchFromInsets(image, values) : null;
    return updateCrop(image, patch, "Adjust image crop");
  }

  async function applyCropCorners(values) {
    const image = selectedImage();
    const patch = image ? diagram2CropCornerPatch(image, values) : null;
    return updateCrop(image, patch, "Adjust crop corners");
  }

  async function applyCropCornerRadius(value) {
    const image = selectedImage();
    if (!image) return false;
    const radius = Math.max(0, Number(value) || 0);
    return updateCrop(image, diagram2CropCornerPatch(image, {
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius
    }), "Adjust crop radius");
  }

  async function setCropVisibility(visible) {
    const image = selectedImage();
    if (!image) return false;
    const applied = await controller.setEmbeddedImageCropVisibility(image.id, visible);
    if (applied) await afterMutation();
    return applied;
  }

  async function resetCrop() {
    const image = selectedImage();
    return updateCrop(image, image ? diagram2ResetCropPatch(image) : null, "Reset image crop");
  }

  async function permanentlyCrop() {
    const image = selectedImage();
    if (!image || !canMutate()) return false;
    const confirmed = await confirmAction(
      "Permanently replace this image source with only the cropped pixels? This cannot be undone inside the annotation.",
      "Apply Crop Permanently?",
      "Apply Permanently"
    );
    if (!confirmed) return false;
    const applied = await controller.permanentlyCropEmbeddedImage(image.id);
    if (applied) {
      renderer.setCropTarget?.(image.id);
      await afterMutation();
      notify("Crop permanently applied.");
    }
    return applied;
  }

  async function editEntityAnnotation() {
    const entity = selectedObject(object => object?.type === "entity" && !isDiagram2FieldRectangle(object));
    if (!entity || !canMutate()) return false;
    const result = await openDiagram2EntityAnnotationEditor({ object: entity });
    if (!result) return false;
    const applied = await controller.setEntityAnnotation(entity.id, result.text, {
      showArrow: result.showArrow
    });
    if (applied) await afterMutation();
    return applied;
  }

  async function renameFieldRectangle(value) {
    const rectangle = selectedObject(isDiagram2FieldRectangle);
    if (!rectangle || !canMutate()) return false;
    const applied = await controller.renameFieldRectangle(rectangle.id, value);
    if (applied) await afterMutation();
    return applied;
  }

  async function setFieldRectangleConnectionSide(value) {
    const rectangle = selectedObject(isDiagram2FieldRectangle);
    if (!rectangle || !canMutate()) return false;
    const applied = await controller.setFieldRectangleConnectionSide(rectangle.id, value);
    if (applied) await afterMutation();
    return applied;
  }

  async function mapFieldRectangle() {
    const rectangle = selectedObject(isDiagram2FieldRectangle);
    if (!rectangle || !canMutate()) return false;
    const result = await openDiagram2FieldRectangleMappingEditor({
      object: rectangle,
      state: controller.currentState()
    });
    if (!result) return false;
    const applied = await controller.setFieldRectangleMapping(
      rectangle.id,
      result.remove ? null : result.mapping
    );
    if (applied) await afterMutation();
    return applied;
  }

  async function generateFieldMappingTable() {
    if (!canMutate()) return false;
    const state = controller.currentState();
    const items = annotationFieldMappingImages(state.objects);
    if (!items.length) {
      notify("Place a mapped Field Rectangle on a screenshot before generating a Field Mapping Table.");
      return false;
    }
    const selected = selectedImage();
    const preferred = selected ? items.find(item => item.image.id === selected.id)?.image : null;
    const image = preferred || await openDiagram2FieldMappingImageChooser(items.map(item => item.image));
    if (!image) return false;
    const applied = await controller.addFieldMappingTable(image.id);
    if (applied) await afterMutation();
    return applied;
  }

  function selectedImage() {
    return selectedObject(object => object?.type === "embedded-image");
  }

  function selectedObject(predicate) {
    const objects = controller?.getObjectsByIds?.(controller.selectedObjectIds?.() || []) || [];
    return objects.length === 1 && predicate(objects[0]) ? objects[0] : null;
  }

  function uniqueImageName(value) {
    const name = String(value || "Image").trim() || "Image";
    const existing = new Set((controller.currentState()?.objects || [])
      .map(object => String(object?.name || "").trim().toLowerCase())
      .filter(Boolean));
    if (!existing.has(name.toLowerCase())) return name;
    let suffix = 1;
    while (existing.has(`${name} ${suffix}`.toLowerCase())) suffix += 1;
    return `${name} ${suffix}`;
  }

  function insertionPoint(event) {
    if (event && renderer?.screenToWorld) return controller.snapPoint(renderer.screenToWorld(event));
    const point = options.insertionCenter?.() || { x: 400, y: 300 };
    return controller.snapPoint(point);
  }

  function canMutate() {
    return options.canMutate?.() !== false && controller?.statusSnapshot?.().canEdit !== false;
  }

  async function updateCrop(image, patch, label) {
    if (!image || !patch || !canMutate()) return false;
    const applied = await controller.updateEmbeddedImageCrop(image.id, patch, {
      label,
      reason: label.toLowerCase()
    });
    if (applied) {
      renderer.setCropTarget?.(image.id);
      await afterMutation();
    }
    return applied;
  }

  async function afterMutation() {
    await options.afterMutation?.();
  }

  async function confirmAction(message, title, actionLabel) {
    if (typeof options.confirm === "function") return options.confirm(message, title, actionLabel);
    return globalThis.window?.confirm?.(message) === true;
  }

  function notify(message) {
    options.notify?.(message);
  }

  return {
    bind,
    handleAction,
    addImageFiles,
    pasteImageEvent,
    applyCropInsets,
    applyCropCorners,
    applyCropCornerRadius,
    setCropVisibility,
    resetCrop,
    permanentlyCrop,
    editEntityAnnotation,
    renameFieldRectangle,
    setFieldRectangleConnectionSide,
    mapFieldRectangle,
    generateFieldMappingTable
  };
}

function diagram2DragHasImage(dataTransfer) {
  const files = [...(dataTransfer?.files || [])];
  if (files.some(isDiagram2ImageFile)) return true;
  return [...(dataTransfer?.items || [])]
    .some(item => item.kind === "file" && String(item.type || "").toLowerCase().startsWith("image/"));
}
