# 公司 Web 应用自动化测试设置指南

## 🎯 概述

本指南将帮助你配置 LLM Automation 项目来测试你们公司的 Web 应用。

## 📋 准备工作

### 1. 收集应用信息

在开始配置之前，请准备以下信息：

- **应用名称**: 例如 "CRM系统"、"电商平台" 等
- **应用 URL**: 例如 "https://app.company.com"
- **技术栈**: React、Vue、Angular 等
- **认证方式**: 是否需要登录，使用什么认证方式
- **主要功能模块**: 登录、用户管理、订单管理等

### 2. 测试环境准备

- 确保有测试环境的访问权限
- 准备测试账号和密码
- 确认测试数据的可用性

## 🚀 快速配置

### 步骤1：运行配置向导

```bash
npm run configure
```

配置向导会询问以下问题：

1. **应用名称**: 输入你们公司的应用名称
2. **应用 URL**: 输入应用的完整 URL
3. **技术栈**: 选择应用使用的技术栈
4. **认证需求**: 是否需要登录认证
5. **功能模块**: 列出主要功能模块

### 步骤2：自定义页面对象

配置完成后，编辑生成的页面对象文件：

```bash
# 编辑页面对象
code tests/pages/

# 编辑测试用例
code tests/specs/
```

### 步骤3：调整选择器

根据实际应用的 DOM 结构，更新页面对象中的选择器：

```typescript
// 示例：更新选择器
export class LoginPage extends BasePage {
  // 根据实际应用调整这些选择器
  readonly usernameInput = '#username, [data-testid="username"], input[name="username"]';
  readonly passwordInput = '#password, [data-testid="password"], input[name="password"]';
  readonly loginButton = '#login-btn, [data-testid="login-button"], button[type="submit"]';
}
```

## 🔧 高级配置

### 1. 环境变量配置

编辑 `.env` 文件，根据实际需求调整：

```bash
# 应用配置
APP_URL=https://your-app.company.com
TEST_USERNAME=your-test-username
TEST_PASSWORD=your-test-password

# 测试配置
TEST_TIMEOUT=60000  # 增加超时时间
TEST_RETRIES=3      # 增加重试次数
```

### 2. Playwright 配置调整

根据应用特点调整 `playwright.config.ts`：

```typescript
export default defineConfig({
  use: {
    // 设置视口大小
    viewport: { width: 1920, height: 1080 },
    
    // 设置用户代理
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    
    // 设置超时时间
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },
  
  // 只测试特定浏览器
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### 3. 认证处理

如果应用需要认证，创建认证助手：

```typescript
// tests/helpers/auth-helper.ts
export class AuthHelper {
  static async login(page: Page, username: string, password: string) {
    await page.goto('/login');
    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('#login-button');
    await page.waitForURL('**/dashboard');
  }
  
  static async logout(page: Page) {
    await page.click('#logout-button');
    await page.waitForURL('**/login');
  }
}
```

## 📝 测试用例编写

### 1. 基础测试结构

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('登录功能测试', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('应该能够成功登录', async () => {
    await loginPage.navigateToLogin();
    await loginPage.login(process.env.TEST_USERNAME!, process.env.TEST_PASSWORD!);
    await loginPage.expectToBeLoggedIn();
  });
});
```

### 2. 数据驱动测试

```typescript
const testData = [
  { username: 'user1', password: 'pass1', expected: 'success' },
  { username: 'user2', password: 'wrong', expected: 'error' },
];

testData.forEach(({ username, password, expected }) => {
  test(`登录测试: ${username}`, async ({ page }) => {
    // 测试逻辑
  });
});
```

### 3. API 测试集成

```typescript
test('应该能够创建新用户', async ({ page, request }) => {
  // UI 测试
  await page.goto('/users/create');
  await page.fill('#username', 'newuser');
  await page.click('#create-button');
  
  // API 验证
  const response = await request.get('/api/users/newuser');
  expect(response.ok()).toBeTruthy();
});
```

## 🤖 LLM 测试生成

### 1. 生成特定功能测试

```bash
# 生成登录功能测试
npm run llm:generate -- --feature="用户登录" --description="测试用户登录功能，包括成功登录和失败登录场景"

# 生成表单测试
npm run llm:generate -- --feature="用户注册" --description="测试用户注册表单，包括字段验证和提交功能"
```

### 2. 自定义提示词

编辑 `scripts/llm-generator.js` 中的提示词模板：

```javascript
async generateTestPrompt(feature, pageDescription) {
  return `
你是一个专业的Web UI自动化测试工程师。
请为以下功能生成Playwright测试用例：

应用信息：
- 应用URL: ${process.env.APP_URL}
- 技术栈: ${process.env.TECH_STACK}
- 认证方式: ${process.env.TEST_USERNAME ? '用户名密码' : '无'}

功能描述：${feature}
页面描述：${pageDescription}

请生成符合以下要求的测试用例：
1. 使用页面对象模式
2. 包含适当的等待和断言
3. 处理可能的错误情况
4. 使用环境变量中的测试数据
5. 遵循最佳实践
  `;
}
```

## 📊 测试报告和监控

### 1. 生成测试报告

```bash
# 运行测试并生成报告
npm run test -- --reporter=html

# 查看报告
npx playwright show-report
```

### 2. 持续集成配置

创建 `.github/workflows/test.yml`：

```yaml
name: UI Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install
      - run: npm run test
      - uses: actions/upload-artifact@v2
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 🔍 调试技巧

### 1. 使用 Playwright Inspector

```bash
# 调试模式运行测试
npm run test:debug

# 或者使用 UI 模式
npm run test:ui
```

### 2. 截图和视频

```typescript
test('调试测试', async ({ page }) => {
  await page.goto('/login');
  
  // 截图
  await page.screenshot({ path: 'debug-screenshot.png' });
  
  // 录制视频（在配置中启用）
  await page.click('#login-button');
});
```

### 3. 控制台日志

```typescript
test('调试网络请求', async ({ page }) => {
  // 监听网络请求
  page.on('request', request => console.log('请求:', request.url()));
  page.on('response', response => console.log('响应:', response.status()));
  
  await page.goto('/api/data');
});
```

## 🚨 常见问题解决

### 1. 元素定位问题

```typescript
// 使用多种选择器策略
readonly element = [
  '[data-testid="my-element"]',
  '#my-element',
  '.my-class',
  'text=My Text'
].join(', ');
```

### 2. 等待策略

```typescript
// 等待元素可见
await page.waitForSelector('#element', { state: 'visible' });

// 等待网络请求完成
await page.waitForResponse(response => response.url().includes('/api/data'));

// 等待页面加载
await page.waitForLoadState('networkidle');
```

### 3. 认证问题

```typescript
// 保存认证状态
const authFile = 'playwright/.auth/user.json';
await context.storageState({ path: authFile });

// 使用保存的认证状态
const context = await browser.newContext({
  storageState: authFile
});
```

## 📚 最佳实践

1. **选择器策略**: 优先使用 `data-testid` 属性
2. **等待策略**: 使用明确的等待条件
3. **错误处理**: 包含适当的错误处理和重试机制
4. **测试数据**: 使用独立的测试数据
5. **并行执行**: 确保测试可以并行运行
6. **报告分析**: 定期分析测试报告，优化测试用例

## 🎉 下一步

配置完成后，你可以：

1. 运行 `npm run test` 执行测试
2. 使用 `npm run test:ui` 进行交互式测试
3. 使用 LLM 功能生成更多测试用例
4. 集成到 CI/CD 流程中

需要帮助解决任何问题，请查看项目文档或联系技术支持。 