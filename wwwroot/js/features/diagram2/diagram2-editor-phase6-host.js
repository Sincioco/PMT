import {
  annotationClipboardHasImage,
  annotationClipboardImageFile,
  annotationFieldMappingImages
} from "../../components/image-annotation.js?v=20260731-diagram2-route-release-v15";
import {
  createDiagram2CropNumericAdjustmentScheduler,
  diagram2CropOptionsPatch,
  diagram2ImageHasReversibleCrop,
  diagram2ResetCropPatch
} from "./diagram2-editor-crop.js?v=20260731-diagram2-route-release-v15";
import {
  isDiagram2ImageFile,
  loadDiagram2ImageDimensions
} from "./diagram2-editor-images.js?v=20260731-diagram2-route-release-v15";
import {
  isDiagram2FieldRectangle
} from "./diagram2-editor-field-rectangles.js?v=20260731-diagram2-route-release-v15";
import {
  openDiagram2EntityAnnotationEditor,
  openDiagram2FieldMappingImageChooser,
  openDiagram2FieldRectangleMappingEditor
} from "./diagram2-editor-shell.js?v=20260731-diagram2-route-release-v15";

export function createDiagram2Phase6Host(options = {}) {
  const root = options.root;
  const controller = options.controller;
  const renderer = options.renderer;
  let cropModeImageId = "";
  let observedSelectionKey = selectionKey();
  let observedTool = controller?.activeTool?.() || "select";
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
    const cleanup = () => {
      stopControllerObservation();
      cropNumericScheduler.destroy();
      if (cropModeImageId) renderer.setSelectionChromeSuppressed?.(cropModeImageId, false);
      cropModeImageId = "";
      renderer.clearCropPreview?.();
    };
    if (signal) signal.addEventListener("abort", cleanup, { once: true });
    return cleanup;
  }

  async function handleAction(action) {
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

  async function activateCropTool() {
    if (!canMutate()) return false;
    if (controller.activeTool() === "crop") {
      await finishCropAdjustment("Crop mode closed");
      closeCropMode();
      controller.setActiveTool("select");
      notify("Crop mode closed.");
      focusWorkspace();
      return true;
    }

    const image = selectedImage();
    if (!image) {
      controller.setActiveTool("select");
      notify("Select one image before cropping it.");
      return false;
    }
    if (image.locked === true) {
      controller.setActiveTool("select");
      notify("Unlock the image before cropping it.");
      return false;
    }

    if (!diagram2ImageHasReversibleCrop(image)) {
      controller.setActiveTool("crop");
      cropModeImageId = image.id;
      renderer.setCropTarget?.(image.id);
      renderer.setSelectionChromeSuppressed?.(image.id, true);
      notify("Drag the image crop handles inward. The crop cannot extend outside the image.");
      focusWorkspace();
      return true;
    }

    controller.setActiveTool("select");
    closeCropMode();
    const choice = await openDiagram2CropOptionsDialog(root?.ownerDocument);
    if (choice === "remove") {
      const removed = await resetCrop();
      if (removed) notify("Crop removed. The full source is visible again.");
      focusWorkspace();
      return removed;
    }
    if (choice !== "permanent") {
      notify("Crop left unchanged.");
      focusWorkspace();
      return false;
    }

    const applied = await permanentlyCrop();
    focusWorkspace();
    return applied;
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
    addImageFiles,
    pasteImageEvent,
    activateCropTool,
    setTool,
    flushCropAdjustment,
    finishCropAdjustment,
    cancelCropAdjustment,
    cropAdjustmentDiagnostics: () => cropNumericScheduler.diagnostics(),
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

function finiteControlNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function openDiagram2CropOptionsDialog(documentRef = globalThis.document) {
  return new Promise(resolve => {
    if (!documentRef?.createElement) {
      resolve("");
      return;
    }
    const dialog = documentRef.createElement("dialog");
    dialog.className = "dialog mini-dialog image-annotation-crop-options-dialog";
    dialog.setAttribute("aria-labelledby", "diagram2CropOptionsTitle");
    dialog.innerHTML = `
      <div class="dialog-head">
        <h2 id="diagram2CropOptionsTitle">Crop Options</h2>
      </div>
      <div class="dialog-body">
        <p>This image already has a crop. You can remove the crop or permanently replace the source with only the cropped area.</p>
        <p class="image-annotation-crop-warning">Applying the crop permanently cannot be undone.</p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-diagram2-crop-choice=""><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
        <button type="button" class="secondary text-icon-button" data-diagram2-crop-choice="remove"><span class="button-icon" aria-hidden="true">&#8634;</span><span>Remove Crop</span></button>
        <button type="button" class="danger text-icon-button" data-diagram2-crop-choice="permanent"><span class="button-icon" aria-hidden="true">&#9888;</span><span>Apply Crop Permanently</span></button>
      </div>
    `;
    documentRef.body.appendChild(dialog);
    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelectorAll("[data-diagram2-crop-choice]").forEach(button => {
      button.addEventListener("click", () => finish(button.dataset.diagram2CropChoice || ""));
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish("");
    });
    dialog.showModal();
    dialog.querySelector("[data-diagram2-crop-choice='']")?.focus();
  });
}
