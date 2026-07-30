import { diagram2AutoFormatCompactPlan } from "./diagram2-editor-relationships.js?v=20260730-diagram2-phase6-closure-v13";
import {
  createDiagram2CompactDiagnostics,
  diagram2CompactPhases
} from "./diagram2-route-costing.js?v=20260730-diagram2-phase6-closure-v13";

export async function runDiagram2CompactEngine(input = {}) {
  const startedAt = performanceNow();
  const state = input.state;
  const onProgress = typeof input.onProgress === "function" ? input.onProgress : () => {};
  const signal = input.signal || null;
  const phaseCount = diagram2CompactPhases.length;
  const progress = (phaseIndex, detail = {}) => {
    onProgress({
      phase: diagram2CompactPhases[Math.min(phaseIndex, phaseCount - 1)],
      phaseIndex,
      phaseCount,
      percent: Math.round((phaseIndex / Math.max(1, phaseCount - 1)) * 100),
      elapsedMs: performanceNow() - startedAt,
      ...detail
    });
  };
  const canceled = finalStatus => ({
    status: finalStatus,
    plan: null,
    diagnostics: createDiagram2CompactDiagnostics(state, state, {
      scoreRoutes: false,
      totalElapsedMs: performanceNow() - startedAt,
      finalStatus
    })
  });

  for (let index = 0; index < phaseCount - 2; index += 1) {
    if (signal?.aborted) return canceled("Canceled");
    progress(index);
    await yieldToMain();
  }

  if (signal?.aborted) return canceled("Canceled");
  progress(phaseCount - 2);
  await yieldToMain();
  const plan = diagram2AutoFormatCompactPlan(state, {
    preferredRootId: input.preferredRootId,
    selectionAfter: input.selectionAfter
  });
  await yieldToMain();

  if (signal?.aborted) return canceled("Canceled");
  if (plan?.validation?.allowed === false) {
    return {
      status: "Blocked",
      plan: null,
      diagnostics: {
        ...(plan.diagnostics || {}),
        message: plan.validation.message,
        totalElapsedMs: performanceNow() - startedAt,
        finalStatus: "Blocked"
      }
    };
  }
  if (!plan?.nextState) {
    return {
      status: "No change",
      plan: null,
      diagnostics: {
        ...(plan?.diagnostics || createDiagram2CompactDiagnostics(state, state, {
          scoreRoutes: false
        })),
        totalElapsedMs: performanceNow() - startedAt,
        finalStatus: "No change"
      }
    };
  }

  const relationshipRoutes = Array.isArray(plan.nextState.compactEntityRelationshipRoutes)
    ? plan.nextState.compactEntityRelationshipRoutes
    : [];
  progress(phaseCount - 1);
  return {
    status: "Completed",
    plan: {
      ...plan,
      diagnostics: {
        ...(plan.diagnostics || {}),
        exactRouteCount: relationshipRoutes.length,
        totalElapsedMs: performanceNow() - startedAt,
        finalStatus: "Completed"
      }
    },
    diagnostics: {
      ...(plan.diagnostics || {}),
      exactRouteCount: relationshipRoutes.length,
      totalElapsedMs: performanceNow() - startedAt,
      finalStatus: "Completed"
    }
  };
}

function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function performanceNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
