import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class FuyouWaybillPage extends BasePage {
  // 运单系统页面元素选择器
  readonly waybillList = '.waybill-list, .order-list, [data-testid="waybill-list"]';
  readonly waybillItem = '.waybill-item, .order-item, [data-testid="waybill-item"]';
  readonly searchInput = 'input[placeholder*="搜索"], input[name="search"], [data-testid="search-input"]';
  readonly searchButton = '.search-btn, button[type="submit"], [data-testid="search-button"]';
  readonly filterDropdown = '.filter-dropdown, .select-filter, [data-testid="filter-dropdown"]';
  readonly createButton = '.create-btn, .add-btn, [data-testid="create-waybill"]';
  readonly waybillTable = '.waybill-table, table, [data-testid="waybill-table"]';
  readonly pagination = '.pagination, .page-nav, [data-testid="pagination"]';

  constructor(page: Page) {
    super(page);
  }

  async navigateToWaybillList() {
    await this.goto('/order/list');
    await this.waitForPageLoad();
  }

  async searchWaybill(keyword: string) {
    await this.page.fill(this.searchInput, keyword);
    await this.page.click(this.searchButton);
    await this.page.waitForLoadState('networkidle');
  }

  async filterWaybill(filterType: string, value: string) {
    // 点击筛选下拉框
    await this.page.click(this.filterDropdown);
    
    // 选择筛选条件
    await this.page.click(`text=${filterType}`);
    
    // 选择具体值
    await this.page.click(`text=${value}`);
    
    // 等待筛选结果
    await this.page.waitForLoadState('networkidle');
  }

  async createNewWaybill() {
    await this.page.click(this.createButton);
    await this.page.waitForLoadState('networkidle');
  }

  async expectWaybillListToBeVisible() {
    await this.expectElementToBeVisible(this.waybillList);
    await this.expectElementToBeVisible(this.searchInput);
  }

  async expectWaybillTableToBeVisible() {
    await this.expectElementToBeVisible(this.waybillTable);
  }

  async expectWaybillItemCount(expectedCount: number) {
    const items = await this.page.locator(this.waybillItem).count();
    expect(items).toBe(expectedCount);
  }

  async clickWaybillItem(index: number = 0) {
    const items = this.page.locator(this.waybillItem);
    await items.nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  async getWaybillDetails(waybillId: string) {
    // 搜索运单
    await this.searchWaybill(waybillId);
    
    // 点击运单查看详情
    await this.page.click(`text=${waybillId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async editWaybill(waybillId: string) {
    // 找到运单的编辑按钮
    await this.page.click(`[data-waybill-id="${waybillId}"] .edit-btn, [data-testid="edit-waybill"]`);
    await this.page.waitForLoadState('networkidle');
  }

  async deleteWaybill(waybillId: string) {
    // 找到运单的删除按钮
    await this.page.click(`[data-waybill-id="${waybillId}"] .delete-btn, [data-testid="delete-waybill"]`);
    
    // 确认删除
    await this.page.click('.confirm-btn, .ok-btn, [data-testid="confirm-delete"]');
    await this.page.waitForLoadState('networkidle');
  }

  async exportWaybillList() {
    // 点击导出按钮
    await this.page.click('.export-btn, [data-testid="export-waybill"]');
    
    // 等待下载完成
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click('.download-btn, [data-testid="download-waybill"]');
    const download = await downloadPromise;
    
    return download;
  }

  async expectWaybillStatus(waybillId: string, expectedStatus: string) {
    const statusElement = this.page.locator(`[data-waybill-id="${waybillId}"] .status, [data-testid="waybill-status"]`);
    await expect(statusElement).toHaveText(expectedStatus);
  }

  async expectWaybillAmount(waybillId: string, expectedAmount: string) {
    const amountElement = this.page.locator(`[data-waybill-id="${waybillId}"] .amount, [data-testid="waybill-amount"]`);
    await expect(amountElement).toHaveText(expectedAmount);
  }

  async navigateToNextPage() {
    await this.page.click('.next-page, [data-testid="next-page"]');
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToPreviousPage() {
    await this.page.click('.prev-page, [data-testid="prev-page"]');
    await this.page.waitForLoadState('networkidle');
  }

  async expectCurrentPage(pageNumber: number) {
    const currentPageElement = this.page.locator('.current-page, [data-testid="current-page"]');
    await expect(currentPageElement).toHaveText(pageNumber.toString());
  }

  async takeWaybillScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/waybill-${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  async getWaybillListData() {
    const waybills = [];
    const items = this.page.locator(this.waybillItem);
    const count = await items.count();
    
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const waybill = {
        id: await item.locator('.waybill-id, [data-testid="waybill-id"]').textContent(),
        status: await item.locator('.status, [data-testid="waybill-status"]').textContent(),
        amount: await item.locator('.amount, [data-testid="waybill-amount"]').textContent(),
        date: await item.locator('.date, [data-testid="waybill-date"]').textContent(),
      };
      waybills.push(waybill);
    }
    
    return waybills;
  }
} 