import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getAuthProviderButtonWidth } from "../src/lib/authLayout.js";

const longName = "Extraordinary collection name ".repeat(8).trim();
const longValue = "9".repeat(200);
const categories = [
  { id: "c1", name: longName, description: "A long name used to guard against popup overflow." },
  { id: "c2", name: "Reading", description: "Lines worth keeping." },
];
const items = Array.from({ length: 18 }, (_, index) => ({
  id: `item-${index + 1}`,
  name: index === 0 ? "One thought" : index === 1 ? longName : `A saved thought ${index + 1}`,
  description: index === 0 ? "A note with bounded user data." : "A short sample note.",
  value: index === 0 ? Number(longValue) : index,
  active: true,
  tags: index === 0 ? [longName] : ["idea"],
  sequenceNumber: index + 1,
  categoryId: "c1",
  categoryName: longName,
  created: "2026-10-31T12:00:00Z",
  modified: "2026-10-31T13:00:00Z",
  files: [],
}));

function contrastRatio(foreground, background) {
  const luminance = (value) => {
    const channels = value.match(/\d+/g).slice(0, 3).map((channel) => Number(channel) / 255);
    return channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function mockApi(page, state = {}) {
  const counts = { itemPosts: 0, roleRequests: 0 };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (pathname === "/api/auth/me") {
      return json({ id: "admin", email: state.email ?? "admin@example.com", role: Object.hasOwn(state, "role") ? state.role : "Admin" });
    }
    if (pathname === "/api/auth/register" && method === "POST") {
      const body = request.postDataJSON();
      return json({
        message: body.adminBootstrapToken
          ? "Administrator account created. You can now sign in."
          : "Account created. An administrator must approve it before you can use the app.",
      });
    }
    if (pathname === "/api/categories" && method === "GET") {
      return state.categoriesError ? json({ detail: "Collections are unavailable." }, 503) : json(state.noCategories ? [] : categories);
    }
    if (pathname === "/api/categories/recent") return json({ categoryId: state.noCategories ? null : "c1" });
    if (pathname === "/api/items" && method === "GET") {
      if (state.itemsError) return json({ detail: state.itemsErrorMessage || "Notes are unavailable." }, 503);
      const result = state.itemCount === undefined ? items : Array.from({ length: state.itemCount }, (_, index) => ({ ...items[index % items.length], id: `count-item-${index}`, name: `Stat fixture ${index + 1}` }));
      return json(result);
    }
    if (pathname === "/api/items" && method === "POST") {
      counts.itemPosts += 1;
      if (state.delayItemPost) await new Promise((resolve) => setTimeout(resolve, 350));
      return json({ id: "created-item", ...request.postDataJSON() });
    }
    if (pathname === "/api/items/import") return json({ imported: 1, errors: [] });
    if (pathname === "/api/tags") return json([longName, "idea"]);
    if (pathname === "/api/users" && method === "GET") {
      return state.usersError ? json({ detail: state.usersErrorMessage || "Accounts are unavailable." }, 503) : json([
        { id: "admin", email: "admin@example.com", role: "Admin" },
        { id: "member", email: "member@example.com", role: "User" },
      ]);
    }
    if (pathname === "/api/roles") {
      counts.roleRequests += 1;
      if (state.rolesError && counts.roleRequests === 1) return json({ detail: "Role list unavailable." }, 503);
      return json(["User", "Admin"]);
    }
    if (pathname === "/api/settings/api-key") return json({ apiKey: "550e8400-e29b-41d4-a716-446655440000" });
    if (pathname === "/api/settings/api-key/generate" && method === "POST") {
      if (state.rotateError) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return json({ detail: "Rotation failed." }, 503);
      }
      return json({ apiKey: "new-key" });
    }
    if (pathname === "/api/settings") return json({ version: "test", deploymentName: "playwright" });
    if (method === "DELETE" && pathname.startsWith("/api/items/")) {
      if (state.deleteError) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return json({ detail: "Delete failed." }, 503);
      }
      return route.fulfill({ status: 204, body: "" });
    }
    if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
    if (method === "POST" || method === "PUT") return json({ successful: true });
    return json({});
  });

  await page.addInitScript(() => localStorage.setItem("listjj_token", "playwright-token"));
  return counts;
}

test("route titles and focus handle lazy pages and trailing slashes", async ({ page }) => {
  await mockApi(page);
  const routes = [
    ["/login", "Sign in · Listjj", "Return to your thoughts."],
    ["/register", "Create account · Listjj", "A place to keep things."],
    ["/items/", "Notebook · Listjj", "The notebook."],
    ["/categories/", "Collections · Listjj", "Collections."],
    ["/users/", "People & access · Listjj", "People & access."],
    ["/settings/", "Connections · Listjj", "Connections."],
  ];

  for (const [path, title, heading] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page).toHaveTitle(title);
    await expect.poll(() => page.evaluate(() => document.activeElement?.hasAttribute("data-page-title"))).toBe(true);
  }
});

