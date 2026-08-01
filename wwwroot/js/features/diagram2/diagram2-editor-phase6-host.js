import {
  annotationClipboardHasImage,
  annotationClipboardImageFile,
  annotationFieldMappingImages
} from "../../components/image-annotation.js?v=20260731-rte-checkbox-layout-v2";
import {
  createDiagram2CropNumericAdjustmentScheduler,
  diagram2CropOptionsPatch,
  diagram2ImageHasReversibleCrop,
  diagram2ResetCropPatch,
  diagram2ResetCropRadiusPatch
} from "./diagram2-editor-crop.js?v=20260731-diagram2-crop-preview-v1";
import {
  isDiagram2ImageFile,
  loadDiagram2ImageDimensions
} from "./diagram2-editor-images.js?v=20260731-rte-checkbox-layout-v2";
import {
  createDiagram2ScreenCaptureService,
  diagram2ScreenCaptureErrorMessage,
  diagram2ScreenCaptureReducedResolutionMessage,
  diagram2ScreenCaptureUnsupportedMessage
} from "./diagram2-screen-capture.js?v=20260801-diagram2-screen-capture-v1";
import {
  isDiagram2FieldRectangle
} from "./diagram2-editor-field-rectangles.js?v=20260731-rte-checkbox-layout-v2";
import {
  openDiagram2EntityAnnotationEditor,
  openDiagram2FieldMappingImageChooser,
  openDiagram2FieldRectangleMappingEditor,
  setDiagram2InspectorActiveTab
} from "./diagram2-editor-shell.js?v=20260801-diagram2-screen-capture-v1";

