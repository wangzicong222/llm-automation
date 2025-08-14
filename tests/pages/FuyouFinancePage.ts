import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class FuyouFinancePage extends BasePage {
  // 财务页面元素选择器
  readonly financeDashboard = '.finance-dashboard, .dashboard, [data-testid="finance-dashboard"]';
  readonly balanceCard = '.balance-card, .account-balance, [data-testid="balance-card"]';
  readonly transactionList = '.transaction-list, .finance-list, [data-testid="transaction-list"]';
  readonly transactionItem = '.transaction-item, .finance-item, [data-testid="transaction-item"]';
  readonly dateRangePicker = '.date-range-picker, .date-filter, [data-testid="date-range"]';
  readonly exportButton = '.export-btn, .download-btn, [data-testid="export-finance"]';
  readonly filterButton = '.filter-btn, .search-filter, [data-testid="filter-finance"]';
  readonly summaryCard = '.summary-card, .stats-card, [data-testid="summary-card"]';

  constructor(page: Page) {
    super(page);
  }

  async navigateToFinance() {
    await this.goto('/finance');
    await this.waitForPageLoad();
  }

  async navigateToTransactions() {
    await this.goto('/finance/transactions');
    await this.waitForPageLoad();
  }

  async navigateToBalance() {
    await this.goto('/finance/balance');
    await this.waitForPageLoad();
  }

  async expectFinanceDashboardToBeVisible() {
    await this.expectElementToBeVisible(this.financeDashboard);
    await this.expectElementToBeVisible(this.balanceCard);
  }

  async expectTransactionListToBeVisible() {
    await this.expectElementToBeVisible(this.transactionList);
    await this.expectElementToBeVisible(this.dateRangePicker);
  }

  async filterTransactionsByDate(startDate: string, endDate: string) {
    // 点击日期范围选择器
    await this.page.click(this.dateRangePicker);
    
    // 选择开始日期
    await this.page.fill('input[placeholder*="开始日期"]', startDate);
    
    // 选择结束日期
    await this.page.fill('input[placeholder*="结束日期"]', endDate);
    
    // 确认选择
    await this.page.click('.confirm-date, .apply-date, [data-testid="apply-date"]');
    await this.page.waitForLoadState('networkidle');
  }

  async filterTransactionsByType(transactionType: string) {
    // 点击筛选按钮
    await this.page.click(this.filterButton);
    
    // 选择交易类型
    await this.page.click(`text=${transactionType}`);
    
    // 应用筛选
    await this.page.click('.apply-filter, [data-testid="apply-filter"]');
    await this.page.waitForLoadState('networkidle');
  }

  async exportTransactions() {
    // 点击导出按钮
    await this.page.click(this.exportButton);
    
    // 等待下载完成
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.click('.download-transactions, [data-testid="download-transactions"]');
    const download = await downloadPromise;
    
    return download;
  }

  async getBalance() {
    const balanceElement = this.page.locator('.balance-amount, [data-testid="balance-amount"]');
    const balanceText = await balanceElement.textContent();
    return balanceText?.replace(/[^\d.-]/g, '') || '0';
  }

  async expectBalance(expectedBalance: string) {
    const actualBalance = await this.getBalance();
    expect(actualBalance).toBe(expectedBalance);
  }

  async getTransactionCount() {
    const items = this.page.locator(this.transactionItem);
    return await items.count();
  }

  async expectTransactionCount(expectedCount: number) {
    const actualCount = await this.getTransactionCount();
    expect(actualCount).toBe(expectedCount);
  }

  async clickTransactionItem(index: number = 0) {
    const items = this.page.locator(this.transactionItem);
    await items.nth(index).click();
    await this.page.waitForLoadState('networkidle');
  }

  async getTransactionDetails(transactionId: string) {
    // 搜索交易记录
    await this.page.fill('input[placeholder*="搜索"], [data-testid="search-transaction"]', transactionId);
    await this.page.click('.search-btn, [data-testid="search-transaction-btn"]');
    
    // 点击交易记录查看详情
    await this.page.click(`text=${transactionId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async expectTransactionStatus(transactionId: string, expectedStatus: string) {
    const statusElement = this.page.locator(`[data-transaction-id="${transactionId}"] .status, [data-testid="transaction-status"]`);
    await expect(statusElement).toHaveText(expectedStatus);
  }

  async expectTransactionAmount(transactionId: string, expectedAmount: string) {
    const amountElement = this.page.locator(`[data-transaction-id="${transactionId}"] .amount, [data-testid="transaction-amount"]`);
    await expect(amountElement).toHaveText(expectedAmount);
  }

  async getSummaryData() {
    const summaryCards = this.page.locator(this.summaryCard);
    const summary: { [key: string]: string | null } = {};
    
    const count = await summaryCards.count();
    for (let i = 0; i < count; i++) {
      const card = summaryCards.nth(i);
      const title = await card.locator('.card-title, [data-testid="card-title"]').textContent();
      const value = await card.locator('.card-value, [data-testid="card-value"]').textContent();
      summary[title || ''] = value;
    }
    
    return summary;
  }

  async expectSummaryValue(title: string, expectedValue: string) {
    const summary = await this.getSummaryData();
    expect(summary[title]).toBe(expectedValue);
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

  async takeFinanceScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/finance-${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  async getTransactionListData() {
    const transactions = [];
    const items = this.page.locator(this.transactionItem);
    const count = await items.count();
    
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const transaction = {
        id: await item.locator('.transaction-id, [data-testid="transaction-id"]').textContent(),
        type: await item.locator('.transaction-type, [data-testid="transaction-type"]').textContent(),
        amount: await item.locator('.transaction-amount, [data-testid="transaction-amount"]').textContent(),
        date: await item.locator('.transaction-date, [data-testid="transaction-date"]').textContent(),
        status: await item.locator('.transaction-status, [data-testid="transaction-status"]').textContent(),
      };
      transactions.push(transaction);
    }
    
    return transactions;
  }

  async refreshData() {
    await this.page.click('.refresh-btn, [data-testid="refresh-data"]');
    await this.page.waitForLoadState('networkidle');
  }
} 