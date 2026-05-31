import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("shows login page for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/login/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revenue Metrics" })).toBeVisible();
  });

  test("shows demo account buttons", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Manager" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Viewer" })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Invalid credentials|Login failed/)).toBeVisible();
  });

  test("validates email format", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "not-an-email");
    await page.fill('input[type="password"]', "password");
    // HTML5 validation should prevent submission, or server returns 400
    const submitBtn = page.getByRole("button", { name: "Sign in" });
    await submitBtn.click();
    // Either the browser blocks it or we get an error
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Dashboard access (requires auth)", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin via API
    await page.goto("/login");
    await page.getByRole("button", { name: "Admin" }).click();
    await page.waitForURL(/dashboard/);
  });

  test("redirects to dashboard after login", async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
  });

  test("shows sidebar navigation", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Revenue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("shows KPI cards", async ({ page }) => {
    await expect(page.getByText("Monthly Recurring Revenue")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Active Users")).toBeVisible();
    await expect(page.getByText("Churn Rate")).toBeVisible();
  });

  test("filter bar is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /[A-Z][a-z]{2} \d+.*[A-Z][a-z]{2} \d+/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Plan/ })).toBeVisible();
  });

  test("can navigate to revenue page", async ({ page }) => {
    await page.getByRole("link", { name: "Revenue" }).click();
    await expect(page).toHaveURL(/revenue/);
    await expect(page.getByRole("heading", { name: "Revenue Analytics" })).toBeVisible();
  });

  test("can navigate to reports page", async ({ page }) => {
    await page.getByRole("link", { name: "Reports" }).click();
    await expect(page).toHaveURL(/reports/);
    await expect(page.getByRole("heading", { name: "Report Builder" })).toBeVisible();
  });
});

test.describe("RBAC - Viewer restrictions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Viewer" }).click();
    await page.waitForURL(/dashboard/);
  });

  test("viewer does not see admin menu", async ({ page }) => {
    await expect(page.getByText("User Management")).not.toBeVisible();
  });

  test("viewer sees their role in header", async ({ page }) => {
    await expect(page.getByRole("banner").getByText("viewer", { exact: true })).toBeVisible();
  });
});

test.describe("Reports CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Manager" }).click();
    await page.waitForURL(/dashboard/);
    await page.goto("/dashboard/reports");
  });

  test("can create a report", async ({ page }) => {
    const reportName = `Test Report ${Date.now()}`;
    await page.fill('input[placeholder="My Revenue Report"]', reportName);
    await page.getByRole("button", { name: "Save Report" }).click();
    await expect(page.getByText(reportName)).toBeVisible({ timeout: 5000 });
  });

  test("can delete a report", async ({ page }) => {
    // Create first
    const reportName = `Delete Me ${Date.now()}`;
    await page.fill('input[placeholder="My Revenue Report"]', reportName);
    await page.getByRole("button", { name: "Save Report" }).click();
    await expect(page.getByText(reportName)).toBeVisible({ timeout: 5000 });

    // Then delete
    const row = page.getByText(reportName).locator("xpath=ancestor::div[contains(@class, 'px-5') and contains(@class, 'py-4')][1]");
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(reportName)).not.toBeVisible({ timeout: 5000 });
  });
});
