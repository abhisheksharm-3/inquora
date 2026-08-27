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
              allow: [{ to: { element: { type: ["ui", "modules", "http", "core"] } } }],
            },
            {
              from: [{ element: { type: "ui" } }],
              allow: [{ to: { element: { type: ["core"] } } }],
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
    // The old component tree, which the UI slice replaces. These five findings are
    // real, and all of them are in files scheduled for deletion: three effects that
    // set state synchronously, a component created during render, and manual
    // memoization the compiler cannot preserve. They are warnings so CI blocks on
    // new code rather than on code on its way out. Delete this block when the UI
    // slice lands, and the rules return to errors everywhere.
    files: ["src/components/**/*.tsx", "src/hooks/**/*.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default eslintConfig;
