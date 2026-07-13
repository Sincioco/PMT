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
