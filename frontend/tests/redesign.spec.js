import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

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
      return state.categoriesError ? json({ detail: "Collections are unavailable." }, 503) : json(categories);
    }
    if (pathname === "/api/categories/recent") return json({ categoryId: "c1" });
    if (pathname === "/api/items" && method === "GET") {
      return state.itemsError ? json({ detail: state.itemsErrorMessage || "Notes are unavailable." }, 503) : json(items);
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

  const settingsLink = page.getByRole("link", { name: "Settings & access" });
  await settingsLink.scrollIntoViewIfNeeded();
  await expect(settingsLink).toBeInViewport();
  expect(await settingsLink.evaluate((link) => link.closest('[data-slot="sheet-content"]').scrollTop)).toBeGreaterThan(0);
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

  await page.getByRole("button", { name: "Find & filter" }).click();
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
  await expect(page.locator('section[aria-labelledby="notebook-title"] > header > div > p').first()).toBeHidden();
  await expect(page.getByText("Notes, small plans and loose ends—kept together, without the noise.", { exact: true })).toBeHidden();

  const filters = page.locator("#notebook-filters");
  const disclosure = page.getByRole("button", { name: /Find & filter/ });
  await expect(filters).toBeHidden();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(findToggle).toHaveAttribute("aria-expanded", "false");
  await findToggle.click();
  await expect(filters).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Find something" })).toBeFocused();
  await expect(findToggle).toHaveAttribute("aria-expanded", "true");
  await disclosure.click();
  await expect(filters).toBeHidden();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(disclosure).toBeFocused();
  await disclosure.click();
  await expect(page.getByRole("searchbox", { name: "Find something" })).toBeFocused();
  await findToggle.click();
  await expect(filters).toBeHidden();
  await expect(findToggle).toBeFocused();

  const statsGrid = page.getByTestId("mobile-stats-grid");
  const newNote = page.getByRole("button", { name: "New note" });
  const centers = await Promise.all([statsGrid, newNote].map((element) => element.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top + rect.height / 2;
  })));
  expect(Math.abs(centers[0] - centers[1])).toBeLessThanOrEqual(4);

  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const [narrowButton, narrowStats] = await Promise.all([newNote, statsGrid].map((element) => element.evaluate((node) => node.getBoundingClientRect().toJSON())));
  expect(narrowButton.bottom).toBeLessThanOrEqual(narrowStats.top);
  expect(narrowStats.width).toBeGreaterThanOrEqual(228);
  expect(consoleErrors).toEqual([]);
});

test("filter disclosure is always expanded at 640px and up", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 639, height: 720 });
  await page.goto("/items");
  await expect(page.locator("#notebook-filters")).toBeHidden();
  await page.setViewportSize({ width: 640, height: 720 });
  await expect(page.locator("#notebook-filters")).toBeVisible();
  expect(await page.locator("#notebook-filters").getAttribute("hidden")).toBeNull();
  await expect(page.getByRole("button", { name: "Find notes" })).toBeHidden();
  await expect(page.locator("header.sticky").getByText(/A personal index.*Notebook/)).toBeVisible();
  await expect(page.locator("header.sticky").getByText("Keep the useful things close.")).toBeVisible();
  expect((await page.getByRole("button", { name: "Open navigation" }).boundingBox()).width).toBe(40);
  await page.reload();
  expect(await page.locator("#notebook-filters").getAttribute("hidden")).toBeNull();
});

test("phone topbar titles match other workspace routes and Find stays Notebook-only", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 375, height: 667 });
  for (const [path, title] of [["/categories", "Collections"], ["/users", "People"], ["/settings", "Settings"]]) {
    await page.goto(path);
    const toolbar = page.locator("header.sticky");
    await expect(toolbar.getByText(title, { exact: true })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Find notes" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
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

test("collection field and CSV importer are accessible and keyboard-operable", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/items");
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page.locator("form").getByRole("combobox", { name: "Collection" })).toBeVisible();

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
  await dialog.getByRole("button", { name: "Delete note" }).click();
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
  await expect(signInLink).toHaveCSS("color", "rgb(255, 255, 255)");

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
