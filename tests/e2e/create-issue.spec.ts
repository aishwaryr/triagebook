import { expect, test } from "@playwright/test";

import { alice, expectPath, signIn } from "./support/auth";
import { choose, deleteIssues } from "./support/issues";

// Every issue this spec creates starts with this, so cleanup can't touch real data.
const TITLE_PREFIX = "E2E issue";

test.beforeEach(async ({ page }) => {
  await signIn(page, alice);
  await expectPath(page, "/");
  await page.goto("/issues/new");
});

test.afterAll(async () => {
  await deleteIssues(TITLE_PREFIX);
});

test("creates an issue, opens it, and shows it in the list", async ({
  page,
}) => {
  const title = `${TITLE_PREFIX} ${Date.now().toString(36)}`;

  await page.getByRole("textbox", { name: "Title" }).fill(title);
  await page
    .getByRole("textbox", { name: "Description" })
    .fill("Created by Playwright");
  await choose(page, "Status", "Todo");
  await choose(page, "Priority", "High");
  await page.getByRole("button", { name: "Create issue" }).click();

  await expect(page).toHaveURL(/\/issues\/ISS-\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page.getByRole("link", { name: "← All issues" }).click();
  await expectPath(page, "/issues");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("shows a field error and keeps the input", async ({ page }) => {
  const title = page.getByRole("textbox", { name: "Title" });
  const description = page.getByRole("textbox", { name: "Description" });

  // Spaces pass the browser's `required` check, so only the server can reject them.
  await title.fill("   ");
  await description.fill("Keep me");
  await choose(page, "Status", "Todo");
  await choose(page, "Priority", "High");
  await page.getByRole("button", { name: "Create issue" }).click();

  // Not getByRole("alert"): Next's route announcer is an alert too.
  await expect(title).toHaveAccessibleDescription("Title is required");
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expectPath(page, "/issues/new");

  await expect(description).toHaveValue("Keep me");
  await expect(page.getByRole("combobox", { name: "Status" })).toContainText(
    "Todo",
  );
  await expect(page.getByRole("combobox", { name: "Priority" })).toContainText(
    "High",
  );
});
