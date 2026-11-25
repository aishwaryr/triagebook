import { expect, test } from "@playwright/test";

import { bob, expectPath, signIn } from "./support/auth";

test("sends signed-out visitors from / to /signin", async ({ page }) => {
  await page.goto("/");

  await expectPath(page, "/signin");
});

test("sends signed-in users away from /signin and /signup", async ({
  page,
}) => {
  await signIn(page, bob);
  await expectPath(page, "/");

  await page.goto("/signin");
  await expectPath(page, "/");

  await page.goto("/signup");
  await expectPath(page, "/");
});

test("hides /admin from the demo account", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Try Demo" }).click();
  await expectPath(page, "/");

  const response = await page.goto("/admin");

  expect(response?.status()).toBe(404);
});
