import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".workbuddy/**",
      ".cache/**",
      ".appdata/**",
      ".localappdata/**",
      ".github-sync-worktree/**",
      ".upload-worktree/**",
      ".upload-worktree-test/**",
      "node_modules/**"
    ]
  },
  ...nextVitals,
  ...nextTypescript
];

export default eslintConfig;
