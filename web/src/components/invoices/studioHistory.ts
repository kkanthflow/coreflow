import type { InvoiceStudioDocV2 } from '../../types/invoiceStudio';

export interface StudioHistoryState {
  past: InvoiceStudioDocV2[];
  present: InvoiceStudioDocV2;
  future: InvoiceStudioDocV2[];
}

export function createInitialHistory(initialDoc: InvoiceStudioDocV2): StudioHistoryState {
  return {
    past: [],
    present: initialDoc,
    future: [],
  };
}

export function pushHistoryState(
  history: StudioHistoryState,
  newDoc: InvoiceStudioDocV2,
  maxHistory: number = 50
): StudioHistoryState {
  // If identical, do not push
  if (JSON.stringify(history.present.elements) === JSON.stringify(newDoc.elements)) {
    return {
      ...history,
      present: newDoc,
    };
  }

  const nextPast = [...history.past, history.present];
  if (nextPast.length > maxHistory) {
    nextPast.shift();
  }

  return {
    past: nextPast,
    present: {
      ...newDoc,
      revision: history.present.revision + 1,
      updatedAt: new Date().toISOString(),
    },
    future: [],
  };
}

export function undoHistory(history: StudioHistoryState): StudioHistoryState {
  if (history.past.length === 0) return history;

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, history.past.length - 1);

  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory(history: StudioHistoryState): StudioHistoryState {
  if (history.future.length === 0) return history;

  const next = history.future[0];
  const newFuture = history.future.slice(1);

  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}

export function canUndo(history: StudioHistoryState): boolean {
  return history.past.length > 0;
}

export function canRedo(history: StudioHistoryState): boolean {
  return history.future.length > 0;
}
