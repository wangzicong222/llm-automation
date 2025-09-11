import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly baseURL: string;

  constructor(page: Page, baseURL?: string) {
    this.page = page;
    // 优先使用传入的 baseURL，其次使用环境变量，最后使用默认值
    this.baseURL = baseURL || process.env.TEST_BASE_URL || '';
  }

  async goto(path: string = '/') {
    await this.page.goto(`${this.baseURL}${path}`);
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async getElement(selector: string): Promise<Locator> {
    return this.page.locator(selector);
  }

  async getElementByTestId(testId: string): Promise<Locator> {
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  async clickElement(selector: string) {
    await this.page.click(selector);
  }

  async clickElementByTestId(testId: string) {
    await (await this.getElementByTestId(testId)).click();
  }

  async fillInput(selector: string, value: string) {
    await this.page.fill(selector, value);
  }

  async fillInputByTestId(testId: string, value: string) {
    await (await this.getElementByTestId(testId)).fill(value);
  }

  async selectOption(selector: string, value: string) {
    await this.page.selectOption(selector, value);
  }

  async selectOptionByTestId(testId: string, value: string) {
    await (await this.getElementByTestId(testId)).selectOption(value);
  }

  async checkCheckbox(selector: string) {
    await this.page.check(selector);
  }

  async checkCheckboxByTestId(testId: string) {
    await (await this.getElementByTestId(testId)).check();
  }

  async uncheckCheckbox(selector: string) {
    await this.page.uncheck(selector);
  }

  async uncheckCheckboxByTestId(testId: string) {
    await (await this.getElementByTestId(testId)).uncheck();
  }

  async getText(selector: string): Promise<string> {
    return await this.page.textContent(selector) || '';
  }

  async getTextByTestId(testId: string): Promise<string> {
    return await (await this.getElementByTestId(testId)).textContent() || '';
  }

  async isVisible(selector: string): Promise<boolean> {
    return await this.page.isVisible(selector);
  }

  async isVisibleByTestId(testId: string): Promise<boolean> {
    return await (await this.getElementByTestId(testId)).isVisible();
  }

  async waitForElement(selector: string, timeout: number = 5000) {
    await this.page.waitForSelector(selector, { timeout });
  }

  async waitForElementByTestId(testId: string, timeout: number = 5000) {
    await this.page.waitForSelector(`[data-testid="${testId}"]`, { timeout });
  }

  async expectElementToBeVisible(selector: string) {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  async expectElementToBeVisibleByTestId(testId: string) {
    await expect(await this.getElementByTestId(testId)).toBeVisible();
  }

  async expectElementToHaveText(selector: string, text: string) {
    await expect(this.page.locator(selector)).toHaveText(text);
  }

  async expectElementToHaveTextByTestId(testId: string, text: string) {
    await expect(await this.getElementByTestId(testId)).toHaveText(text);
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }

  async getCurrentURL(): Promise<string> {
    return this.page.url();
  }

  async expectURLToContain(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }
} 