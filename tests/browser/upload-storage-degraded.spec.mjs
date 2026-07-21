import { expect, test } from "@playwright/test";

test.describe("unavailable upload storage", () => {
  test.skip(
    process.env.PMT_EXPECT_UPLOAD_STORAGE_WARNING !== "1",
    "Requires PMT to be started with an unavailable upload-storage path."
  );

  test("keeps the login shell available and returns a clear upload error", async ({ page, request }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");

    await expect(page.locator(".login-screen-flyby")).toBeVisible();
    await expect(page.locator("[data-login-flyby]")).toBeVisible();
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.getByRole("heading", { name: "PMT", exact: true })).toBeVisible();
    await expect(page.locator("#loginName")).toBeVisible();
    await expect(page.locator("#loginPassword")).toBeVisible();
    const warning = page.locator("#systemWarning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("File upload storage is unavailable or cannot be reached");

    const response = await request.get("/uploads/missing-file.png");

    expect(response.status()).toBe(503);
    expect(response.headers()["content-type"] || "").not.toContain("text/html");

    const uploadResponse = await request.post("/api/uploads/test");
    expect(uploadResponse.status()).toBe(503);
    await expect(uploadResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining("File upload storage is unavailable or cannot be reached")
    });

    const deleteResponse = await request.delete("/api/tasks/999/attachments/999");
    expect(deleteResponse.status()).toBe(503);
  });
});
