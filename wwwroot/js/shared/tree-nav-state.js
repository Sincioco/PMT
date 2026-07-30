export function captureTreeNavState(root, options = {}) {
  const pane = root?.querySelector?.(options.paneSelector || "");
  if (!pane) return null;

  const itemSelector = options.itemSelector || "[data-id]";
  const focusedItem = root.ownerDocument?.activeElement?.closest?.(itemSelector);
  const selectedItem = root.querySelector(options.selectedSelector || "");
  return {
    identity: options.identity || pane.dataset.treeNavIdentity || "",
    scrollTop: pane.scrollTop,
    scrollLeft: pane.scrollLeft,
    focusedId: treeNavItemId(focusedItem),
    selectedId: treeNavItemId(selectedItem)
  };
}

export function restoreTreeNavState(root, snapshot, options = {}) {
  const pane = root?.querySelector?.(options.paneSelector || "");
  if (!pane) return false;

  const identity = options.identity || pane.dataset.treeNavIdentity || "";
  if (snapshot?.identity && identity && snapshot.identity !== identity) return false;

  const scrollTop = finiteNumber(snapshot?.scrollTop, pane.scrollTop);
  const scrollLeft = finiteNumber(snapshot?.scrollLeft, pane.scrollLeft);
  pane.scrollTop = scrollTop;
  pane.scrollLeft = scrollLeft;

  const focusedItem = findTreeNavItem(root, options.itemSelector, snapshot?.focusedId);
  if (focusedItem && focusedItem.disabled !== true) {
    focusedItem.focus({ preventScroll: true });
    pane.scrollTop = scrollTop;
    pane.scrollLeft = scrollLeft;
  }

  if (options.revealSelected === true) {
    const selectedId = String(options.selectedId || snapshot?.selectedId || "");
    revealTreeNavItem(pane, findTreeNavItem(root, options.itemSelector, selectedId));
  }
  return true;
}

function findTreeNavItem(root, selector, id) {
  const itemId = String(id || "");
  if (!itemId || !selector) return null;
  return [...root.querySelectorAll(selector)]
    .find(item => treeNavItemId(item) === itemId) || null;
}

function treeNavItemId(item) {
  return String(item?.dataset?.id || "");
}

function revealTreeNavItem(pane, item) {
  if (!pane || !item) return;
  const paneBounds = pane.getBoundingClientRect();
  const itemBounds = item.getBoundingClientRect();

  if (itemBounds.top < paneBounds.top) {
    pane.scrollTop += itemBounds.top - paneBounds.top;
  } else if (itemBounds.bottom > paneBounds.bottom) {
    pane.scrollTop += itemBounds.bottom - paneBounds.bottom;
  }

  if (itemBounds.left < paneBounds.left) {
    pane.scrollLeft += itemBounds.left - paneBounds.left;
  } else if (itemBounds.right > paneBounds.right) {
    pane.scrollLeft += itemBounds.right - paneBounds.right;
  }
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
