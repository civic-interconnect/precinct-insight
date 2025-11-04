// eslint.config.js
import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended, // Use ESLint's recommended rules as base
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        L: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      indent: ["error", 2],
      quotes: ["error", "double"],
      semi: ["error", "always"],
    },
  },
];