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
const LONG_POLICY_ID = "POL-VEHICLE-CONTROL-BOUNDARY";
const LONG_GUIDELINE_ID = "GUIDE-REPRODUCIBLE-HARDWARE-EVIDENCE";
const LONG_ATTENTION_ID = "ATTN-EXECUTION-LOOP-OPT-IN";
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
  const fixture = await createFixture({ projectId: "browser-fixture", projectName: "브라우저 검증 저장소" });
  fixture.config.project.description = "한글 화면과 긴 기술 식별자 배치를 검증하는 저장소입니다.";
  await writeFile(
    path.join(fixture.root, "config", "view.json"),
    `${JSON.stringify(fixture.config, null, 2)}\n`,
    "utf8"
  );
  const sourceRef = fixture.catalog.policies[0].sourceRefs[0];
  fixture.catalog.policies = Array.from({ length: 12 }, (_, index) => ({
    ...fixture.catalog.policies[0],
    id: index === 0 ? LONG_POLICY_ID : `POL-${String(index + 1).padStart(2, "0")}`,
    title: `차량 정책 후보 ${index + 1}`,
    humanSummary: `정책 후보 ${index + 1}은 저장소 근거와 사람의 검토 경계를 명확하게 유지합니다.`,
    sourceRefs: [{ ...sourceRef }]
  }));
  fixture.catalog.guidelines = [{
    ...fixture.catalog.guidelines[0],
    id: LONG_GUIDELINE_ID,
    title: "재현 가능한 하드웨어 근거를 남깁니다",
    humanSummary: "차량 제어 경계를 바꾸기 전에 재현 가능한 점검 결과와 근거를 기록합니다.",
    policyRefs: fixture.catalog.policies.map((item) => item.id),
    sourceRefs: [{ ...sourceRef }]
  }];
  fixture.catalog.direction = ["차량 제어 경계를 지키고, 모든 변경을 사람이 검토할 수 있는 근거와 연결합니다."];
  fixture.catalog.migration.approvalRule = "AI가 추출한 정책 후보는 사람의 결정 영수증이 있기 전까지 승인되지 않습니다.";
  fixture.catalog.attention = [
    { id: LONG_ATTENTION_ID, severity: "critical", title: "실행 루프 적용 여부를 결정해 주세요", humanSummary: "위험도가 높은 차량 제어 작업에 실행 루프를 적용할 범위를 사람이 결정해야 합니다.", relatedRefs: [LONG_POLICY_ID, LONG_GUIDELINE_ID, "I0001"] },
    { id: "ATTN-HUMAN-DECISION-REQUIRED", severity: "decision", title: "정책 승인이 필요합니다", humanSummary: "후보를 유효 정책으로 승격할지 사람이 결정해야 합니다.", relatedRefs: ["POL-02"] },
    { id: "ATTN-SOURCE-EVIDENCE-REVIEW", severity: "warning", title: "근거 범위를 확인해 주세요", humanSummary: "캡처된 근거가 변경 범위를 충분히 설명하는지 확인합니다.", relatedRefs: ["POL-03"] }
  ];
  await writeFile(
    path.join(fixture.root, "docs", "governance", "catalog.json"),
    `${JSON.stringify(fixture.catalog, null, 2)}\n`,
    "utf8"
  );
  fixture.initiativeRegister.initiatives[0] = {
    ...fixture.initiativeRegister.initiatives[0],
    title: "차량 제어 경계의 실증 준비",
    humanSummary: "정책과 지침을 브라우저 검증 프로젝트의 실행 방향으로 연결합니다.",
    outcome: "연결 프로젝트가 읽기 전용 차량 경계와 근거 계약을 지키며 검증됩니다.",
    currentFocus: "정책·지침·프로젝트 연결을 사람이 검토합니다.",
    policyRefs: [LONG_POLICY_ID],
    policyRelationships: [{
      policyId: LONG_POLICY_ID,
      relation: "constrained-by",
      rationale: "읽기 전용 차량 제어 경계를 추진안의 비가역 제약으로 유지합니다.",
      exceptionRef: null
    }],
    guidelineRefs: [LONG_GUIDELINE_ID],
    guidelineRelationships: [{
      guidelineId: LONG_GUIDELINE_ID,
      adoption: "recommended",
      rationale: "재현 가능한 하드웨어 근거 수집 방식을 검토 후보로 연결합니다.",
      verification: "연결 프로젝트가 제출한 점검 결과와 source hash를 사람이 검토합니다."
    }],
    guidelineDisposition: "needs_review",
    guidelineDispositionReason: "연결 지침이 아직 검토 요청 상태이므로 적용 여부를 사람이 결정해야 합니다."
  };
  await writeFile(
    path.join(fixture.root, "docs", "governance", "initiatives.json"),
    `${JSON.stringify(fixture.initiativeRegister, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(fixture.root, "docs", "initiatives", "I0001-fixture.md"),
    `---\ntype: initiative\ndoc_id: I0001\ninitiative_contract: v1\nstatus: draft\napproval_status: review_requested\nissuance_approval_ref: DECISION-FIXTURE\napproval_ref:\npolicy_refs:\n  - ${LONG_POLICY_ID}\nguideline_refs:\n  - ${LONG_GUIDELINE_ID}\nguideline_disposition: needs_review\nguideline_disposition_reason: 연결 지침이 아직 검토 요청 상태이므로 적용 여부를 사람이 결정해야 합니다.\n---\n\n# I0001 Fixture\n\n## Policy Alignment\n\n| Policy Ref | Relation | Rationale | Exception Ref |\n| --- | --- | --- | --- |\n| ${LONG_POLICY_ID} | constrained-by | 읽기 전용 차량 제어 경계를 추진안의 비가역 제약으로 유지합니다. | |\n\n## Guideline Disposition\n\n| Guideline Ref | Adoption | Rationale | Verification |\n| --- | --- | --- | --- |\n| ${LONG_GUIDELINE_ID} | recommended | 재현 가능한 하드웨어 근거 수집 방식을 검토 후보로 연결합니다. | 연결 프로젝트가 제출한 점검 결과와 source hash를 사람이 검토합니다. |\n`,
    "utf8"
  );
  return fixture;
}

