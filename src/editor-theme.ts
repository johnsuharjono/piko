import { EditorView } from "@uiw/react-codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
export const pikoEditorTheme = [
  EditorView.theme(
    {
      "&": { color: "#a6accd", backgroundColor: "#1b1e28" },
      ".cm-content": { caretColor: "#5de4c7" },
      ".cm-cursor,.cm-dropCursor": { borderLeftColor: "#5de4c7" },
      ".cm-gutters": {
        color: "#647091",
        backgroundColor: "#1b1e28",
        border: "none",
      },
      ".cm-activeLine": { backgroundColor: "#717cb418" },
      ".cm-activeLineGutter": { backgroundColor: "#252a37", color: "#5de4c7" },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
        { backgroundColor: "#506c8c88" },
      ".cm-selectionBackground": { backgroundColor: "#506c8c55" },
      ".cm-tooltip": {
        backgroundColor: "#252a37",
        color: "#e4f0fb",
        border: "1px solid #394156",
      },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "#343b50",
        color: "#5de4c7",
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "#303647",
        color: "#a6accd",
        border: "none",
      },
      "&.cm-focused .cm-matchingBracket": {
        color: "#5de4c7",
        backgroundColor: "#5de4c718",
      },
    },
    { dark: true },
  ),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "#f087bd" },
      {
        tag: [tags.typeName, tags.className, tags.namespace],
        color: "#add7ff",
      },
      {
        tag: [
          tags.function(tags.variableName),
          tags.function(tags.propertyName),
        ],
        color: "#5de4c7",
      },
      { tag: tags.string, color: "#5fb3a1" },
      { tag: [tags.number, tags.bool, tags.null], color: "#b7a2f5" },
      { tag: tags.comment, color: "#717c9e", fontStyle: "italic" },
      { tag: [tags.operator, tags.punctuation], color: "#89ddff" },
      { tag: tags.meta, color: "#add7ff" },
    ]),
  ),
];
