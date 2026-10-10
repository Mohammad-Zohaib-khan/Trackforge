/**
 * Browser smoke test of the main user journey against a running TrackForge.
 *
 *   npm i -D playwright && npx playwright install chromium
 *   BASE=http://localhost:5173 node scripts/e2e-smoke.mjs ./e2e-output
 *
 * Creates a fresh account each run (e2e-<timestamp>@example.test). Run it only
 * against development or disposable environments.
 */
import { chromium as pw } from 'playwright';
import fs from 'node:fs';
const base = process.env.BASE ?? 'http://localhost:5173';
const out = process.argv[2] ?? '.';
fs.mkdirSync(out, { recursive: true });
const browser = await pw.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true });
await ctx.addInitScript(() => { try { localStorage.setItem('trackforge:effects', 'off'); } catch { /* storage blocked: shader stays on */ } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
const results = [];
const step = async (name, fn) => { try { await fn(); results.push(`PASS ${name}`); console.log('PASS', name); } catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); console.log('FAIL', name, e.message.split('\n')[0]);  await page.screenshot({ path: `${out}/fail-${results.length}.png`, timeout: 8000 }).catch(() => {}); } };
const expectText = async (text, timeout = 8000) => page.getByText(text, { exact: false }).first().waitFor({ timeout });
const email = `e2e-${Date.now()}@example.test`;
const dialog = () => page.locator('dialog[open]');

await step('register via UI', async () => {
  await page.goto(base + '/register');
  await page.getByLabel('Name').fill('Riya Test');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('a-strong-pass-42');
  await page.getByLabel('Currency').selectOption('USD');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/app');
  await expectText('Nothing recorded yet');
});
await step('add income from empty state', async () => {
  await page.getByRole('button', { name: 'Add your first transaction' }).click();
  await dialog().getByText('Income', { exact: true }).click();
  await dialog().getByLabel('Amount').fill('2500');
  await dialog().getByLabel('Category').selectOption({ label: 'Salary' });
  await dialog().getByRole('button', { name: 'Add income' }).click();
  await expectText('Income recorded');
});
await step('add expense', async () => {
  await page.getByRole('button', { name: 'Add transaction' }).first().click();
  await dialog().getByLabel('Amount').fill('120.50');
  await dialog().getByLabel('Category').selectOption({ label: 'Groceries' });
  await dialog().getByLabel('Merchant or payee').fill('Green Basket');
  await dialog().getByRole('button', { name: 'Add expense' }).click();
  await expectText('Expense recorded');
});
await step('validation blocks bad amount', async () => {
  await page.getByRole('button', { name: 'Add transaction' }).first().click();
  await dialog().getByLabel('Amount').fill('12.345');
  await dialog().getByRole('button', { name: 'Add expense' }).click();
  await dialog().getByText('Enter an amount like 1250 or 1250.50').waitFor({ timeout: 5000 });
  await dialog().getByRole('button', { name: 'Cancel' }).click();
});
await step('dashboard net reflects records', async () => {
  await page.getByLabel(/Net cash flow: \$2,379\.50/).waitFor({ timeout: 8000 });
});
await step('transactions list, search, edit', async () => {
  await page.goto(base + '/app/transactions');
  await expectText('2 transactions recorded');
  await page.getByLabel('Search merchant or note').fill('green');
  await expectText('1 transaction matches');
  await page.getByRole('button', { name: 'Edit Green Basket' }).first().click();
  await dialog().getByLabel('Amount').fill('130.25');
  await dialog().getByRole('button', { name: 'Save changes' }).click();
  await expectText('Transaction updated');
  await page.locator('table').getByText('−$130.25').waitFor({ timeout: 5000 });
});
await step('delete with confirm, then undo', async () => {
  await page.getByRole('button', { name: 'Delete Green Basket' }).first().click();
  await dialog().getByRole('button', { name: 'Delete transaction' }).click();
  await expectText('Transaction deleted');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expectText('Transaction restored');
  await page.locator('table').getByText('Green Basket').first().waitFor({ timeout: 5000 });
});
await step('create and archive category', async () => {
  await page.goto(base + '/app/categories');
  await page.getByRole('button', { name: 'New expense category' }).click();
  await dialog().getByLabel('Name').fill('Pets');
  await dialog().getByRole('button', { name: 'Add category' }).click();
  await expectText('Pets added');
  await page.getByRole('button', { name: 'Archive Pets' }).click();
  await expectText('Pets archived');
});
await step('budget shows overspend', async () => {
  await page.goto(base + '/app/budgets');
  await page.getByRole('button', { name: 'Add budget' }).first().click();
  await dialog().getByLabel('Expense category').selectOption({ label: 'Groceries' });
  await dialog().getByLabel('Monthly limit').fill('100');
  await dialog().getByRole('button', { name: 'Add budget' }).click();
  await expectText('Budget added');
  await expectText('Over budget');
  await expectText('$30.25 over');
});
await step('csv export downloads safe file', async () => {
  await page.goto(base + '/app/reports');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('button', { name: 'Download CSV' }).click()]);
  const file = `${out}/export.csv`;
  await download.saveAs(file);
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('Green Basket') || !text.includes('130.25') || !text.includes('2500.00')) throw new Error('CSV content unexpected: ' + text.slice(0, 200));
});
await step('preferences change date style', async () => {
  await page.goto(base + '/app/settings');
  await page.getByLabel('Date style').selectOption('iso');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expectText('Preferences saved');
  await page.goto(base + '/app/transactions');
  await page.locator('table').getByText(/^\d{4}-\d{2}-\d{2}$/).first().waitFor({ timeout: 8000 });
});
await step('sign out and protected route redirects', async () => {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await page.goto(base + '/app/budgets');
  await page.waitForURL('**/login');
});
await page.screenshot({ path: `${out}/e2e-end.png` });
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
