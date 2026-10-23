import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    name: "unit",
    include: ["src/__tests__/unit/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