test("short mobile navigation scrolls and closes for both nav links and the brand", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto("/items");
  await page.getByRole("button", { name: "Open navigation" }).click();

  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet).toHaveCSS("background-image", /linear-gradient/);
  const brandMark = sheet.getByRole("link", { name: "listjj Personal index" }).locator(":scope > span").first();
  await expect(brandMark).toHaveCSS("background-image", /linear-gradient/);
  await expect(brandMark).toHaveCSS("color", "rgb(65, 75, 82)");

  const settingsLink = page.getByRole("link", { name: "Settings & access" });
  await settingsLink.scrollIntoViewIfNeeded();
  await expect(settingsLink).toBeInViewport();
  expect(await settingsLink.evaluate((link) => link.closest('[data-slot="sheet-content"]').scrollTop)).toBeGreaterThan(0);
  await settingsLink.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(settingsLink).toBeFocused();
  await expect(settingsLink).toHaveCSS("outline-color", "rgb(24, 30, 34)");
  await settingsLink.click();
  await expect(page.getByRole("heading", { name: "Connections." })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.activeElement?.hasAttribute("data-page-title"))).toBe(true);

  await page.goto("/items");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "listjj Personal index" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("long user data stays inside the mobile viewport and select popup", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/items");
  await expect(page.getByRole("heading", { name: "One thought" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const badge = page.locator('[data-slot="badge"]').first();
  await expect(badge).toHaveAttribute("title", longName);
  expect(await badge.evaluate((node) => node.getBoundingClientRect().width)).toBeLessThanOrEqual(200);

  await page.getByRole("button", { name: "Find notes" }).click();
  await page.getByRole("combobox", { name: "Collection" }).click();
  const popup = page.locator('[data-slot="select-content"]');
  await expect(popup).toBeVisible();
  const popupSize = await popup.evaluate((node) => ({
    width: node.getBoundingClientRect().width,
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }));
  expect(popupSize.width).toBeLessThanOrEqual(320);
  expect(popupSize.scrollWidth).toBeLessThanOrEqual(popupSize.clientWidth);
});

test("phone toolbar, collapsed filters and compact stats work together", async ({ page }) => {
  await mockApi(page);
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/items");

  const toolbar = page.locator("header").first();
  await expect(toolbar.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect(toolbar.getByText("Notebook", { exact: true })).toBeVisible();
  const findToggle = toolbar.getByRole("button", { name: "Find notes" });
  await expect(findToggle).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Sign out" })).toBeVisible();
  for (const button of [toolbar.getByRole("button", { name: "Open navigation" }), findToggle, toolbar.getByRole("button", { name: "Sign out" })]) {
    const box = await button.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(toolbar.getByText("Keep the useful things close.")).toBeHidden();
  await expect(toolbar.getByText("A personal index")).toBeHidden();

  const heading = page.getByRole("heading", { name: "The notebook." });
  await expect(heading).toBeAttached();
  await expect(heading).toHaveClass(/sr-only/);
  await expect.poll(() => heading.evaluate((node) => node === document.activeElement)).toBe(true);
  await expect(page.getByText("Your personal index", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Notes, small plans and loose ends—kept together, without the noise.", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.getByTestId("notebook-stats").evaluate((node) => [...node.querySelectorAll(":scope > div > span:nth-child(2)")].map((value) => value.textContent))).toEqual(["18 notes", "18 active", "2 lists"]);
  await expect(page.getByTestId("notebook-top-row").getByText("01", { exact: true })).toHaveCount(0);
  const statCells = page.getByTestId("notebook-stats").locator(":scope > div");
  const statLabels = statCells.locator(":scope > span:first-child");
  await expect(statLabels).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) await expect(statLabels.nth(index)).toHaveCSS("font-size", "8px");
  const statValues = statCells.locator(":scope > span:nth-child(2)");
  for (let index = 0; index < 3; index += 1) await expect(statValues.nth(index)).toHaveCSS("font-size", "16px");
  const statUnits = statValues.locator(":scope > span");
  for (let index = 0; index < 3; index += 1) {
    await expect(statUnits.nth(index)).toHaveClass(/sr-only/);
    await expect(statUnits.nth(index)).toHaveCSS("position", "absolute");
  }

  const filters = page.locator("#notebook-filters");
  await expect(page.getByTestId("notebook-filter-dot")).toBeVisible();
  await expect(findToggle).toHaveAttribute("aria-describedby", "notebook-filter-status");
  await expect(page.locator("#notebook-filter-status")).toHaveText("Filters active");
  await expect(filters).toBeHidden();
  await expect(page.getByRole("button", { name: "Import" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Export" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Sort tags" })).toBeHidden();
  await expect(findToggle).toHaveAttribute("aria-expanded", "false");
  await findToggle.click();
  await expect(filters).toBeVisible();
  const searchbox = page.getByRole("searchbox", { name: "Find something" });
  await expect(searchbox).toBeFocused();
  const searchTop = await searchbox.evaluate((node) => node.getBoundingClientRect().top);
  const toolbarBottom = await toolbar.evaluate((node) => node.getBoundingClientRect().bottom);
  expect(searchTop).toBeGreaterThanOrEqual(toolbarBottom);
  await expect(findToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByTestId("notebook-filter-dot")).toHaveCount(0);
  await expect(findToggle).not.toHaveAttribute("aria-describedby", "notebook-filter-status");
  await findToggle.click();
  await expect(filters).toBeHidden();
  await expect(findToggle).toBeFocused();

  const statsGrid = page.getByTestId("notebook-stats");
  const newNote = page.getByRole("button", { name: "New note" });
  const centers = await Promise.all([statsGrid, newNote].map((element) => element.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top + rect.height / 2;
  })));
  expect(Math.abs(centers[0] - centers[1])).toBeLessThanOrEqual(2);
  const [statsBox, noteBox] = await Promise.all([statsGrid, newNote].map((element) => element.boundingBox()));
  expect(statsBox.x + statsBox.width).toBeLessThanOrEqual(noteBox.x);
  expect(Math.abs((await newNote.boundingBox()).height - 40)).toBeLessThanOrEqual(0.1);

  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const [narrowButton, narrowStats] = await Promise.all([newNote, statsGrid].map((element) => element.evaluate((node) => node.getBoundingClientRect().toJSON())));
  expect(narrowStats.bottom).toBeLessThanOrEqual(narrowButton.top);
  expect(narrowButton.width).toBeGreaterThanOrEqual(250);
  expect(narrowStats.width).toBeGreaterThanOrEqual(228);
  expect((await page.getByTestId("notebook-top-row").boundingBox()).height).toBeLessThanOrEqual(84);
  expect(consoleErrors).toEqual([]);
});

test("filter panel stays closed by default at every width", async ({ page }) => {
  await mockApi(page);
  for (const width of [320, 375, 639, 640, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/items");
    await expect(page.locator("#notebook-filters")).toBeHidden();
    expect(await page.locator("#notebook-filters").getAttribute("hidden")).not.toBeNull();
    const findToggle = page.getByRole("button", { name: "Find notes" });
    await expect(findToggle).toBeVisible();
    await expect(findToggle).toHaveAttribute("aria-expanded", "false");
    await findToggle.click();
    await expect(page.locator("#notebook-filters")).toBeVisible();
    await expect(findToggle).toHaveAttribute("aria-expanded", "true");
    await findToggle.click();
    await expect(page.locator("#notebook-filters")).toBeHidden();
    await expect(findToggle).toHaveAttribute("aria-expanded", "false");
    await findToggle.click();
    await page.reload();
    await expect(page.locator("#notebook-filters")).toBeHidden();
    await expect(page.getByRole("button", { name: "Find notes" })).toHaveAttribute("aria-expanded", "false");
  }
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto("/items");
  await expect(page.locator("header.sticky").getByText(/A personal index.*Notebook/)).toBeVisible();
  await expect(page.locator("header.sticky").getByText("Keep the useful things close.")).toBeVisible();
  expect((await page.getByRole("button", { name: "Open navigation" }).boundingBox()).width).toBe(40);
  await expect(page.locator("#notebook-filters")).toBeHidden();
});

test("notebook top row is compact and filter tools only appear after Find is opened", async ({ page }) => {
  await mockApi(page);
  for (const [width, height] of [[320, 640], [375, 667], [640, 720], [667, 375], [768, 1024], [1024, 768], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/items");
    const row = page.getByTestId("notebook-top-row");
    const stats = page.getByTestId("notebook-stats");
    const newNote = page.getByRole("button", { name: "New note" });
    const rowOrderClasses = await row.locator(":scope > *").evaluateAll((nodes) => nodes.flatMap((node) => [...node.classList].filter((name) => name.startsWith("order-"))));
    expect(rowOrderClasses).toEqual([]);
    const title = page.getByRole("heading", { name: "The notebook." });
    if (width >= 640) {
      await expect(title).toBeVisible();
      await expect(title).toHaveCSS("font-size", "28px");
    }
    else await expect(title.evaluate((node) => getComputedStyle(node).position)).resolves.toBe("absolute");
    const statCells = stats.locator(":scope > div");
    const statLabels = statCells.locator(":scope > span:first-child");
    await expect(statLabels).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) await expect(statLabels.nth(index)).toHaveCSS("font-size", width < 640 ? "8px" : "9px");
    const statValues = statCells.locator(":scope > span:nth-child(2)");
    expect((await stats.boundingBox()).height).toBeLessThanOrEqual(32);
    for (let index = 0; index < 3; index += 1) await expect(statValues.nth(index)).toHaveCSS("font-size", "16px");
    const statUnits = statValues.locator(":scope > span");
    for (let index = 0; index < 3; index += 1) {
      await expect(statUnits.nth(index)).toHaveClass(/sr-only/);
      await expect(statUnits.nth(index)).toHaveCSS("position", "absolute");
    }
    await expect(newNote).toBeVisible();
    expect(Math.abs((await newNote.boundingBox()).height - (width < 640 ? 40 : 36))).toBeLessThanOrEqual(0.1);
    await expect(newNote.locator("svg")).toHaveCSS("width", "14px");
    await expect(page.getByRole("button", { name: "Find notes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Export" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Sort tags" })).toBeHidden();
    const statsAndAction = await Promise.all([stats, newNote].map((element) => element.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height, center: rect.top + rect.height / 2 };
    })));
    if (width === 320) {
      expect(statsAndAction[0].bottom).toBeLessThanOrEqual(statsAndAction[1].top);
      expect(statsAndAction[1].right - statsAndAction[1].left).toBeGreaterThanOrEqual(250);
      expect((await row.boundingBox()).height).toBeLessThanOrEqual(84);
    } else {
      expect(Math.abs(statsAndAction[0].center - statsAndAction[1].center)).toBeLessThanOrEqual(2);
      expect(statsAndAction[0].right).toBeLessThanOrEqual(statsAndAction[1].left);
      expect((await row.boundingBox()).height).toBeLessThanOrEqual((width >= 640 ? 36 : 40) + 0.1);
    }
    if (width === 375 || width === 640 || width === 1024 || width === 1280) {
      const rowBottom = (await row.boundingBox()).y + (await row.boundingBox()).height;
      const notesTop = await page.getByRole("heading", { name: "Recent notes" }).evaluate((node) => node.getBoundingClientRect().top);
      expect(notesTop - rowBottom).toBeLessThanOrEqual(16);
    }
    if (width === 1024 || width === 1280) {
      const rowBox = await row.boundingBox();
      expect(rowBox.height).toBeLessThanOrEqual(36.1);
      const notes = page.getByRole("heading", { name: "Recent notes" });
      const notesTop = await notes.evaluate((node) => node.getBoundingClientRect().top);
      expect(notesTop).toBeLessThanOrEqual(170);
    }
    await page.getByRole("button", { name: "Find notes" }).click();
    await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sort tags" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Find notes" }).click();
    await expect(page.getByRole("button", { name: "Import" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("three-digit note totals still fit beside the New note action", async ({ page }) => {
  await mockApi(page, { itemCount: 100 });
  for (const width of [360, 375]) {
    await page.setViewportSize({ width, height: 667 });
    await page.goto("/items");
    await expect.poll(() => page.getByTestId("notebook-stats").locator(":scope > div > span:nth-child(2)").first().textContent()).toContain("100");
    const row = await page.getByTestId("notebook-top-row").boundingBox();
    const stats = await page.getByTestId("notebook-stats").boundingBox();
    const action = await page.getByRole("button", { name: "New note" }).boundingBox();
    expect(Math.abs(stats.y + stats.height / 2 - (action.y + action.height / 2))).toBeLessThanOrEqual(2);
    expect(stats.x + stats.width).toBeLessThanOrEqual(action.x);
      expect(row.height).toBeLessThanOrEqual(40.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("zero and normal stats force the full-width New note onto the second line below 360px", async ({ page }) => {
  for (const [width, itemCount] of [[320, 0], [320, 18], [359, 0], [359, 18]]) {
    await mockApi(page, { itemCount });
    await page.setViewportSize({ width, height: 640 });
    await page.goto("/items");
    const row = page.getByTestId("notebook-top-row");
    const stats = page.getByTestId("notebook-stats");
    const newNote = page.getByRole("button", { name: "New note" });
    await expect.poll(() => stats.locator(":scope > div > span:nth-child(2)").first().textContent()).toContain(String(itemCount));
    const [statsBox, actionBox, rowBox] = await Promise.all([stats, newNote, row].map((element) => element.boundingBox()));
    expect(statsBox.y + statsBox.height).toBeLessThanOrEqual(actionBox.y);
    expect(actionBox.width).toBeGreaterThanOrEqual(250);
    expect(rowBox.height).toBeLessThanOrEqual(84);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("Find filter state resets on route changes", async ({ page }) => {
  await mockApi(page);
  await page.goto("/items");
  await page.getByRole("button", { name: "Find notes" }).click();
  await expect(page.locator("#notebook-filters")).toBeVisible();
  await page.getByRole("link", { name: /Collections/ }).first().click();
  await expect(page.getByRole("heading", { name: "Collections." })).toBeVisible();
  await page.getByRole("link", { name: "Notebook" }).first().click();
  await expect(page.locator("#notebook-filters")).toBeHidden();
});

test("notebook top row handles collection errors and empty collections", async ({ page }) => {
  await mockApi(page, { categoriesError: true });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/items");
  const row = page.getByTestId("notebook-top-row");
  const rowBottom = await row.evaluate((node) => node.getBoundingClientRect().bottom);
  const errorBanner = page.getByRole("alert").filter({ hasText: "Collections unavailable" });
  await expect(errorBanner).toBeVisible();
  expect(await errorBanner.evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(rowBottom);
  await expect(row.getByRole("button", { name: "New note" })).toHaveCount(0);
  await expect(row.getByRole("link")).toHaveCount(0);
  await page.getByRole("button", { name: "Find notes" }).click();
  await expect(page.locator("#notebook-filters")).toBeVisible();

  await mockApi(page, { noCategories: true, itemCount: 100 });
  for (const width of [360, 375]) {
    await page.setViewportSize({ width, height: 667 });
    await page.goto("/items");
    const emptyRow = page.getByTestId("notebook-top-row");
    const stats = page.getByTestId("notebook-stats");
    const createCollection = emptyRow.getByRole("link", { name: "New collection", exact: true });
    await expect(createCollection).toBeVisible();
    expect(await createCollection.evaluate((link) => link.innerText)).toBe("New collection");
    await expect(createCollection).toHaveAccessibleName("New collection");
    await expect(page.getByRole("button", { name: "New note" })).toHaveCount(0);
    await expect.poll(() => stats.locator(":scope > div > span:nth-child(2)").first().textContent()).toContain("100");
    const [statsBox, actionBox, rowBox] = await Promise.all([stats, createCollection, emptyRow].map((element) => element.boundingBox()));
    expect(Math.abs(statsBox.y + statsBox.height / 2 - (actionBox.y + actionBox.height / 2))).toBeLessThanOrEqual(2);
    expect(statsBox.x + statsBox.width).toBeLessThanOrEqual(actionBox.x);
    expect(rowBox.height).toBeLessThanOrEqual(40.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Find notes" }).click();
    await expect(page.locator("#notebook-filters")).toBeVisible();
  }
});

test("phone topbar titles match other workspace routes and Find stays Notebook-only", async ({ page }) => {
  await mockApi(page);
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 720 });
    for (const [path, title] of [["/categories", "Collections"], ["/users", "People"], ["/settings", "Settings"]]) {
      await page.goto(path);
      const toolbar = page.locator("header.sticky");
      if (width < 640) await expect(toolbar.getByText(title, { exact: true })).toBeVisible();
      await expect(toolbar.getByRole("button", { name: "Find notes" })).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }

  for (const [width, height] of [[320, 640], [375, 667], [667, 375], [768, 1024], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/items");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("new-note submit and cancel stay in the form header on phone and desktop", async ({ page }) => {
  await mockApi(page);
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/items");
    await page.getByRole("button", { name: "New note" }).click();
    const form = page.locator("form");
    const header = form.locator(":scope > div").first();
    const submit = form.getByRole("button", { name: "Add to notebook" });
    await expect(header.getByRole("heading", { name: "Capture a thought" })).toBeVisible();
    await expect(header.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(submit).toBeInViewport();
    expect(await form.evaluate((node) => {
      const submitButton = node.querySelector('button[type="submit"]');
      const firstInput = node.querySelector("input");
      return Boolean(submitButton.compareDocumentPosition(firstInput) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    expect(await form.locator("svg.lucide-plus").count()).toBe(0);
    await expect(form.locator(":scope > div").last()).not.toContainText("Add to notebook");
  }
});

test("long API errors and pending-user email wrap at 320px", async ({ page }) => {
  const state = {
    itemsError: true,
    itemsErrorMessage: "X".repeat(220),
    usersError: true,
    usersErrorMessage: "Y".repeat(220),
  };
  await mockApi(page, state);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/items");
  await expect(page.getByRole("heading", { name: "Notes could not be loaded." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.getByText(state.itemsErrorMessage)).toBeVisible();

  await page.goto("/users");
  await expect(page.getByText("Accounts could not be loaded.")).toBeVisible();
  await expect(page.getByText(state.usersErrorMessage)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("pending approval email wraps at 320px", async ({ page }) => {
  const email = `${"a".repeat(64)}@example.test`;
  await mockApi(page, { role: null, email });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/items");
  await expect(page.getByRole("heading", { name: "Your space is waiting." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.getByText(email)).toBeVisible();
});

test("Industrial tokens, chassis/field surfaces, focus visibility and reduced motion are applied", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/items");
  const tokens = await page.evaluate(() => ({
    chassis: getComputedStyle(document.documentElement).getPropertyValue("--dp-color-chassis").trim(),
    raised: getComputedStyle(document.documentElement).getPropertyValue("--dp-color-raised").trim(),
    well: getComputedStyle(document.documentElement).getPropertyValue("--dp-color-well").trim(),
    ink: getComputedStyle(document.documentElement).getPropertyValue("--dp-color-ink").trim(),
    label: getComputedStyle(document.documentElement).getPropertyValue("--dp-color-label").trim(),
    field: getComputedStyle(document.documentElement).getPropertyValue("--dp-color-field").trim(),
    onField: getComputedStyle(document.documentElement).getPropertyValue("--dp-color-on-field").trim(),
    onFieldMuted: getComputedStyle(document.documentElement).getPropertyValue("--dp-color-on-field-muted").trim(),
    accent: getComputedStyle(document.documentElement).getPropertyValue("--dp-color-accent").trim(),
    sans: getComputedStyle(document.documentElement).getPropertyValue("--dp-typography-sans").trim(),
    mono: getComputedStyle(document.documentElement).getPropertyValue("--dp-typography-mono").trim(),
    bodySize: getComputedStyle(document.documentElement).getPropertyValue("--dp-typography-body").trim(),
    readingSize: getComputedStyle(document.documentElement).getPropertyValue("--dp-typography-reading").trim(),
    metadataSize: getComputedStyle(document.documentElement).getPropertyValue("--dp-typography-metadata").trim(),
    labelSize: getComputedStyle(document.documentElement).getPropertyValue("--dp-typography-label").trim(),
    keyRadius: getComputedStyle(document.documentElement).getPropertyValue("--dp-radius-key").trim(),
    scheme: getComputedStyle(document.documentElement).colorScheme,
    page: getComputedStyle(document.body).backgroundColor,
  }));
  expect(tokens).toEqual({
    chassis: "#cbd0d2", raised: "#e7eaeb", well: "#b6bec2", ink: "#181e22", label: "#414b52",
    field: "#20272b", onField: "#f2f4f4", onFieldMuted: "#d8dee1", accent: "#f15b22",
    sans: '"Industrial Host", "Host Grotesk", sans-serif', mono: '"Industrial Plex", "IBM Plex Mono", monospace',
    bodySize: "17px", readingSize: "16px", metadataSize: "13px", labelSize: "11px", keyRadius: "4px",
    scheme: "light", page: "rgb(203, 208, 210)",
  });
  const pageTitle = page.getByRole("heading", { name: "The notebook." });
  await expect(pageTitle).toHaveCSS("font-family", /Industrial Host|Host Grotesk/);
  await expect(pageTitle).toHaveCSS("color", "rgb(24, 30, 34)");
  await expect(page.locator("[data-hardware-detail]")).toHaveCSS("background-color", "rgb(241, 91, 34)");

  const primary = page.getByRole("button", { name: "New note" });
  await expect(primary).toHaveCSS("color", "rgb(24, 30, 34)");
  await expect(primary).toHaveCSS("border-radius", "4px");
  await expect(primary).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Tab");
  await expect(primary).toBeFocused();
  const focusOutline = await primary.evaluate((node) => ({ style: getComputedStyle(node).outlineStyle, color: getComputedStyle(node).outlineColor }));
  expect(focusOutline.style).toBe("solid");
  await expect.poll(() => primary.evaluate((node) => getComputedStyle(node).outlineColor)).toBe("rgb(24, 30, 34)");

  const completed = page.getByRole("checkbox", { name: "Complete One thought" });
  await expect(completed).toHaveCSS("background-color", "rgb(241, 91, 34)");
  await expect(completed).toHaveCSS("color", "rgb(24, 30, 34)");

  await primary.hover();
  await expect(primary).toHaveCSS("background-image", /linear-gradient/);
  await primary.click();
  const keepActive = page.getByRole("checkbox", { name: /Keep it active/ });
  await expect(keepActive).toBeChecked();
  await keepActive.uncheck();
  await expect(keepActive).not.toBeChecked();
  await expect(keepActive).toHaveCSS("background-color", "rgb(32, 39, 43)");
  await expect(keepActive).toHaveCSS("border-color", "rgb(104, 116, 122)");
  await page.mouse.move(0, 0);

  await page.getByRole("button", { name: "Find notes" }).click();
  await expect(page.locator("#notebook-filters")).toHaveCSS("background-color", "rgb(231, 234, 235)");
  const searchbox = page.getByRole("searchbox", { name: "Find something" });
  await expect(searchbox).toHaveCSS("background-color", "rgb(32, 39, 43)");
  await expect(searchbox).toHaveCSS("color", "rgb(242, 244, 244)");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".page-enter")).toHaveCSS("animation-name", "none");
  expect(await page.locator(".page-enter").evaluate((node) => getComputedStyle(node).animationDuration)).toBe("1e-05s");
  const overflowingElements = await page.evaluate(() => [...document.querySelectorAll("body *")].map((node) => ({
    tag: node.tagName,
    className: typeof node.className === "string" ? node.className : "",
    right: Math.round(node.getBoundingClientRect().right),
    width: Math.round(node.getBoundingClientRect().width),
  })).filter((node) => node.right > innerWidth + 1).slice(0, 8));
  expect(await page.evaluate(() => document.documentElement.scrollWidth), JSON.stringify(overflowingElements)).toBeLessThanOrEqual(375);
});

test("focus outlines use high-contrast colors for dark and light surfaces", async ({ page }) => {
  await mockApi(page);
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  const darkOutline = "rgb(242, 244, 244)";
  const lightOutline = "rgb(24, 30, 34)";
  const darkSurfaces = ["rgb(41, 50, 56)", "rgb(32, 39, 43)", "rgb(23, 30, 34)", "rgb(48, 56, 61)"];
  const lightSurfaces = ["rgb(231, 234, 235)", "rgb(203, 208, 210)", "rgb(182, 190, 194)"];

  const focusAndCheck = async (target, expectedOutline, surfaces) => {
    await target.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(target).toBeFocused();
    const focusStyle = await target.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        visible: node.matches(":focus-visible"),
        color: style.outlineColor,
        style: style.outlineStyle,
        width: style.outlineWidth,
        offset: style.outlineOffset,
      };
    });
    expect(focusStyle).toEqual({ visible: true, color: expectedOutline, style: "solid", width: "2px", offset: "3px" });
    for (const surface of surfaces) expect(contrastRatio(expectedOutline, surface)).toBeGreaterThanOrEqual(3);
  };

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/settings");
    const apiKey = page.getByRole("textbox", { name: "Custom API key GUID" });
    await expect(apiKey).toBeEnabled();
    await focusAndCheck(apiKey, darkOutline, darkSurfaces);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  for (const route of ["/login", "/register"]) {
    await page.goto(route);
    await focusAndCheck(page.getByRole("link", { name: "listjj", exact: true }).first(), darkOutline, darkSurfaces);
  }

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/login");
  await focusAndCheck(page.getByRole("link", { name: "listjj", exact: true }), lightOutline, lightSurfaces);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/login");
  await focusAndCheck(page.getByRole("textbox", { name: "Email address" }), lightOutline, lightSurfaces);
  expect(consoleErrors).toEqual([]);
});

test("Industrial surfaces cover each existing route and keep delayed loading visible", async ({ page }) => {
  await mockApi(page);
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  const paths = [
    ["/items", "The notebook."],
    ["/categories", "Collections."],
    ["/users", "People & access."],
    ["/settings", "Connections."],
    ["/login", "Return to your thoughts."],
    ["/register", "A place to keep things."],
  ];

  for (const width of [320, 370, 375, 640, 760, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const [path, title] of paths) {
      await page.goto(path);
      const heading = page.getByRole("heading", { name: title, exact: true });
      await expect(heading).toBeVisible();
      await expect(page.locator("body")).toHaveCSS("background-color", "rgb(203, 208, 210)");
      await expect(heading).toHaveCSS("color", "rgb(24, 30, 34)");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (path === "/items" && width === 1280) {
        const collectionsLink = page.getByRole("link", { name: /Collections Your own order/ });
        await collectionsLink.hover();
        await expect(collectionsLink).toHaveCSS("background-color", "rgb(185, 193, 196)");
        await page.mouse.move(0, 0);
      }
      if (path === "/settings" && width === 1280) {
        const copyCurl = page.getByRole("button", { name: "Copy curl example" });
        await expect(copyCurl).toHaveCSS("color", "rgb(24, 30, 34)");
        await expect(copyCurl).toHaveCSS("background-image", /linear-gradient/);
        await copyCurl.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(copyCurl).toBeFocused();
        await expect(copyCurl).toHaveCSS("outline-color", "rgb(242, 244, 244)");
      }
    }
  }
  expect(consoleErrors).toEqual([]);

  await page.route("**/api/auth/me", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "admin", email: "admin@example.com", role: "Admin" }) });
  });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/items");
  const skeleton = page.locator('[aria-label="Loading your workspace"] .animate-pulse').first();
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toHaveCSS("background-color", "rgb(154, 164, 169)");
  await expect(skeleton).toHaveCSS("animation-name", "none");
  const skeletonColor = await skeleton.evaluate((node) => getComputedStyle(node).backgroundColor);
  const skeletonChannels = skeletonColor.match(/\d+/g).slice(0, 3).map(Number);
  const skeletonLuminance = skeletonChannels.map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const chassisLuminance = [203, 208, 210].map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  expect((chassisLuminance + 0.05) / (skeletonLuminance + 0.05)).toBeGreaterThanOrEqual(1.5);
});

test("third-party auth widgets remain contained at narrow auth widths", async ({ page }) => {
  expect([320, 375, 640].map((width) => getAuthProviderButtonWidth(0, width))).toEqual([280, 335, 360]);
  for (const width of [320, 375, 640]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/login");
    const providerContainer = page.getByTestId("auth-providers");
    await expect(providerContainer).toBeAttached();
    const containerWidth = await providerContainer.evaluate((node) => node.clientWidth);
    const widgetWidth = getAuthProviderButtonWidth(containerWidth, width);
    await providerContainer.evaluate((node, width) => {
      const widget = document.createElement("div");
      widget.dataset.testid = "google-signin-mock";
      widget.style.width = `${width}px`;
      widget.style.height = "40px";
      node.append(widget);
    }, widgetWidth);
    expect(containerWidth).toBeLessThanOrEqual(width - 40);
    expect(widgetWidth).toBeLessThanOrEqual(width - 40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("collection field and CSV importer are accessible and keyboard-operable", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/items");
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page.locator("form").getByRole("combobox", { name: "Collection" })).toBeVisible();

  await page.getByRole("button", { name: "Find notes" }).click();
  const importer = page.getByRole("button", { name: "Import" });
  const csvInput = page.locator('input[type="file"][accept=".csv,text/csv"]');
  await expect(importer).toBeVisible();
  expect(await csvInput.evaluate((input) => input.tabIndex === -1 && input.getAttribute("aria-hidden") === "true")).toBe(true);

  const csvPath = testInfo.outputPath("import.csv");
  await mkdir(dirname(csvPath), { recursive: true });
  await writeFile(csvPath, "Name;Description\nImported;Playwright fixture\n");
  const chooserPromise = page.waitForEvent("filechooser");
  await importer.focus();
  await page.keyboard.press("Enter");
  await (await chooserPromise).setFiles(csvPath);
  await expect(page.getByText("Imported 1 note.")).toBeVisible();
});

test("role failures can be retried and destructive dialogs expose pending and failure states", async ({ page }) => {
  const counts = await mockApi(page, { rolesError: true, deleteError: true });
  await page.goto("/users");
  await expect(page.getByText("Roles unavailable")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email address" })).toHaveCSS("font-size", "14px");
  await expect(page.getByRole("button", { name: "Add account" })).toHaveCSS("font-size", "14px");
  await expect(page.getByRole("combobox", { name: "Initial role" })).toBeDisabled();
  await page.getByRole("button", { name: "Retry roles" }).click();
  await expect(page.getByRole("combobox", { name: "Initial role" })).toBeEnabled();
  expect(counts.roleRequests).toBeGreaterThanOrEqual(2);

  await page.goto("/items");
  await page.getByRole("button", { name: "Delete One thought" }).click();
  const dialog = page.getByRole("dialog");
  const confirmDelete = dialog.getByRole("button", { name: "Delete note" });
  await expect(confirmDelete).toHaveCSS("color", "rgb(242, 244, 244)");
  await expect(confirmDelete).toHaveCSS("background-color", "rgb(140, 48, 32)");
  expect(contrastRatio("rgb(242, 244, 244)", "rgb(140, 48, 32)")).toBeGreaterThanOrEqual(4.5);
  await dialog.getByRole("button", { name: "Keep it" }).focus();
  await page.keyboard.press("Tab");
  await expect(confirmDelete).toBeFocused();
  await expect(confirmDelete).toHaveCSS("outline-color", "rgb(24, 30, 34)");
  await confirmDelete.click();
  const confirm = dialog.getByRole("button", { name: "Working…" });
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByRole("alert")).toContainText("Delete failed.");
  await expect(dialog.getByRole("button", { name: "Delete note" })).toBeEnabled();
});

test("settings copy names are contextual, registration approval copy is accurate, and item submit is single-flight", async ({ page }) => {
  const counts = await mockApi(page, { delayItemPost: true });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/settings");
  const copyApiKey = page.getByRole("button", { name: "Copy API key" });
  await expect(copyApiKey).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy MCP endpoint" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy curl example" })).toBeVisible();
  await copyApiKey.click();
  await expect(page.getByRole("status").filter({ hasText: "API key copied." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copied API key" })).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByLabel(/^Password/).fill("password-123");
  await page.getByLabel("Confirm password").fill("password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Please wait for approval." })).toBeVisible();
  await expect(page.getByText(/must approve it before you can use your workspace/)).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel(/^Password/).fill("password-123");
  await page.getByLabel("Confirm password").fill("password-123");
  await page.getByLabel("Initial admin setup token").fill("first-admin-token");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Your space is ready." })).toBeVisible();
  const signInLink = page.getByRole("link", { name: /Continue to sign in/ });
  await expect(signInLink).toHaveCSS("color", "rgb(24, 30, 34)");
  await expect(signInLink).toHaveCSS("border-radius", "4px");

  await page.goto("/items");
  await page.setViewportSize({ width: 1280, height: 700 });
  await expect(page.getByRole("heading", { name: "A saved thought 18" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Settings & access" }).click();
  await expect(page.getByRole("heading", { name: "Connections." })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect.poll(() => page.evaluate(() => document.activeElement?.hasAttribute("data-page-title"))).toBe(true);

  await page.goto("/items");
  await page.getByRole("button", { name: "New note" }).click();
  await page.getByRole("textbox", { name: "Title *" }).fill("Only one request");
  const submit = page.getByRole("button", { name: "Add to notebook" });
  await submit.click();
  await expect(page.getByRole("button", { name: "Adding…" })).toBeDisabled();
  await expect.poll(() => counts.itemPosts).toBe(1);
});