export function createDiagram2Phase6Host(options = {}) {
  const root = options.root;
  const controller = options.controller;
  const renderer = options.renderer;
  let cropModeImageId = "";
  let observedSelectionKey = selectionKey();
  let observedTool = controller?.activeTool?.() || "select";
  let captureBusy = false;
  let destroyed = false;
  let lastScreenCaptureDiagnostics = null;
  const screenCaptureService = options.screenCaptureService || createDiagram2ScreenCaptureService({
    ...(options.screenCaptureDependencies || {}),
    onDiagnostics: diagnostics => {
      lastScreenCaptureDiagnostics = diagnostics;
      options.onScreenCaptureDiagnostics?.(diagnostics);
    }
  });
  const cropNumericScheduler = createDiagram2CropNumericAdjustmentScheduler({
    timers: options.timers,
    begin: adjustment => {
      renderer.beginCropOptionAdjustment?.(adjustment.imageId);
    },
    commit: adjustment => commitCropNumericAdjustment(adjustment),
    cancel: adjustment => {
      renderer.cancelCropOptionAdjustment?.(adjustment.imageId, {
        keepTarget: controller?.activeTool?.() === "crop"
      });
    },
    end: adjustment => {
      renderer.endCropOptionAdjustment?.(adjustment.imageId, {
        keepTarget: controller?.activeTool?.() === "crop"
      });
    }
  });

  function bind(signal) {
    const listenerOptions = signal ? { signal } : undefined;
    const input = root?.querySelector?.("[data-diagram2-image-input]");
    input?.addEventListener("change", event => {
      const files = [...(event.target.files || [])].filter(isDiagram2ImageFile);
      event.target.value = "";
      if (files.length) void addImageFiles(files);
    }, listenerOptions);

    const canvas = root?.querySelector?.("[data-diagram2-viewer-canvas]");
    canvas?.addEventListener("dragover", event => {
      if (!diagram2DragHasImage(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      canvas.classList.add("is-image-drop-target");
    }, listenerOptions);
    canvas?.addEventListener("dragleave", event => {
      if (event.relatedTarget && canvas.contains(event.relatedTarget)) return;
      canvas.classList.remove("is-image-drop-target");
    }, listenerOptions);
    canvas?.addEventListener("drop", event => {
      canvas.classList.remove("is-image-drop-target");
      const files = [...(event.dataTransfer?.files || [])].filter(isDiagram2ImageFile);
      if (!files.length) return;
      event.preventDefault();
      void addImageFiles(files, event);
    }, listenerOptions);

    root?.addEventListener?.("input", handleCropNumericInput, listenerOptions);
    root?.addEventListener?.("change", handleCropNumericFlush, listenerOptions);
    root?.addEventListener?.("focusout", handleCropNumericFlush, listenerOptions);
    root?.addEventListener?.("keydown", handleCropNumericKeydown, listenerOptions);

    const stopControllerObservation = controller?.onChange?.(handleControllerChange) || (() => {});
    syncScreenCaptureButton();
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      destroyed = true;
      stopControllerObservation();
      screenCaptureService.destroy?.();
      captureBusy = false;
      syncScreenCaptureButton();
      cropNumericScheduler.destroy();
      if (cropModeImageId) renderer.setSelectionChromeSuppressed?.(cropModeImageId, false);
      cropModeImageId = "";
      renderer.clearCropPreview?.();
    };
    if (signal) signal.addEventListener("abort", cleanup, { once: true });
    return cleanup;
  }

  async function handleAction(action) {
    if (action === "capture-diagram2-screen") {
      await captureScreen();
      return true;
    }
    if (action === "add-diagram2-image") {
      root?.querySelector?.("[data-diagram2-image-input]")?.click();
      return true;
    }
    if (action === "reset-diagram2-crop") {
      await finishCropAdjustment("reset crop");
      const reset = await resetCrop();
      if (reset) notify("Crop reset. Undo restores the previous crop.");
      return true;
    }
    if (action === "reset-diagram2-crop-radius") {
      await finishCropAdjustment("reset crop radius");
      const reset = await resetCropRadius();
      if (reset) notify("Crop radius reset.");
      return true;
    }
    if (action === "permanently-crop-diagram2-image") {
      await finishCropAdjustment("permanent crop");
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

  async function captureScreen() {
    if (!canMutate()) {
      notify("Screen capture is available only on an editable Diagram 2 canvas.");
      syncScreenCaptureButton();
      return false;
    }
    if (screenCaptureService.supported?.() !== true) {
      notify(diagram2ScreenCaptureUnsupportedMessage);
      syncScreenCaptureButton();
      return false;
    }
    if (captureBusy || screenCaptureService.busy?.() === true) return false;

    captureBusy = true;
    syncScreenCaptureButton();
    notify("Choose a screen, window, or tab to capture.");
    try {
      const result = await screenCaptureService.capture();
      lastScreenCaptureDiagnostics = result?.diagnostics || screenCaptureService.diagnostics?.() || null;
      if (destroyed || !canMutate()) return false;
      const inserted = await addImageFiles([result.file], null, {
        activateCrop: true,
        label: "Capture screen",
        reason: "capture screen",
        silentCropMessage: true,
        suppressSuccessMessage: true,
        uploadMessage: "Adding screen capture..."
      });
      if (!inserted || destroyed) return false;
      notify(result.reducedResolution
        ? `Screen capture inserted. ${diagram2ScreenCaptureReducedResolutionMessage}`
        : "Screen capture inserted.");
      return true;
    } catch (error) {
      if (!destroyed) notify(diagram2ScreenCaptureErrorMessage(error));
      return false;
    } finally {
      captureBusy = false;
      syncScreenCaptureButton();
    }
  }

  async function addImageFiles(filesInput, dropEvent = null, addOptions = {}) {
    if (!canMutate()) return false;
    if (typeof options.uploadEmbeddedImage !== "function") {
      notify("Image uploads are not available in Diagram 2.");
      return false;
    }
    const files = (Array.isArray(filesInput) ? filesInput : []).filter(isDiagram2ImageFile);
    if (!files.length) return false;
    let addedCount = 0;
    const start = insertionPoint(dropEvent);
    const loadDimensions = options.loadImageDimensions || loadDiagram2ImageDimensions;
    for (const [index, file] of files.entries()) {
      try {
        notify(addOptions.uploadMessage || `Uploading ${file.name || "image"}...`);
        const stored = await options.uploadEmbeddedImage(file);
        const source = String(stored?.url || stored || "").trim();
        if (!source) throw new Error("The uploaded image URL is invalid.");
        const dimensions = await loadDimensions(source);
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
          label: addOptions.label || (files.length > 1 ? "Add images" : "Add image"),
          reason: addOptions.reason || (dropEvent ? "drop image" : "upload image")
        });
        if (added) addedCount += 1;
      } catch (error) {
        notify(error?.message || `${file.name || "The image"} could not be added.`);
      }
    }
    if (!addedCount) return false;
    controller.setActiveTool("select");
    await afterMutation();
    if (addOptions.activateCrop === true) {
      await activateCropTool({ silent: addOptions.silentCropMessage === true });
    }
    if (addOptions.suppressSuccessMessage !== true) {
      notify(`${addedCount} image${addedCount === 1 ? "" : "s"} added to the canvas.`);
    }
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

  async function flushCropAdjustment(reason = "flush crop adjustment") {
    return cropNumericScheduler.flush(reason);
  }

  async function finishCropAdjustment(reason = "finish crop adjustment") {
    return cropNumericScheduler.flushAndEnd(reason);
  }

  async function cancelCropAdjustment(reason = "cancel crop adjustment") {
    const canceled = cropNumericScheduler.cancel(reason);
    if (canceled && reason !== "editor canceled") await afterMutation();
    return canceled;
  }

  async function setTool(toolInput, toolOptions = {}) {
    const tool = String(toolInput || "select").trim().toLowerCase();
    if (tool === "crop") return activateCropTool();
    await finishCropAdjustment(toolOptions.reason || "tool changed");
    closeCropMode();
    controller.setActiveTool(tool);
    return true;
  }

  async function activateCropTool(toolOptions = {}) {
    if (!canMutate()) return false;
    if (controller.activeTool() === "crop") {
      await finishCropAdjustment("Crop mode closed");
      closeCropMode();
      controller.setActiveTool("select");
      if (toolOptions.silent !== true) notify("Crop mode closed.");
      focusWorkspace();
      return true;
    }

    const image = selectedImage();
    if (!image) {
      controller.setActiveTool("select");
      if (toolOptions.silent !== true) notify("Select one image before cropping it.");
      return false;
    }
    if (image.locked === true) {
      controller.setActiveTool("select");
      if (toolOptions.silent !== true) notify("Unlock the image before cropping it.");
      return false;
    }

    const continuingCrop = diagram2ImageHasReversibleCrop(image);
    controller.setActiveTool("crop");
    cropModeImageId = image.id;
    renderer.setCropTarget?.(image.id);
    renderer.setSelectionChromeSuppressed?.(image.id, true);
    setDiagram2InspectorActiveTab(root, "crop");
    if (toolOptions.silent !== true) {
      notify(continuingCrop
        ? "Adjust the existing crop handles to reveal or hide more of the original image."
        : "Drag the image crop handles inward. The crop cannot extend outside the image.");
    }
    focusWorkspace();
    return true;
  }

  async function setCropVisibility(visible) {
    await finishCropAdjustment("crop visibility changed");
    const image = selectedImage();
    if (!image) return false;
    const applied = await controller.setEmbeddedImageCropVisibility(image.id, visible);
    if (applied) await afterMutation();
    return applied;
  }

  async function resetCrop() {
    await finishCropAdjustment("reset crop");
    const image = selectedImage();
    const reset = await updateCrop(image, image ? diagram2ResetCropPatch(image) : null, "Reset image crop");
    if (reset && controller.activeTool() === "crop") {
      closeCropMode();
      controller.setActiveTool("select");
    }
    return reset;
  }

  async function resetCropRadius() {
    await finishCropAdjustment("reset crop radius");
    const image = selectedImage();
    return updateCrop(image, image ? diagram2ResetCropRadiusPatch() : null, "Reset image crop radius");
  }

  async function permanentlyCrop() {
    await finishCropAdjustment("permanent crop");
    const image = selectedImage();
    if (!image || !canMutate()) return false;
    if (controller.activeTool() === "crop") {
      closeCropMode();
      controller.setActiveTool("select");
    }
    const temporarilyShown = image.cropVisible === false;
    if (temporarilyShown) {
      renderer.previewCrop?.(image.id, image.imageClip);
      notify("The saved crop is shown so you can verify the pixels that will remain.");
    }
    const confirmed = await confirmAction(
      "Permanently replace this image source with only the cropped pixels? This cannot be undone inside the annotation.",
      "Apply Crop Permanently?",
      "Apply Permanently"
    );
    if (!confirmed) {
      if (temporarilyShown) renderer.clearCropPreview?.();
      notify("Crop left unchanged.");
      return false;
    }
    const applied = await controller.permanentlyCropEmbeddedImage(image.id);
    if (applied) {
      renderer.clearCropPreview?.();
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

  async function updateCrop(image, patch, label, updateOptions = {}) {
    if (!image || !patch || !canMutate()) return false;
    const applied = await controller.updateEmbeddedImageCrop(image.id, patch, {
      label,
      reason: updateOptions.reason || label.toLowerCase(),
      selectionAfter: updateOptions.selectionAfter
    });
    if (applied) {
      if (updateOptions.cropOptionAdjustment === true) {
        renderer.commitCropOptionAdjustment?.(image.id, {
          keepTarget: updateOptions.keepTarget !== false
        });
      } else if (updateOptions.keepTarget !== false) {
        renderer.setCropTarget?.(image.id);
      }
      await afterMutation();
    }
    return applied;
  }

  async function commitCropNumericAdjustment(adjustment) {
    const image = controller?.getObjectById?.(adjustment.imageId);
    const patch = image ? diagram2CropOptionsPatch(image, adjustment.values) : null;
    return updateCrop(image, patch, "Adjust image crop", {
      cropOptionAdjustment: true,
      keepTarget: selectionKey() === adjustment.imageId,
      selectionAfter: controller?.selectedObjectIds?.() || [],
      reason: "crop numeric adjustment"
    });
  }

  function handleCropNumericInput(event) {
    const control = cropNumericControl(event.target);
    const image = selectedImage();
    if (!control || !image || image.locked === true || !canMutate()) return;
    if (control.matches("[data-diagram2-crop-corner-radius]")) {
      root.querySelectorAll("[data-diagram2-crop-corner]").forEach(corner => {
        corner.value = control.value;
      });
    } else if (control.matches("[data-diagram2-crop-corner]")) {
      const radius = root.querySelector("[data-diagram2-crop-corner-radius]");
      if (radius) radius.value = "0";
    }
    cropNumericScheduler.schedule({
      imageId: image.id,
      values: cropNumericControlValues()
    });
  }

  function handleCropNumericFlush(event) {
    if (!cropNumericControl(event.target)) return;
    void flushCropAdjustment(event.type === "change" ? "change" : "blur");
  }

  function handleCropNumericKeydown(event) {
    if (!cropNumericControl(event.target)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      void flushCropAdjustment("Enter");
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    void cancelCropAdjustment("Escape");
  }

  function handleControllerChange(event) {
    const nextSelectionKey = (event?.status?.selectedObjectIds || []).join("|");
    const nextTool = event?.status?.activeTool || controller?.activeTool?.() || "select";
    const schedulerImageId = cropNumericScheduler.diagnostics().activeImageId;
    const selectionChanged = nextSelectionKey !== observedSelectionKey;
    const toolChanged = nextTool !== observedTool;
    observedSelectionKey = nextSelectionKey;
    observedTool = nextTool;

    if (selectionChanged && schedulerImageId && nextSelectionKey !== schedulerImageId) {
      void finishCropAdjustment("selection changed");
    }
    if (selectionChanged && cropModeImageId && nextSelectionKey !== cropModeImageId) {
      closeCropMode();
      if (nextTool === "crop") controller.setActiveTool("select");
    }
    if (toolChanged && nextTool !== "crop") {
      if (schedulerImageId) void finishCropAdjustment("tool changed");
      closeCropMode();
    }
    syncScreenCaptureButton();
  }

  function syncScreenCaptureButton() {
    const button = root?.querySelector?.("[data-diagram2-screen-capture]");
    if (!button) return;
    const supported = screenCaptureService.supported?.() === true;
    const busy = captureBusy || screenCaptureService.busy?.() === true;
    button.dataset.diagram2ScreenCaptureSupported = String(supported);
    button.dataset.diagram2ScreenCaptureBusy = String(busy);
    button.disabled = destroyed || !supported || busy || !canMutate();
    button.setAttribute?.("aria-busy", String(busy));
  }

  function cropNumericControl(target) {
    return target?.closest?.(
      "[data-diagram2-crop-inset], [data-diagram2-crop-corner], [data-diagram2-crop-corner-radius]"
    ) || null;
  }

  function cropNumericControlValues() {
    return {
      insets: Object.fromEntries(
        [...root.querySelectorAll("[data-diagram2-crop-inset]")]
          .map(control => [control.dataset.diagram2CropInset, finiteControlNumber(control.value)])
      ),
      corners: Object.fromEntries(
        [...root.querySelectorAll("[data-diagram2-crop-corner]")]
          .map(control => [control.dataset.diagram2CropCorner, finiteControlNumber(control.value)])
      )
    };
  }

  function selectionKey() {
    return (controller?.selectedObjectIds?.() || []).join("|");
  }

  function closeCropMode() {
    if (cropModeImageId) renderer.setSelectionChromeSuppressed?.(cropModeImageId, false);
    cropModeImageId = "";
    renderer.clearCropPreview?.();
  }

  function focusWorkspace() {
    root?.querySelector?.("[data-diagram2-workspace]")?.focus?.({ preventScroll: true });
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
    captureScreen,
    addImageFiles,
    pasteImageEvent,
    activateCropTool,
    setTool,
    flushCropAdjustment,
    finishCropAdjustment,
    cancelCropAdjustment,
    cropAdjustmentDiagnostics: () => cropNumericScheduler.diagnostics(),
    screenCaptureDiagnostics: () => lastScreenCaptureDiagnostics || screenCaptureService.diagnostics?.() || null,
    setCropVisibility,
    resetCrop,
    resetCropRadius,
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

function finiteControlNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
