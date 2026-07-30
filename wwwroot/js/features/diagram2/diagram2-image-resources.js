import { diagram2ImageSourceIdentity } from "./diagram2-editor-images.js?v=20260730-diagram2-phase6-v1";

export function createDiagram2ImageResourceManager(options = {}) {
  const resourcesByIdentity = new Map();
  const identityByObjectId = new Map();
  const imageFactory = options.imageFactory || defaultImageFactory;
  const revokeObjectUrl = options.revokeObjectURL || (value => globalThis.URL?.revokeObjectURL?.(value));
  const onChange = typeof options.onChange === "function" ? options.onChange : null;
  let loadCount = 0;
  let cacheHitCount = 0;
  let releaseCount = 0;
  let errorCount = 0;
  let destroyed = false;

  function retain(objectIdInput, sourceInput) {
    if (destroyed) return null;
    const objectId = String(objectIdInput || "").trim();
    const source = String(sourceInput || "").trim();
    const identity = diagram2ImageSourceIdentity(source);
    if (!objectId || !identity) return null;

    const previousIdentity = identityByObjectId.get(objectId);
    if (previousIdentity === identity) {
      cacheHitCount += 1;
      return resourcesByIdentity.get(identity) || null;
    }
    if (previousIdentity) release(objectId);

    let resource = resourcesByIdentity.get(identity);
    if (!resource) {
      resource = {
        identity,
        source,
        status: "loading",
        error: "",
        width: 0,
        height: 0,
        objectIds: new Set(),
        image: null,
        loadHandler: null,
        errorHandler: null
      };
      resourcesByIdentity.set(identity, resource);
      loadCount += 1;
      loadResource(resource);
    } else {
      cacheHitCount += 1;
    }
    resource.objectIds.add(objectId);
    identityByObjectId.set(objectId, identity);
    return resource;
  }

  function loadResource(resource) {
    let image;
    try {
      image = imageFactory();
    } catch (error) {
      finishLoad(resource, null, error);
      return;
    }
    if (!image) {
      resource.status = "ready";
      onChange?.(resource);
      return;
    }
    resource.image = image;
    resource.loadHandler = () => finishLoad(resource, image);
    resource.errorHandler = () => finishLoad(resource, image, new Error("Image unavailable"));
    image.addEventListener?.("load", resource.loadHandler, { once: true });
    image.addEventListener?.("error", resource.errorHandler, { once: true });
    image.src = resource.source;
  }

  function finishLoad(resource, image, error = null) {
    if (destroyed || resourcesByIdentity.get(resource.identity) !== resource) return;
    resource.image = image || resource.image;
    resource.status = error ? "error" : "ready";
    resource.error = error ? String(error.message || error) : "";
    resource.width = finiteNumber(image?.naturalWidth || image?.width, 0);
    resource.height = finiteNumber(image?.naturalHeight || image?.height, 0);
    detachResourceListeners(resource);
    if (error) errorCount += 1;
    onChange?.(resource);
  }

  function release(objectIdInput) {
    const objectId = String(objectIdInput || "").trim();
    const identity = identityByObjectId.get(objectId);
    if (!identity) return false;
    identityByObjectId.delete(objectId);
    const resource = resourcesByIdentity.get(identity);
    if (!resource) return false;
    resource.objectIds.delete(objectId);
    releaseCount += 1;
    if (!resource.objectIds.size) {
      resourcesByIdentity.delete(identity);
      disposeResource(resource);
    }
    return true;
  }

  function sync(objectsInput = []) {
    const imageObjects = (Array.isArray(objectsInput) ? objectsInput : [])
      .filter(object => object?.type === "embedded-image" && object.id && object.source);
    const nextIds = new Set(imageObjects.map(object => String(object.id)));
    [...identityByObjectId.keys()].filter(id => !nextIds.has(id)).forEach(release);
    imageObjects.forEach(object => retain(object.id, object.source));
    return diagnostics();
  }

  function statusForObject(objectIdInput) {
    const identity = identityByObjectId.get(String(objectIdInput || ""));
    const resource = identity ? resourcesByIdentity.get(identity) : null;
    return resource ? {
      identity: resource.identity,
      status: resource.status,
      error: resource.error,
      width: resource.width,
      height: resource.height
    } : null;
  }

  function diagnostics() {
    return {
      resourceCount: resourcesByIdentity.size,
      retainedObjectCount: identityByObjectId.size,
      loadingCount: [...resourcesByIdentity.values()].filter(resource => resource.status === "loading").length,
      errorResourceCount: [...resourcesByIdentity.values()].filter(resource => resource.status === "error").length,
      loadCount,
      decodeCount: loadCount,
      cacheMissCount: loadCount,
      cacheHitCount,
      releaseCount,
      resourceReleaseCount: releaseCount,
      cachedImageCount: resourcesByIdentity.size,
      errorCount
    };
  }

  function destroy() {
    [...identityByObjectId.keys()].forEach(release);
    destroyed = true;
    resourcesByIdentity.forEach(disposeResource);
    resourcesByIdentity.clear();
    identityByObjectId.clear();
  }

  function detachResourceListeners(resource) {
    resource.image?.removeEventListener?.("load", resource.loadHandler);
    resource.image?.removeEventListener?.("error", resource.errorHandler);
    resource.loadHandler = null;
    resource.errorHandler = null;
  }

  function disposeResource(resource) {
    detachResourceListeners(resource);
    if (resource.image && resource.status === "loading") {
      try {
        resource.image.src = "";
      } catch {
        // Some test image doubles expose a read-only source.
      }
    }
    if (String(resource.source || "").startsWith("blob:")) revokeObjectUrl(resource.source);
    resource.objectIds.clear();
    resource.image = null;
  }

  return { retain, release, sync, statusForObject, diagnostics, destroy };
}

function defaultImageFactory() {
  return typeof globalThis.Image === "function" ? new globalThis.Image() : null;
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
