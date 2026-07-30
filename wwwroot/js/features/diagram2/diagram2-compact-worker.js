import { runDiagram2CompactEngine } from "./diagram2-compact-engine.js?v=20260730-diagram2-phase6-v1";

let canceled = false;

self.onmessage = async event => {
  const message = event.data || {};
  if (message.type === "cancel") {
    canceled = true;
    return;
  }
  if (message.type !== "run") return;
  canceled = false;
  const signal = {
    get aborted() {
      return canceled;
    }
  };
  try {
    const result = await runDiagram2CompactEngine({
      state: message.state,
      preferredRootId: message.preferredRootId,
      selectionAfter: message.selectionAfter,
      signal,
      onProgress: progress => self.postMessage({ type: "progress", progress })
    });
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message || "Compact failed."
    });
  }
};
