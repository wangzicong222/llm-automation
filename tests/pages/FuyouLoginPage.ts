import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import 'dotenv/config';

export class FuyouLoginPage extends BasePage {
  // 福佑卡车登录页面元素选择器
  readonly usernameInput = 'input[name="username"], input[placeholder*="用户名"], input[placeholder*="手机号"]';
  readonly passwordInput = 'input[name="password"], input[type="password"]';
  readonly captchaInput = 'input[name="captcha"], input[placeholder*="验证码"], input[name="code"]';
  readonly captchaButton = '.captcha-btn, .send-code-btn, button:has-text("获取验证码"), button:has-text("发送验证码")';
  readonly loginButton = '#loginBtn, button:has-text("登 录")';
  readonly loginForm = '.login-form, form';
  readonly errorMessage = '.error-message, .alert-error, [data-testid="error-message"]';
  readonly successMessage = '.success-message, .alert-success';

  constructor(page: Page) {
    super(page);
  }

  async navigateToLogin() {
    // 直接使用登录 URL，而不是相对路径
    const loginUrl = process.env.LOGIN_URL;
    if (!loginUrl) {
      throw new Error('未配置 LOGIN_URL，请在 .env 中设置目标环境的登录地址');
    }
    await this.page.goto(loginUrl);
    await this.waitForPageLoad();
  }

  async login(username: string, password: string, captcha?: string) {
    // 等待页面加载
    await this.page.waitForLoadState('networkidle');
    
    // 填写用户名
    await this.page.fill(this.usernameInput, username);
    
    // 填写密码
    await this.page.fill(this.passwordInput, password);
    
    // 处理验证码
    if (captcha) {
      await this.page.fill(this.captchaInput, captcha);
    } else {
      // 如果没有提供验证码，尝试获取验证码
      await this.getCaptcha();
    }
    
    // 点击登录按钮
    await this.page.click(this.loginButton);
    
    // 等待登录完成
    await this.page.waitForLoadState('networkidle');
  }

  async getCaptcha() {
    // 检查是否有验证码按钮
    const captchaButton = this.page.locator(this.captchaButton);
    if (await captchaButton.isVisible()) {
      console.log('📱 点击获取验证码按钮...');
      await captchaButton.click();
      
      // 等待验证码发送
      await this.page.waitForTimeout(2000);
      
      // 这里可以添加等待验证码输入的逻辑
      // 或者从环境变量中读取验证码
      const captcha = process.env.TEST_CAPTCHA;
      if (captcha) {
        await this.page.fill(this.captchaInput, captcha);
        console.log('✅ 已填写验证码');
      } else {
        console.log('⚠️  请在 .env 文件中配置 TEST_CAPTCHA 或手动输入验证码');
      }
    } else {
      console.log('ℹ️  未找到验证码按钮，可能不需要验证码');
    }
  }

  async loginWithEnvCredentials() {
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;
    const captcha = process.env.TEST_CAPTCHA;
    
    if (!username || !password) {
      throw new Error('请在 .env 文件中配置 TEST_USERNAME 和 TEST_PASSWORD');
    }
    
    await this.login(username, password, captcha);
  }

  async expectLoginPageToBeVisible() {
    await this.expectElementToBeVisible(this.loginForm);
    await this.expectElementToBeVisible(this.usernameInput);
    await this.expectElementToBeVisible(this.passwordInput);
    await this.expectElementToBeVisible(this.loginButton);
    
    // 检查是否有验证码相关元素
    const hasCaptcha = await this.page.locator(this.captchaInput).isVisible();
    const hasCaptchaButton = await this.page.locator(this.captchaButton).isVisible();
    
    if (hasCaptcha || hasCaptchaButton) {
      console.log('📱 检测到验证码功能');
      if (hasCaptcha) {
        await this.expectElementToBeVisible(this.captchaInput);
      }
      if (hasCaptchaButton) {
        await this.expectElementToBeVisible(this.captchaButton);
      }
    }
  }

  async expectLoginSuccess() {
    // 从 TEST_BASE_URL 推导期望的业务域名
    const expectedBase = process.env.TEST_BASE_URL;
    let expectedHost: string | null = null;
    try {
      if (expectedBase) expectedHost = new URL(expectedBase).host;
    } catch {}

    if (expectedHost) {
      await this.page.waitForURL(`**//${expectedHost}/**`, { timeout: 10000 });
      const currentUrl = this.page.url();
      expect(currentUrl).toContain(expectedHost);
    } else {
      // 无法推导主域名时，退化为等待网络空闲
      await this.page.waitForLoadState('networkidle');
    }
  }

  async expectLoginError(message?: string) {
    await this.page.waitForSelector(this.errorMessage, { timeout: 5000 });
    
    if (message) {
      await this.expectElementToHaveText(this.errorMessage, message);
    }
  }

  async expectToBeLoggedIn() {
    // 检查是否已登录（可能需要根据实际页面调整）
    const expectedBase = process.env.TEST_BASE_URL;
    let expectedHost: string | null = null;
    try {
      if (expectedBase) expectedHost = new URL(expectedBase).host;
    } catch {}
    const currentUrl = this.page.url();
    if (expectedHost) {
      expect(currentUrl).toContain(expectedHost);
    }
    
    // 检查是否存在登录后才有的元素（右上角用户名）
    await expect(this.page.locator('span.name')).toBeVisible();
  }

  async logout() {
    // 点击用户菜单
    await this.page.click('.user-menu, .avatar, [data-testid="user-menu"]');
    
    // 点击退出按钮
    await this.page.click('.logout-btn, [data-testid="logout-button"]');
    
    // 等待退出完成
    await this.page.waitForURL('**/login**');
  }

  async clearForm() {
    await this.page.fill(this.usernameInput, '');
    await this.page.fill(this.passwordInput, '');
  }

  async validateFormValidation() {
    // 测试空表单提交
    await this.page.click(this.loginButton);
    await this.expectElementToBeVisible(this.usernameInput);
    
    // 测试只填写用户名
    await this.page.fill(this.usernameInput, 'testuser');
    await this.page.click(this.loginButton);
    await this.expectElementToBeVisible(this.passwordInput);
  }

  async takeLoginScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/login-${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }
} 