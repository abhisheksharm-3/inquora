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
              allow: [{ to: { element: { type: ["ui", "modules", "core"] } } }],
            },
            {
              from: [{ element: { type: "ui" } }],
              allow: [{ to: { element: { type: ["core"] } } }],
            },
            {
              from: [{ element: { type: "modules" } }],
              allow: [{ to: { element: { type: ["modules", "platform", "core"] } } }],
            },
            {
              from: [{ element: { type: "platform" } }],
              allow: [{ to: { element: { type: ["platform", "core"] } } }],
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
];

export default eslintConfig;
