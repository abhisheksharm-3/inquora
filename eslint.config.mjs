import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "src/core/database.types.ts"] },
  ...coreWebVitals,
  ...typescript,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        // A server action is the transport edge for the interface, the way a route
        // handler is for a client. A form component calling one is the framework's
        // own pattern, so actions are their own element that ui may reach, while
        // the rest of app stays closed to it.
        //
        // Declared before app because the first matching pattern wins, and with
        // mode "file" because the default matches a folder, which never ends in
        // actions.ts.
        { type: "actions", pattern: "src/app/**/actions.ts", mode: "file" },
        { type: "app", pattern: "src/app/**" },
        { type: "ui", pattern: "src/ui/**" },
        { type: "modules", pattern: "src/server/modules/**" },
        // HTTP framing — problem+json and SSE — is the transport edge's own
        // vocabulary, so a route handler may use it directly. Everything else in
        // platform stays behind a module.
        { type: "http", pattern: "src/server/platform/http/**" },
        { type: "platform", pattern: "src/server/platform/**" },
        { type: "core", pattern: "src/core/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: [{ element: { type: "app" } }],
              allow: [{ to: { element: { type: ["ui", "modules", "http", "actions", "core"] } } }],
            },
            {
              from: [{ element: { type: "ui" } }],
              allow: [{ to: { element: { type: ["ui", "actions", "core"] } } }],
            },
            {
              from: [{ element: { type: "modules" } }],
              allow: [{ to: { element: { type: ["modules", "platform", "http", "core"] } } }],
            },
            {
              from: [{ element: { type: "platform" } }],
              allow: [{ to: { element: { type: ["platform", "http", "core"] } } }],
            },
            {
              from: [{ element: { type: "actions" } }],
              allow: [{ to: { element: { type: ["modules", "http", "core"] } } }],
            },
            {
              from: [{ element: { type: "http" } }],
              allow: [{ to: { element: { type: ["core"] } } }],
            },
            {
              from: [{ element: { type: "core" } }],
              allow: [{ to: { element: { type: ["core"] } } }],
            },
          ],
        },
      ],
    },
  },
  {
    // The surviving old components, which the UI slice replaces. The findings are
    // real — an effect that sets state synchronously — and they are in files
    // scheduled for rewrite. Warnings, so CI blocks on new code rather than on
    // code on its way out. Delete this block when the UI slice lands, and the
    // rules return to errors everywhere.
    files: ["src/ui/**/*.tsx", "src/ui/**/*.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default eslintConfig;
