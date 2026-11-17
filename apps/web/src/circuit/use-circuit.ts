import { useCallback, useRef, useState } from "react";
import { starterCircuit, type CircuitDoc } from "./model";
type History = {
  past: CircuitDoc[];
  present: CircuitDoc;
  future: CircuitDoc[];
};
export function useCircuit(
  onEdit: () => void,
  initialDoc?: CircuitDoc,
  onDocumentChange?: (doc: CircuitDoc) => void,
) {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: initialDoc || starterCircuit(),
    future: [],
  }));
  const current = useRef(history);
  const callbacks = useRef({ onEdit, onDocumentChange });
  callbacks.current = { onEdit, onDocumentChange };
  const commit = useCallback((next: History) => {
    current.current = next;
    callbacks.current.onEdit();
    callbacks.current.onDocumentChange?.(next.present);
    setHistory(next);
  }, []);
  const update = useCallback(
    (doc: CircuitDoc) => {
      const h = current.current;
      commit({
        past: [...h.past, h.present].slice(-40),
        present: doc,
        future: [],
      });
    },
    [commit],
  );
  const undo = useCallback(() => {
    const h = current.current;
    if (!h.past.length) return;
    commit({
      past: h.past.slice(0, -1),
      present: h.past.at(-1)!,
      future: [h.present, ...h.future],
    });
  }, [commit]);
  const redo = useCallback(() => {
    const h = current.current;
    if (!h.future.length) return;
    commit({
      past: [...h.past, h.present].slice(-40),
      present: h.future[0],
      future: h.future.slice(1),
    });
  }, [commit]);
  return {
    doc: history.present,
    update,
    undo,
    redo,
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
