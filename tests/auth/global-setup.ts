import { chromium, FullConfig } from '@playwright/test';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { FuyouLoginPage } from '../pages/FuyouLoginPage';

export default async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!username || !password) {
    throw new Error('请在 .env 中配置 TEST_USERNAME 与 TEST_PASSWORD');
  }

  const login = new FuyouLoginPage(page);
  await login.navigateToLogin();
  // 验证码固定 1123
  await login.login(username, password, '1123');
  await login.expectLoginSuccess();

  const authDir = path.resolve(__dirname, '../../.auth');
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: path.join(authDir, 'user.json') });

  await browser.close();
}


