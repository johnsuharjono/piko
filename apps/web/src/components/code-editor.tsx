import { pikoEditorTheme, pikoLightEditorTheme } from "../editor-theme";
import { useTheme } from "./theme-toggle";
import { memo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
const extensions = [cpp()];
const plainExtensions: typeof extensions = [];
const basicSetup = {
  foldGutter: true,
  drawSelection: true,
  highlightActiveLine: true,
  autocompletion: true,
  bracketMatching: true,
  closeBrackets: true,
  foldKeymap: true,
};
// Circuit snapshots arrive 30 times per second. Keep them from reconfiguring the editor.
export default memo(function CodeEditor({
  value,
  onChange,
  readOnly = false,
  language = "cpp",
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  language?: "cpp" | "json";
}) {
  const { theme } = useTheme();
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={language === "cpp" ? extensions : plainExtensions}
      readOnly={readOnly}
      theme={theme === "dark" ? pikoEditorTheme : pikoLightEditorTheme}
      height="100%"
      aria-label={language === "cpp" ? "Arduino sketch" : "Circuit document"}
      basicSetup={basicSetup}
    />
  );
});
