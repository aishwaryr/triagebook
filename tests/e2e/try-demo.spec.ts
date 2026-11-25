import { expect, test } from "@playwright/test";

import { demo, expectPath } from "./support/auth";
import { sql } from "./support/db";

for (const path of ["/signin", "/signup"]) {
  test(`Try Demo on ${path} signs in as the demo account`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByText("Explore Triagebook without signing up."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Try Demo" }).click();

    await expectPath(page, "/");
    await expect(page.getByRole("banner")).toContainText(demo.name);
  });
}

// No UI shows demo visits to a non-admin, so this one checks the table directly.
test("Try Demo records a demo visit", async ({ page }) => {
  // The database clock, so a time gap between this machine and Neon can't hide the row.
  const [{ start }] = await sql`select now() as start`;

  await page.goto("/signin");
  await page.getByRole("button", { name: "Try Demo" }).click();
  await expectPath(page, "/");

  // The row is written in after(), once the response is sent, so poll for it.
  await expect
    .poll(async () => {
      const [{ count }] =
        await sql`select count(*)::int as count from demo_visits where created_at >= ${start}`;
      return count;
    })
    .toBeGreaterThanOrEqual(1);
});
