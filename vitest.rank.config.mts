import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 동료 랭크 계산 전용 설정 (`npm run rank`)
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tools/rank.test.ts"],
  },
});
