import { useCallback, useState } from "react";
import { starterCircuit, type CircuitDoc } from "./model";
type History = {
  past: CircuitDoc[];
  present: CircuitDoc;
  future: CircuitDoc[];
};
export function useCircuit(
  onEdit: () => void,
  initialDoc?: CircuitDoc,
) {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: initialDoc || starterCircuit(),
    future: [],
  }));
  const update = useCallback(
    (doc: CircuitDoc) => {
      onEdit();
      setHistory((h) => ({
        past: [...h.past, h.present].slice(-40),
        present: doc,
        future: [],
      }));
    },
    [onEdit],
  );
  const undo = () => {
    if (!history.past.length) return;
    onEdit();
    setHistory((h) => ({
      past: h.past.slice(0, -1),
      present: h.past.at(-1)!,
      future: [h.present, ...h.future],
    }));
  };
  const redo = () => {
    if (!history.future.length) return;
    onEdit();
    setHistory((h) => ({
      past: [...h.past, h.present],
      present: h.future[0],
      future: h.future.slice(1),
    }));
  };
  return {
    doc: history.present,
    update,
    undo,
    redo,
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
  };
}
