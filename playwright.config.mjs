import { defineConfig } from "@playwright/test";

const port = Number(process.env.PMT_TEST_PORT || 5056);
const baseURL = process.env.PMT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  reporter: [["list"]],
  outputDir: "test-results/playwright",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry"
  },
  webServer: process.env.PMT_BASE_URL
    ? undefined
    : {
        command: `dotnet run --no-launch-profile --urls http://127.0.0.1:${port}`,
        url: baseURL,
        reuseExistingServer: true,
        env: {
          ASPNETCORE_ENVIRONMENT: "Development",
          Logging__LogLevel__Default: "Warning",
          "Logging__LogLevel__Microsoft.AspNetCore": "Warning"
        },
        timeout: 120000,
        stdout: "pipe",
        stderr: "pipe"
      },
  projects: [
    {
      name: "chromium-1366",
      use: {
        browserName: "chromium",
        viewport: { width: 1366, height: 768 }
      }
    },
    {
      name: "chromium-1920",
      use: {
        browserName: "chromium",
        viewport: { width: 1920, height: 1080 }
      }
    }
  ]
});
