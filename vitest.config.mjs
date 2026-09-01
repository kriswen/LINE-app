import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          CHANNEL_SECRET: "test-channel-secret",
          CHANNEL_ACCESS_TOKEN: "test-access-token",
          ADMIN_PASSWORD_HASH: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
          CALENDAR_URL: "https://example.com/calendar.ics",
          DASHBOARD_URL: "https://example.com",
          TEST_MIGRATIONS: await readD1Migrations(path.join(root, "migrations")),
        },
      },
    })),
  ],
  test: {
    include: ["test/**/*.test.js"],
    setupFiles: ["./test/apply-migrations.js"],
  },
});