async function assertTabs(page) {
  const expected = ["Overview", "Policies", "Guidelines", "Initiatives", "Review", "Execution", "Evidence"];
  const tabs = page.getByRole("tab");
  assert.equal(await tabs.count(), expected.length);
  const labels = await tabs.allTextContents();
  assert.deepEqual(labels.map((value) => value.replace(/\s+\d+$/, "").trim()), expected);
  assert.equal(await page.locator("[class*='sidebar'], [id*='repository-selector'], [class*='repository-selector'], [id*='workspace-switcher']").count(), 0);
  assert.match(await page.getByLabel("Board, current repository").innerText(), /^Board\s*\/\s*browser-fixture/i);
  const visibleCopy = await page.locator("body").innerText();
  assert.doesNotMatch(visibleCopy, /보드/);
  assert.match(visibleCopy, /읽기 전용/);
  assert.match(visibleCopy, /소스 근거가 최신입니다/);

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

  await page.getByRole("tab", { name: /^Policies$/ }).press("Home");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-overview");
  await page.getByRole("tab", { name: /^Overview$/ }).press("End");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-evidence");
  await page.getByRole("tab", { name: /^Evidence$/ }).press("ArrowLeft");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-execution");
  await page.getByRole("tab", { name: /^Execution$/ }).press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-evidence");
  await page.getByRole("tab", { name: /^Overview$/ }).focus();
  await page.getByRole("tab", { name: /^Overview$/ }).press("Enter");
  assert.equal(await page.getByRole("tab", { name: /^Overview$/ }).getAttribute("aria-selected"), "true");
  await page.getByRole("tab", { name: /^Policies$/ }).focus();
  await page.getByRole("tab", { name: /^Policies$/ }).press("Space");
  assert.equal(await page.getByRole("tab", { name: /^Policies$/ }).getAttribute("aria-selected"), "true");
  await page.getByRole("tab", { name: /^Policies$/ }).press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-guidelines");
  assert.equal(await page.getByRole("tab", { name: /^Guidelines$/ }).getAttribute("aria-selected"), "true");
  await page.getByRole("tab", { name: /^Guidelines$/ }).press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "tab-initiatives");
  assert.equal(await page.getByRole("tab", { name: /^Initiatives$/ }).getAttribute("aria-selected"), "true");
  await page.getByRole("tab", { name: /^Policies$/ }).click();
}

