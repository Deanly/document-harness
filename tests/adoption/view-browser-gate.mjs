#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createFixture } from "../../runtime/document-harness-view/test/helpers.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const SERVER = path.join(REPO_ROOT, "runtime", "document-harness-view", "server.mjs");
const BASELINE = path.join(SCRIPT_DIR, "baselines", "reference-view-policy-1440.png");
const ARTIFACT_DIR = process.env.DOCUMENT_HARNESS_BROWSER_ARTIFACT_DIR
  ? path.resolve(process.env.DOCUMENT_HARNESS_BROWSER_ARTIFACT_DIR)
  : path.join(os.tmpdir(), "document-harness-browser-gate");

function moduleCandidates() {
  const values = [
    process.env.DOCUMENT_HARNESS_NODE_MODULES,
    ...(process.env.NODE_PATH ?? "").split(path.delimiter),
    path.join(SCRIPT_DIR, "node_modules"),
    path.join(REPO_ROOT, "node_modules")
  ];
  return [...new Set(values.filter(Boolean).map((value) => path.resolve(value)))];
}

function chromeExecutablePath() {
  return [
    process.env.DOCUMENT_HARNESS_CHROME_EXECUTABLE_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.GOOGLE_CHROME_BIN,
    process.env.CHROME_PATH
  ].find(Boolean);
}

