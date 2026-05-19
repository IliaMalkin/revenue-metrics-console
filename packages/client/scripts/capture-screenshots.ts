import { chromium, type Browser } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
const screenshotDir = resolve(repoRoot, "docs/screenshots");
const appUrl = process.env.APP_URL ?? "http://localhost:5173";
const apiHealthUrl = process.env.API_HEALTH_URL ?? "http://localhost:3001/health";

const started: ChildProcess[] = [];
let browser: Browser | undefined;

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitFor(url: string, label: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isReachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} did not become reachable at ${url}`);
}

function start(command: string, args: string[]): void {
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  started.push(child);
}

async function ensureServers(): Promise<void> {
  if (!(await isReachable(apiHealthUrl))) {
    start("pnpm", ["--filter", "server", "dev"]);
    await waitFor(apiHealthUrl, "API server");
  }

  if (!(await isReachable(appUrl))) {
    start("pnpm", ["--filter", "client", "dev"]);
    await waitFor(appUrl, "Vite client");
  }
}

async function login(browser: Browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(15000);
  await page.goto(`${appUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Admin" }).click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  return page;
}

async function capture(): Promise<void> {
  mkdirSync(screenshotDir, { recursive: true });
  await ensureServers();

  browser = await chromium.launch();
  const page = await login(browser);

  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(screenshotDir, "overview.png"), fullPage: true });

  await page.goto(`${appUrl}/dashboard/users`, { waitUntil: "domcontentloaded" });
  await page.getByText("Retention Cohort Analysis").waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(screenshotDir, "cohorts.png"), fullPage: true });

  await page.goto(`${appUrl}/admin/users`, { waitUntil: "domcontentloaded" });
  await page.getByText("User Management").waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(screenshotDir, "admin.png"), fullPage: true });

  await page.goto(`${appUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(screenshotDir, "overview-dark.png"), fullPage: true });

  await browser.close();
  browser = undefined;
}

capture()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void browser?.close();
    for (const child of started) {
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        child.kill();
      }
    }
  });
