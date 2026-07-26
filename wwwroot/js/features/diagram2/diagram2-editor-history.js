export function createDiagram2CommandHistory(options = {}) {
  const limit = positiveInteger(options.limit, 100);
  let entries = [];
  let index = -1;
  let revisionSequence = 0;
  let currentRevision = 0;
  let savedRevision = 0;

  async function execute(command, context = {}) {
    if (!isCommand(command)) return status();

    const applied = typeof command.apply === "function"
      ? await command.apply(context)
      : true;
    if (applied === false) return status();

    entries = entries.slice(0, index + 1);
    const previous = entries[index];
    if (canMergeCommands(previous, command)) {
      const merged = previous.mergeWith(command);
      if (isCommand(merged)) {
        merged.revision = ++revisionSequence;
        entries[index] = merged;
        currentRevision = merged.revision;
        return status();
      }
    }

    const entry = {
      ...command,
      revision: ++revisionSequence
    };
    entries.push(entry);
    if (entries.length > limit) entries.shift();
    index = entries.length - 1;
    currentRevision = entry.revision;
    return status();
  }

  async function undo(context = {}) {
    if (index < 0) return status();
    const command = entries[index];
    if (typeof command.undo === "function") await command.undo(context);
    index -= 1;
    currentRevision = index >= 0 ? entries[index].revision || 0 : 0;
    return status();
  }

  async function redo(context = {}) {
    if (index >= entries.length - 1) return status();
    const command = entries[index + 1];
    if (typeof command.redo === "function") await command.redo(context);
    index += 1;
    currentRevision = command.revision || 0;
    return status();
  }

  function reset(options = {}) {
    entries = [];
    index = -1;
    revisionSequence = 0;
    currentRevision = 0;
    savedRevision = options.saved === false ? -1 : 0;
    return status();
  }

  function markSaved() {
    savedRevision = currentRevision;
    return status();
  }

  function status() {
    return {
      canUndo: index >= 0,
      canRedo: index < entries.length - 1,
      dirty: currentRevision !== savedRevision,
      entryCount: entries.length,
      index,
      currentRevision,
      savedRevision,
      limit
    };
  }

  return {
    execute,
    undo,
    redo,
    reset,
    markSaved,
    status,
    entries: () => entries.slice()
  };
}

function isCommand(command) {
  return Boolean(command && typeof command === "object" && command.label);
}

function canMergeCommands(previous, next) {
  if (!previous || !next || typeof previous.mergeWith !== "function") return false;
  if (!previous.mergeKey || previous.mergeKey !== next.mergeKey) return false;
  const windowMs = positiveInteger(next.mergeWindowMs, 0);
  if (!windowMs) return false;
  const previousTime = Number(previous.createdAt || 0);
  const nextTime = Number(next.createdAt || 0);
  return previousTime > 0 && nextTime > 0 && nextTime - previousTime <= windowMs;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