async function loadBrowserDependencies() {
  const errors = [];
  for (const modulesPath of moduleCandidates()) {
    try {
      const require = createRequire(path.join(modulesPath, "document-harness-browser-gate.cjs"));
      const pixelmatchModule = await import(pathToFileURL(require.resolve("pixelmatch")).href);
      return {
        chromium: require("playwright").chromium,
        PNG: require("pngjs").PNG,
        pixelmatch: pixelmatchModule.default
      };
    } catch (error) {
      errors.push(`${modulesPath}: ${error.code ?? error.message}`);
    }
  }
  throw new Error([
    "Playwright browser gate dependencies are unavailable; release status is INSTALLED_NOT_VERIFIED.",
    "Install playwright, pngjs, and pixelmatch under tests/adoption/node_modules or set DOCUMENT_HARNESS_NODE_MODULES.",
    ...errors
  ].join("\n"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLease(root, child, errors) {
  const leasePath = path.join(root, ".document-harness", "runtime", "view", "lease.json");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`View exited before lease publication.\n${errors.value}`);
    try {
      return JSON.parse(await readFile(leasePath, "utf8"));
    } catch {
      await sleep(50);
    }
  }
  throw new Error(`View lease was not published.\n${errors.value}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(3000)
  ]);
}

async function buildBrowserFixture() {
  const fixture = await createFixture({ projectId: "browser-fixture", projectName: "Browser Fixture" });
  const sourceRef = fixture.catalog.policies[0].sourceRefs[0];
  fixture.catalog.policies = Array.from({ length: 12 }, (_, index) => ({
    ...fixture.catalog.policies[0],
    id: `POL-${String(index + 1).padStart(2, "0")}`,
    title: `Source authority policy ${index + 1}`,
    humanSummary: `Policy ${index + 1} keeps repository evidence explicit and reviewable.`,
    sourceRefs: [{ ...sourceRef }]
  }));
  fixture.catalog.guidelines = [{
    ...fixture.catalog.guidelines[0],
    policyRefs: fixture.catalog.policies.map((item) => item.id),
    sourceRefs: [{ ...sourceRef }]
  }];
  fixture.catalog.attention = [
    { id: "ATTN-CRITICAL", severity: "critical", title: "Critical source review", humanSummary: "Review the highest-risk candidate.", relatedRefs: ["POL-01"] },
    { id: "ATTN-DECISION", severity: "decision", title: "Human decision required", humanSummary: "Choose whether to promote the candidate.", relatedRefs: ["POL-02"] },
    { id: "ATTN-WARNING", severity: "warning", title: "Evidence warning", humanSummary: "Confirm the captured evidence scope.", relatedRefs: ["POL-03"] }
  ];
  await writeFile(
    path.join(fixture.root, "docs", "governance", "catalog.json"),
    `${JSON.stringify(fixture.catalog, null, 2)}\n`,
    "utf8"
  );
  return fixture;
}

async function assertTabs(page) {
  const expected = ["Overview", "Policies & Guidelines", "Review Queue", "Execution Status", "Evidence"];
  const tabs = page.getByRole("tab");
  assert.equal(await tabs.count(), expected.length);
  const labels = await tabs.allTextContents();
  assert.deepEqual(labels.map((value) => value.replace(/\s+\d+$/, "").trim()), expected);
  assert.equal(await page.locator("[class*='sidebar'], [id*='repository-selector'], [class*='repository-selector'], [id*='workspace-switcher']").count(), 0);
  assert.match(await page.getByLabel("Current repository").innerText(), /browser-fixture/i);

  const relations = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((tab) => ({
    id: tab.id,
    selected: tab.getAttribute("aria-selected"),
    controls: tab.getAttribute("aria-controls"),
    panelExists: Boolean(document.getElementById(tab.getAttribute("aria-controls"))),
    panelHidden: document.getElementById(tab.getAttribute("aria-controls"))?.hidden
  })));
  assert.equal(relations.filter((item) => item.selected === "true").length, 1);
  assert.ok(relations.every((item) => item.panelExists));
  assert.ok(relations.every((item) => item.selected === "true" ? item.panelHidden === false : item.panelHidden === true));

  await page.getByRole("tab", { name: /^Policies & Guidelines$/ }).press("Home");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-overview");
  await page.getByRole("tab", { name: /^Overview$/ }).press("End");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-evidence");
  await page.getByRole("tab", { name: /^Evidence$/ }).press("ArrowLeft");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-execution");
  await page.getByRole("tab", { name: /^Execution Status$/ }).press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-evidence");
  await page.getByRole("tab", { name: /^Overview$/ }).focus();
  await page.getByRole("tab", { name: /^Overview$/ }).press("Enter");
  assert.equal(await page.getByRole("tab", { name: /^Overview$/ }).getAttribute("aria-selected"), "true");
  await page.getByRole("tab", { name: /^Policies & Guidelines$/ }).focus();
  await page.getByRole("tab", { name: /^Policies & Guidelines$/ }).press("Space");
  assert.equal(await page.getByRole("tab", { name: /^Policies & Guidelines$/ }).getAttribute("aria-selected"), "true");
}

async function assertStateContinuity(page, fixture) {
  await page.getByRole("button", { name: "다음 정책 페이지" }).click();
  assert.match(await page.locator("#policy-pagination").innerText(), /6–10/);
  await page.locator("#policy-search").fill("policy 1");
  await page.locator("#policy-search").focus();
  const before = await page.locator("#policy-result-count").innerText();
  assert.match(before, /4개 결과/);

  fixture.catalog.direction.push("Polling must not interrupt the current reader state.");
  await writeFile(
    path.join(fixture.root, "docs", "governance", "catalog.json"),
    `${JSON.stringify(fixture.catalog, null, 2)}\n`,
    "utf8"
  );
  await page.waitForFunction(() => document.querySelector("#live-state")?.textContent?.includes("자동"), null, { timeout: 5000 });
  await sleep(2400);
  assert.equal(await page.locator("#policy-search").inputValue(), "policy 1");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "policy-search");

  await page.locator("#policy-search").fill("");
  await page.getByRole("button", { name: "POL-01 상세 열기" }).click();
  await page.locator("#refresh-button").click();
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole("tab", { name: /^Policies & Guidelines$/ }).getAttribute("aria-selected"), "true");
  assert.equal(await page.getByRole("button", { name: "POL-01 상세 닫기" }).getAttribute("aria-expanded"), "true");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "refresh-button");
}

async function assertResponsive(page) {
  for (const size of [{ width: 1440, height: 1024 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    const layout = await page.evaluate(() => ({
      innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyOverflow: document.documentElement.scrollWidth > innerWidth,
      tabCount: document.querySelectorAll('[role="tab"]').length,
      visiblePanels: [...document.querySelectorAll('[role="tabpanel"]')].filter((panel) => !panel.hidden).length,
      tableClientWidth: document.querySelector(".table-scroll")?.clientWidth ?? 0,
      tableScrollWidth: document.querySelector(".table-scroll")?.scrollWidth ?? 0
    }));
    assert.equal(layout.bodyOverflow, false, `body overflow at ${size.width}px`);
    assert.equal(layout.tabCount, 5);
    assert.equal(layout.visiblePanels, 1);
    if (size.width === 390) assert.ok(layout.tableScrollWidth > layout.tableClientWidth, "wide table must scroll inside its panel");
  }
}

async function compareScreenshot(page, PNG, pixelmatch) {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.getByRole("tab", { name: /^Policies & Guidelines$/ }).click();
  await page.locator("#clear-policy-filters").click();
  const opener = page.getByRole("button", { name: "POL-01 상세 열기" });
  if (await opener.count()) await opener.click();
  const actualPath = path.join(ARTIFACT_DIR, "reference-view-policy-1440.actual.png");
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({
    path: actualPath,
    mask: [page.locator("#last-updated"), page.locator("#live-state")]
  });

  if (process.env.UPDATE_VIEW_BASELINE === "1") {
    await mkdir(path.dirname(BASELINE), { recursive: true });
    await writeFile(BASELINE, await readFile(actualPath));
    return { updated: true, mismatchRatio: 0, actualPath };
  }

  const [expectedBuffer, actualBuffer] = await Promise.all([readFile(BASELINE), readFile(actualPath)]);
  const expected = PNG.sync.read(expectedBuffer);
  const actual = PNG.sync.read(actualBuffer);
  assert.equal(actual.width, expected.width, "screenshot width drift");
  assert.equal(actual.height, expected.height, "screenshot height drift");
  const diff = new PNG({ width: expected.width, height: expected.height });
  const mismatched = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, {
    threshold: 0.2,
    includeAA: false
  });
  const mismatchRatio = mismatched / (expected.width * expected.height);
  await writeFile(path.join(ARTIFACT_DIR, "reference-view-policy-1440.diff.png"), PNG.sync.write(diff));
  assert.ok(mismatchRatio <= 0.025, `visual mismatch ratio ${mismatchRatio.toFixed(4)} exceeds 0.025`);
  return { updated: false, mismatchRatio, actualPath };
}

async function main() {
  const { chromium, PNG, pixelmatch } = await loadBrowserDependencies();
  const fixture = await buildBrowserFixture();
  const canonicalRoot = await realpath(fixture.root);
  const canonicalConfig = await realpath(path.resolve(canonicalRoot, fixture.configPath));
  const errors = { value: "" };
  const server = spawn(process.execPath, [
    SERVER,
    "--root", canonicalRoot,
    "--config", canonicalConfig,
    "--port", "auto",
    "--start-token", randomUUID()
  ], {
    stdio: ["ignore", "ignore", "pipe"]
  });
  server.stderr.on("data", (chunk) => { errors.value += chunk.toString(); });
  let browser;
  try {
    const lease = await waitForLease(fixture.root, server, errors);
    browser = await chromium.launch({
      headless: true,
      executablePath: chromeExecutablePath()
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
    const consoleProblems = [];
    const externalRequests = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));
    page.on("request", (request) => {
      const target = new URL(request.url());
      if (target.origin !== lease.url) externalRequests.push(request.url());
    });

    await page.goto(`${lease.url}/#policies`, { waitUntil: "networkidle" });
    try {
      await page.waitForFunction(() => document.querySelector("#repository-name")?.textContent === "browser-fixture", null, { timeout: 5000 });
    } catch (error) {
      const body = (await page.locator("body").innerText()).slice(0, 1200);
      throw new Error(`${error.message}\nconsole=${consoleProblems.join(" | ")}\nbody=${body}`);
    }
    await assertTabs(page);
    await assertStateContinuity(page, fixture);
    await assertResponsive(page);
    const visual = await compareScreenshot(page, PNG, pixelmatch);
    assert.deepEqual(consoleProblems, [], `browser console problems:\n${consoleProblems.join("\n")}`);
    assert.deepEqual(externalRequests, [], `external requests:\n${externalRequests.join("\n")}`);

    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      status: "PLAN_READY",
      gateResult: "passed",
      gate: "reference-view-browser",
      tabs: 5,
      viewports: [1440, 768, 390],
      consoleProblems: 0,
      externalRequests: 0,
      visual
    }, null, 2)}\n`);
  } finally {
    if (browser) await browser.close();
    await stopChild(server);
    await rm(fixture.root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    schemaVersion: 1,
    status: "INSTALLED_NOT_VERIFIED",
    gate: "reference-view-browser",
    error: error.stack ?? error.message
  }, null, 2)}\n`);
  process.exit(1);
});
