import { expect, type Page, test } from "@playwright/test";

import { alice, expectPath, signIn } from "./support/auth";

const html = (page: Page) => page.locator("html");

test.beforeEach(async ({ page }) => {
  await signIn(page, alice);
  await expectPath(page, "/");
});

test("starts dark; the button switches to light and back", async ({ page }) => {
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html(page)).toHaveClass(/\bdark\b/);
});

test("light lasts across pages, and a reload starts dark again", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Switch to light theme" }).click();

  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Issues" })
    .click();
  await expectPath(page, "/issues");
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await expect(
    page.getByRole("button", { name: "Switch to dark theme" }),
  ).toBeVisible();

  await page.reload();
  await expect(html(page)).toHaveClass(/\bdark\b/);
});
