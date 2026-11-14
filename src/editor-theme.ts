import { EditorView } from "@uiw/react-codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
function editorTheme(dark: boolean) { return [
  EditorView.theme(
    {
      "&": { color: "var(--foreground)", backgroundColor: "var(--background)" },
      ".cm-content": { caretColor: "var(--primary)" },
      ".cm-cursor,.cm-dropCursor": { borderLeftColor: "var(--primary)" },
      ".cm-gutters": {
        color: "var(--muted)",
        backgroundColor: "var(--background)",
        border: "none",
      },
      ".cm-activeLine": { backgroundColor: "var(--active-line)" },
      ".cm-activeLineGutter": { backgroundColor: "var(--raised)", color: "var(--primary)" },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
        { backgroundColor: "var(--selection-focused)" },
      ".cm-selectionBackground": { backgroundColor: "var(--selection)" },
      ".cm-tooltip": {
        backgroundColor: "var(--raised)",
        color: "var(--bright)",
        border: "1px solid var(--border)",
      },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "var(--raised)",
        color: "var(--primary)",
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "var(--border)",
        color: "var(--foreground)",
        border: "none",
      },
      "&.cm-focused .cm-matchingBracket": {
        color: "var(--primary)",
        backgroundColor: "var(--active-line)",
      },
    },
    { dark },
  ),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "var(--syntax-keyword)" },
      {
        tag: [tags.typeName, tags.className, tags.namespace],
        color: "var(--syntax-type)",
      },
      {
        tag: [
          tags.function(tags.variableName),
          tags.function(tags.propertyName),
        ],
        color: "var(--primary)",
      },
      { tag: tags.string, color: "var(--syntax-string)" },
      { tag: [tags.number, tags.bool, tags.null], color: "var(--syntax-number)" },
      { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
      { tag: [tags.operator, tags.punctuation], color: "var(--syntax-punctuation)" },
      { tag: tags.meta, color: "var(--syntax-type)" },
    ]),
  ),
];

}
export const pikoEditorTheme = editorTheme(true);
export const pikoLightEditorTheme = editorTheme(false);
