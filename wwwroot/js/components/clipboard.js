export async function copyTextToClipboard(text, sourceControl = null) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the selection-based copy path below.
  }

  return copyTextToClipboardFallback(text, sourceControl);
}

export async function copyHtmlToClipboard(html, plainText, sourceControl = null) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" })
        })
      ]);
      return true;
    }
  } catch {
    // Fall back to the selection-based rich copy path below.
  }

  return copyHtmlToClipboardFallback(html, sourceControl);
}

function copyTextToClipboardFallback(text, sourceControl = null) {
  const textarea = sourceControl || document.createElement("textarea");
  const selectionStart = typeof textarea.selectionStart === "number" ? textarea.selectionStart : null;
  const selectionEnd = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : null;
  if (!sourceControl) {
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    (document.querySelector("dialog[open]") || document.body).appendChild(textarea);
  }

  textarea.focus({ preventScroll: true });
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  if (sourceControl && selectionStart !== null && selectionEnd !== null) {
    textarea.setSelectionRange(selectionStart, selectionEnd);
  } else {
    textarea.remove();
  }

  return copied;
}

function copyHtmlToClipboardFallback(html, sourceControl = null) {
  const copyArea = document.createElement("div");
  copyArea.contentEditable = "true";
  copyArea.innerHTML = html;
  copyArea.style.position = "fixed";
  copyArea.style.top = "0";
  copyArea.style.left = "-10000px";
  copyArea.style.width = "700px";
  (document.querySelector("dialog[open]") || document.body).appendChild(copyArea);

  const selection = window.getSelection();
  const previousRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  const range = document.createRange();
  range.selectNodeContents(copyArea);
  selection?.removeAllRanges();
  selection?.addRange(range);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  selection?.removeAllRanges();
  previousRanges.forEach(previousRange => selection?.addRange(previousRange));
  copyArea.remove();
  sourceControl?.focus({ preventScroll: true });
  return copied;
}
