// The project ships no ESLint/Biome config, so the pre-commit gate is the same
// type check `npm run verify` runs. A function is used so lint-staged does not
// append the staged file paths to `tsc`, which would bypass tsconfig.json.
export default {
  '*.{ts,vue}': () => 'npm run typecheck',
};
