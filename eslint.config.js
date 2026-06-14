const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: ["dist/**", "templates/**", "examples/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Generated handler stubs and parsed specs are intentionally loosely typed.
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