async function assertStateContinuity(page, fixture) {
  await page.getByRole("button", { name: "다음 정책 페이지" }).click();
  assert.match(await page.locator("#policy-pagination").innerText(), /6–10/);
  await page.locator("#policy-search").fill("정책 후보 1");
  await page.locator("#policy-search").focus();
  const before = await page.locator("#policy-result-count").innerText();
  assert.match(before, /정책 4개/);

  fixture.catalog.direction.push("자동 갱신은 사용자가 읽고 있는 화면 상태를 방해하지 않습니다.");
  await writeFile(
    path.join(fixture.root, "docs", "governance", "catalog.json"),
    `${JSON.stringify(fixture.catalog, null, 2)}\n`,
    "utf8"
  );
  await page.waitForFunction(() => document.querySelector("#live-state")?.textContent?.includes("자동"), null, { timeout: 5000 });
  await sleep(2400);
  assert.equal(await page.locator("#policy-search").inputValue(), "정책 후보 1");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "policy-search");

  await page.locator("#policy-search").fill("");
  await page.getByRole("button", { name: `${LONG_POLICY_ID} 상세 열기` }).click();
  await page.locator("#refresh-button").click();
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole("tab", { name: /^Policies$/ }).getAttribute("aria-selected"), "true");
  assert.equal(await page.getByRole("button", { name: `${LONG_POLICY_ID} 상세 닫기` }).getAttribute("aria-expanded"), "true");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "refresh-button");
}

async function assertGuidelineSurface(page) {
  await page.getByRole("tab", { name: /^Guidelines$/ }).click();
  await page.locator("#clear-guideline-filters").click();
  assert.equal(await page.locator("#guideline-table-body .item-id").filter({ hasText: LONG_GUIDELINE_ID }).count(), 1);

  await page.locator("#guideline-search").fill("재현 가능한 하드웨어");
  assert.match(await page.locator("#guideline-result-count").innerText(), /지침 1개/);
  await page.locator("#guideline-search").fill("차량 정책 후보 1");
  assert.match(await page.locator("#guideline-result-count").innerText(), /지침 1개/);

  await page.locator("#guideline-search").fill("");
  await page.locator("#guideline-filter-attention").click();
  assert.equal(await page.locator("#guideline-filter-attention").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#guideline-table-body .item-id").filter({ hasText: LONG_GUIDELINE_ID }).count(), 1);

  await page.getByRole("button", { name: `${LONG_GUIDELINE_ID} 지침 상세 열기` }).click();
  assert.equal(await page.getByRole("button", { name: `${LONG_GUIDELINE_ID} 지침 상세 닫기` }).getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator(`#guideline-details-${LONG_GUIDELINE_ID}`).count(), 1);
  assert.match(await page.locator(`#guideline-details-${LONG_GUIDELINE_ID}`).innerText(), /연결된 정책/);

  await page.locator("#refresh-button").click();
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole("tab", { name: /^Guidelines$/ }).getAttribute("aria-selected"), "true");
  assert.equal(await page.locator("#guideline-filter-attention").getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("button", { name: `${LONG_GUIDELINE_ID} 지침 상세 닫기` }).getAttribute("aria-expanded"), "true");
}

async function assertInitiativeSurface(page) {
  await page.getByRole("tab", { name: /^Initiatives$/ }).click();
  await page.locator("#clear-initiative-filters").click();
  assert.match(await page.locator("#initiative-result-count").innerText(), /추진안 1개/);
  await page.locator("#initiative-search").fill("Fixture Delivery");
  assert.match(await page.locator("#initiative-result-count").innerText(), /추진안 1개/);
  await page.locator("#initiative-search").fill("");
  await page.locator("#initiative-filter-guideline_review").click();
  assert.equal(await page.locator("#initiative-filter-guideline_review").getAttribute("aria-pressed"), "true");
  assert.match(await page.locator("#initiative-table-body").innerText(), /지침 검토 필요/);
  await page.getByRole("button", { name: "I0001 추진안 상세 열기" }).click();
  const details = page.locator("#initiative-details-I0001");
  assert.match(await details.innerText(), /연결 프로젝트 1개/);
  assert.match(await details.innerText(), /P0001/);
  assert.match(await details.innerText(), /기존 계보 호환|새 계보 계약/);
  assert.match(await details.innerText(), /경계를 준수/);
  assert.match(await details.innerText(), /읽기 전용 차량 제어 경계를 추진안의 비가역 제약으로 유지합니다/);
  assert.match(await details.innerText(), /권장 적용/);
  assert.match(await details.innerText(), /재현 가능한 하드웨어 근거 수집 방식을 검토 후보로 연결합니다/);
  assert.match(await details.innerText(), /연결 프로젝트가 제출한 점검 결과와 source hash를 사람이 검토합니다/);
  await page.locator("#refresh-button").click();
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole("tab", { name: /^Initiatives$/ }).getAttribute("aria-selected"), "true");
  assert.equal(await page.getByRole("button", { name: "I0001 추진안 상세 닫기" }).getAttribute("aria-expanded"), "true");
}

