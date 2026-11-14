import { useCallback, useEffect, useState } from "react";
import { parseCircuit, starterCircuit, type CircuitDoc } from "./model";
export const CIRCUIT_KEY = "piko.circuit.v1";
type History = {
  past: CircuitDoc[];
  present: CircuitDoc;
  future: CircuitDoc[];
};
export function useCircuit(
  onEdit: () => void,
  initialDoc?: CircuitDoc,
  storageKey: string | null = CIRCUIT_KEY,
) {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: initialDoc || starterCircuit(),
    future: [],
  }));
  const [loaded, setLoaded] = useState(!!initialDoc),
    [warning, setWarning] = useState("");
  useEffect(() => {
    if (!storageKey) {
      setLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const doc = parseCircuit(JSON.parse(raw));
        if (doc) setHistory({ past: [], present: doc, future: [] });
        else
          setWarning(
            "Saved circuit could not be restored. The starter has been loaded.",
          );
      }
    } catch {
      setWarning(
        "Circuit storage is unavailable. Keep this tab open to retain your wiring.",
      );
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded || !storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(history.present));
    } catch {
      setWarning("Could not save the circuit on this device.");
    }
  }, [history.present, loaded]);
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
    loaded,
    warning,
  };
}
