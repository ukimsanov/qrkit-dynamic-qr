import standardWithTs from "eslint-config-standard-with-typescript";

export default [
  {
    ignores: ["dist"]
  },
  ...standardWithTs({
    parserOptions: {
      project: "./tsconfig.json"
    }
  })
];