async function assertResponsive(page) {
  for (const size of [{ width: 1440, height: 1024 }, { width: 949, height: 1021 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.getByRole("tab", { name: /^Policies$/ }).click();
    await page.locator("#clear-policy-filters").click();
    const layout = await page.evaluate(() => ({
      innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyOverflow: document.documentElement.scrollWidth > innerWidth,
      tabCount: document.querySelectorAll('[role="tab"]').length,
      visiblePanels: [...document.querySelectorAll('[role="tabpanel"]')].filter((panel) => !panel.hidden).length,
      tableClientWidth: document.querySelector(".table-scroll")?.clientWidth ?? 0,
      tableScrollWidth: document.querySelector(".table-scroll")?.scrollWidth ?? 0,
      scrollHintVisible: getComputedStyle(document.querySelector(".table-scroll-hint")).display !== "none",
      rawMigrationReasonVisible: /captured_head_current|missing_captured_base|invalid_captured_working_tree_state/.test(
        document.querySelector("#panel-policies")?.innerText ?? ""
      ),
      chromeContained: [document.querySelector("#policy-summary"), document.querySelector("#clear-policy-filters")]
        .every((node) => {
          const value = node?.getBoundingClientRect();
          return value && value.left >= -1 && value.right <= innerWidth + 1;
        })
    }));
    assert.equal(layout.bodyOverflow, false, `body overflow at ${size.width}px`);
    assert.equal(layout.tabCount, 7);
    assert.equal(layout.visiblePanels, 1);
    assert.equal(layout.chromeContained, true, `policy summary or filter control clipped at ${size.width}px`);
    assert.equal(layout.scrollHintVisible, size.width <= 1199, `table scroll hint visibility mismatch at ${size.width}px`);
    assert.equal(layout.rawMigrationReasonVisible, false, `raw migration reason leaked at ${size.width}px`);
    if (size.width === 390) assert.ok(layout.tableScrollWidth > layout.tableClientWidth, "wide table must scroll inside its panel");

    const policyGeometry = await page.evaluate(({ policyId, guidelineId }) => {
      const rect = (node) => {
        const value = node.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      };
      const contained = (child, parent, tolerance = 1) => (
        child.left >= parent.left - tolerance
        && child.right <= parent.right + tolerance
        && child.top >= parent.top - tolerance
        && child.bottom <= parent.bottom + tolerance
      );
      const policyNode = [...document.querySelectorAll("#policy-table-body .item-id")]
        .find((node) => node.textContent.trim() === policyId);
      if (!policyNode) throw new Error(`missing policy fixture ${policyId}`);
      const row = policyNode.closest("tr.data-row");
      const policyCell = policyNode.closest("td");
      const titleCell = row.children[2];
      const guidelineNode = [...row.querySelectorAll(".linked-refs code")]
        .find((node) => node.textContent.trim() === guidelineId);
      if (!guidelineNode) throw new Error(`missing guideline fixture ${guidelineId}`);
      const guidelineContainer = guidelineNode.closest(".linked-refs");
      const guidelineCell = guidelineNode.closest("td");
      const riskCell = row.children[4];
      const policy = rect(policyNode);
      const policyOwner = rect(policyCell);
      const titleOwner = rect(titleCell);
      const guideline = rect(guidelineNode);
      const guidelineOwner = rect(guidelineContainer);
      const guidelineCellRect = rect(guidelineCell);
      const riskOwner = rect(riskCell);
      return {
        policyContained: contained(policy, policyOwner),
        policyBeforeTitle: policy.right <= titleOwner.left + 1,
        guidelineContained: contained(guideline, guidelineOwner) && contained(guideline, guidelineCellRect),
        guidelineBeforeRisk: guideline.right <= riskOwner.left + 1
      };
    }, { policyId: LONG_POLICY_ID, guidelineId: LONG_GUIDELINE_ID });
    assert.equal(policyGeometry.policyContained, true, `policy ID escaped its cell at ${size.width}px`);
    assert.equal(policyGeometry.policyBeforeTitle, true, `policy ID overlapped the title cell at ${size.width}px`);
    assert.equal(policyGeometry.guidelineContained, true, `guideline ID escaped its container at ${size.width}px`);
    assert.equal(policyGeometry.guidelineBeforeRisk, true, `guideline ID overlapped the risk cell at ${size.width}px`);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const stickyBrand = await page.evaluate(() => {
      const chrome = document.querySelector(".app-chrome");
      const brand = document.querySelector(".repository-identity");
      const chromeRect = chrome.getBoundingClientRect();
      const brandRect = brand.getBoundingClientRect();
      return {
        position: getComputedStyle(chrome).position,
        chromeTop: chromeRect.top,
        brandTop: brandRect.top,
        brandBottom: brandRect.bottom,
        text: brand.textContent.replace(/\s+/g, " ").trim()
      };
    });
    assert.ok(["sticky", "fixed"].includes(stickyBrand.position), `Board chrome is not sticky at ${size.width}px`);
    assert.ok(stickyBrand.chromeTop >= -1 && stickyBrand.chromeTop <= 1, `Board chrome left the viewport at ${size.width}px`);
    assert.ok(stickyBrand.brandTop >= -1 && stickyBrand.brandBottom > 0, `Board brand is not visible at ${size.width}px`);
    assert.match(stickyBrand.text, /^Board\s*\/\s*browser-fixture/i);
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.getByRole("tab", { name: /^Guidelines$/ }).click();
    await page.locator("#clear-guideline-filters").click();
    const guidelineGeometry = await page.evaluate(({ guidelineId, policyId }) => {
      const rect = (node) => {
        const value = node.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      };
      const contained = (child, parent, tolerance = 1) => (
        child.left >= parent.left - tolerance
        && child.right <= parent.right + tolerance
        && child.top >= parent.top - tolerance
        && child.bottom <= parent.bottom + tolerance
      );
      const guidelineNode = [...document.querySelectorAll("#guideline-table-body .item-id")]
        .find((node) => node.textContent.trim() === guidelineId);
      if (!guidelineNode) throw new Error(`missing guideline fixture ${guidelineId}`);
      const row = guidelineNode.closest("tr.data-row");
      const guidelineCell = guidelineNode.closest("td");
      const titleCell = row.children[2];
      const policyNode = [...row.querySelectorAll(".linked-refs code")]
        .find((node) => node.textContent.trim() === policyId);
      if (!policyNode) throw new Error(`missing linked policy fixture ${policyId}`);
      const policyContainer = policyNode.closest(".linked-refs");
      const policyCell = policyNode.closest("td");
      const riskCell = row.children[4];
      return {
        guidelineContained: contained(rect(guidelineNode), rect(guidelineCell)),
        guidelineBeforeTitle: rect(guidelineNode).right <= rect(titleCell).left + 1,
        policyContained: contained(rect(policyNode), rect(policyContainer)) && contained(rect(policyNode), rect(policyCell)),
        policyBeforeRisk: rect(policyNode).right <= rect(riskCell).left + 1
      };
    }, { guidelineId: LONG_GUIDELINE_ID, policyId: LONG_POLICY_ID });
    assert.equal(guidelineGeometry.guidelineContained, true, `guideline ID escaped its own cell at ${size.width}px`);
    assert.equal(guidelineGeometry.guidelineBeforeTitle, true, `guideline ID overlapped the guideline title at ${size.width}px`);
    assert.equal(guidelineGeometry.policyContained, true, `linked policy ID escaped the guideline table at ${size.width}px`);
    assert.equal(guidelineGeometry.policyBeforeRisk, true, `linked policy ID overlapped guideline risk at ${size.width}px`);

    await page.getByRole("tab", { name: /^Initiatives$/ }).click();
    await page.locator("#clear-initiative-filters").click();
    const initiativeGeometry = await page.evaluate(({ policyId, guidelineId }) => {
      const rect = (node) => {
        const value = node.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      };
      const contained = (child, parent, tolerance = 1) => (
        child.left >= parent.left - tolerance
        && child.right <= parent.right + tolerance
        && child.top >= parent.top - tolerance
        && child.bottom <= parent.bottom + tolerance
      );
      const row = document.querySelector("#initiative-table-body tr.initiative-row");
      if (!row) throw new Error("missing initiative fixture row");
      const policyNode = [...row.querySelectorAll(".linked-ref-relationship code")]
        .find((node) => node.textContent.trim() === policyId);
      const guidelineNode = [...row.querySelectorAll(".linked-ref-relationship code")]
        .find((node) => node.textContent.trim() === guidelineId);
      if (!policyNode || !guidelineNode) throw new Error("missing initiative relationship fixture");
      const policyOwner = policyNode.closest(".linked-ref-relationship");
      const guidelineOwner = guidelineNode.closest(".linked-ref-relationship");
      return {
        policyContained: contained(rect(policyNode), rect(policyOwner)) && contained(rect(policyNode), rect(policyNode.closest("td"))),
        guidelineContained: contained(rect(guidelineNode), rect(guidelineOwner)) && contained(rect(guidelineNode), rect(guidelineNode.closest("td"))),
        bodyOverflow: document.documentElement.scrollWidth > innerWidth
      };
    }, { policyId: LONG_POLICY_ID, guidelineId: LONG_GUIDELINE_ID });
    assert.equal(initiativeGeometry.policyContained, true, `initiative policy ID escaped its container at ${size.width}px`);
    assert.equal(initiativeGeometry.guidelineContained, true, `initiative guideline ID escaped its container at ${size.width}px`);
    assert.equal(initiativeGeometry.bodyOverflow, false, `initiative tab caused body overflow at ${size.width}px`);

    await page.getByRole("tab", { name: /^Review/ }).click();
    const reviewGeometry = await page.evaluate(({ attentionId, relatedRef }) => {
      const rect = (node) => {
        const value = node.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      };
      const contained = (child, parent, tolerance = 1) => (
        child.left >= parent.left - tolerance
        && child.right <= parent.right + tolerance
        && child.top >= parent.top - tolerance
        && child.bottom <= parent.bottom + tolerance
      );
      const idNode = [...document.querySelectorAll("#review-list .item-id")]
        .find((node) => node.textContent.trim() === attentionId);
      if (!idNode) throw new Error(`missing attention fixture ${attentionId}`);
      const card = idNode.closest(".review-item");
      const idOwner = idNode.parentElement;
      const relatedNode = [...card.querySelectorAll(".linked-refs code")]
        .find((node) => node.textContent.trim() === relatedRef);
      if (!relatedNode) throw new Error(`missing related-ref fixture ${relatedRef}`);
      const relatedOwner = relatedNode.closest(".linked-refs");
      return {
        reviewIdContained: contained(rect(idNode), rect(idOwner)) && contained(rect(idNode), rect(card)),
        relatedRefContained: contained(rect(relatedNode), rect(relatedOwner)) && contained(rect(relatedNode), rect(card))
      };
    }, { attentionId: LONG_ATTENTION_ID, relatedRef: LONG_POLICY_ID });
    assert.equal(reviewGeometry.reviewIdContained, true, `review ID escaped its container at ${size.width}px`);
    assert.equal(reviewGeometry.relatedRefContained, true, `review related ref escaped its container at ${size.width}px`);
  }
}

async function compareScreenshot(page, PNG, pixelmatch) {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.getByRole("tab", { name: /^Policies$/ }).click();
  await page.locator("#clear-policy-filters").click();
  const opener = page.getByRole("button", { name: `${LONG_POLICY_ID} 상세 열기` });
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
    await assertGuidelineSurface(page);
    await assertInitiativeSurface(page);
    await assertResponsive(page);
    const visual = await compareScreenshot(page, PNG, pixelmatch);
    assert.deepEqual(consoleProblems, [], `browser console problems:\n${consoleProblems.join("\n")}`);
    assert.deepEqual(externalRequests, [], `external requests:\n${externalRequests.join("\n")}`);

    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      status: "PLAN_READY",
      gateResult: "passed",
      gate: "reference-view-browser",
      tabs: 7,
      viewports: [1440, 949, 768, 390],
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
