const { chromium, firefox, webkit } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

function nowIso() {
  return new Date().toISOString();
}

function ensureDirSync(dirPath) {
  const fsSync = require('fs');
  if (!fsSync.existsSync(dirPath)) {
    fsSync.mkdirSync(dirPath, { recursive: true });
  }
}

async function writeFileSafe(filePath, content) {
  ensureDirSync(path.dirname(filePath));
  await fs.writeFile(filePath, content);
}

function pickBrowser(name) {
  switch ((name || 'chromium').toLowerCase()) {
    case 'chromium': return chromium;
    case 'firefox': return firefox;
    case 'webkit': return webkit;
    default: return chromium;
  }
}

function splitTextLines(text) {
  if (!text) return [];
  let cleanText = text;
  cleanText = cleanText
    .replace(/<ol[^>]*>/g, '')
    .replace(/<\/ol>/g, '')
    .replace(/<li[^>]*>/g, '')
    .replace(/<\/li>/g, '\n')
    .replace(/<br\s*\/?>(?=\s*\n?)/g, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
  const lines = cleanText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const result = [];
  lines.forEach(line => {
    const numberedMatch = line.match(/^(\d+)\.\s*(.*)$/);
    const bulletMatch = line.match(/^[-•*]\s*(.*)$/);
    if (numberedMatch) result.push(numberedMatch[2].trim());
    else if (bulletMatch) result.push(bulletMatch[1].trim());
    else result.push(line);
  });
  return result.filter(Boolean);
}

function inferActionFromText(text) {
  const t = text || '';
  // 非严格规则：先覆盖常见中文用语
  if (/点击|单击/.test(t)) return { verb: 'click', raw: t };
  if (/输入|填写/.test(t)) return { verb: 'fill', raw: t };
  if (/选择|下拉|选项/.test(t)) return { verb: 'select', raw: t };
  if (/勾选|选中/.test(t)) return { verb: 'check', raw: t };
  if (/取消勾选|取消选中/.test(t)) return { verb: 'uncheck', raw: t };
  if (/打开|进入|跳转/.test(t)) return { verb: 'navigate', raw: t };
  return { verb: 'assert', raw: t }; // 兜底视为断言类
}

function extractName(text) {
  // 提取 “引号内” 或 常见控件名称 作为目标名
  const m = text.match(/[“"']([^”"']+)[”"']/);
  if (m) return m[1];
  const m2 = text.match(/按钮|输入框|文本域|下拉|单选|复选|标题|链接|弹窗|对话框/);
  return m2 ? m2[0] : undefined;
}

function extractLabelFromSentence(text) {
  if (!text) return undefined;
  const t = text.replace(/\s+/g, '');
  // 形如：在押金名称输入框中输入/在押金名称中输入/向押金名称输入...
  const m1 = t.match(/在(.+?)(输入框|文本框|输入栏|字段)?(中|里)?(输入|填写)/);
  if (m1 && m1[1]) return m1[1];
  // 形如：输入“xxx”到押金名称/填写“xxx”至押金名称
  const m2 = t.match(/(输入|填写)[“"'].*?[”"'].*?(到|至)(.+?)(中|里)?$/);
  if (m2 && m2[3]) return m2[3];
  return undefined;
}

async function resolveLocator(page, action) {
  const name = extractName(action.raw) || action.name;
  // 多策略递降
  const candidates = [];
  if (action.verb === 'fill') {
    if (name) candidates.push(page.getByLabel(name));
    if (name) candidates.push(page.getByPlaceholder(name));
    const label = extractLabelFromSentence(action.raw);
    if (label) {
      candidates.push(
        page
          .locator('.ant-modal-content .ant-form-item:has(label:has-text("' + label + '"))')
          .locator('input:not([type="hidden"]), textarea')
          .first()
      );
      candidates.push(
        page
          .locator('.ant-form-item:has(label:has-text("' + label + '"))')
          .locator('input:not([type="hidden"]), textarea')
          .first()
      );
    }
  }
  if (name) candidates.push(page.getByRole('button', { name }));
  if (name) candidates.push(page.getByText(name));
  candidates.push(page.locator(`[data-testid="${name || ''}"]`));

  for (const c of candidates) {
    try {
      await c.first().waitFor({ state: 'visible', timeout: 2000 });
      return c.first();
    } catch {}
  }
  // 兜底：返回一个不会报错的 locator，但操作时可能失败
  return page.locator('body >> :scope');
}

async function runAction(page, action) {
  const locator = await resolveLocator(page, action);
  switch (action.verb) {
    case 'click':
      await locator.click();
      return;
    case 'fill': {
      // 优先解析“输入/填写"xxx"”中的值
      let value = (action.raw.match(/(输入|填写)[“"'](.+?)[”"']/) || [])[2] || '';
      if (!value) value = (action.raw.match(/输入(.+?)(?:。|，|,|$)/) || [])[1] || '';
      await locator.fill(value.replace(/^“|”|"/g, '').trim());
      return;
    }
    case 'select':
      // 简化：尝试点击选项文本
      const name = extractName(action.raw);
      if (name) await page.getByText(name).first().click();
      return;
    case 'check':
      await locator.check({ force: true }).catch(async () => locator.click());
      return;
    case 'uncheck':
      await locator.uncheck({ force: true }).catch(async () => locator.click());
      return;
    case 'navigate': {
      // 若句子未包含URL，则忽略，依赖外部传入 pageUrl
      const urlMatch = action.raw.match(/https?:[^\s]+/);
      if (urlMatch) await page.goto(urlMatch[0]);
      return;
    }
    default:
      return; // 断言留给断言阶段
  }
}

function inferExpectations(text) {
  const t = text || '';
  const items = [];
  if (/弹窗.*(显示|弹出)/.test(t)) items.push({ type: 'modalVisible' });
  if (/标题.*(正确|显示)/.test(t)) items.push({ type: 'textContains', value: '新增押金' });
  if (/按钮.*(显示|存在)/.test(t)) items.push({ type: 'textContains', value: '确定' });
  if (/必填.*(红|标识|提示)/.test(t)) items.push({ type: 'textContains', value: '必填' });
  if (/URL|链接/.test(t) && /包含/.test(t)) items.push({ type: 'urlContains', value: /\w+/ });
  return items.length ? items : [{ type: 'textSoft', value: t }];
}

async function runExpectation(page, exp) {
  const { expect } = require('@playwright/test');
  switch (exp.type) {
    case 'modalVisible':
      await expect(page.getByRole('dialog')).toBeVisible();
      return;
    case 'textContains':
      await expect(page.getByText(exp.value)).toBeVisible();
      return;
    case 'urlContains':
      await expect(page).toHaveURL(exp.value);
      return;
    case 'textSoft':
      await expect(page.getByText(new RegExp(exp.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeVisible();
      return;
    default:
      return;
  }
}

class DirectExecutor {
  constructor(baseOutputDir = path.join(process.cwd(), 'test-results', 'direct-exec')) {
    this.baseOutputDir = baseOutputDir;
    ensureDirSync(this.baseOutputDir);
  }

  async #looksLikeLoginPage(page) {
    try {
      const url = page.url();
      if (/login|auth|signin/i.test(url)) return true;
      const hints = ['登录', '密码', '验证码', '账号', '用户名'];
      for (const t of hints) {
        if (await page.getByText(t, { exact: false }).first().isVisible({ timeout: 500 }).catch(() => false)) return true;
      }
    } catch {}
    return false;
  }

  async executeCases({ cases = [], pageUrl, browser = 'chromium', headless = true, timeout = 30000, retries = 0, storageState, onEvent }) {
    const browserType = pickBrowser(browser);
    const launch = await browserType.launch({ headless });
    const results = [];

    try {
      for (const testCase of cases) {
        const runId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const caseDir = path.join(this.baseOutputDir, String(testCase.id || testCase.title || runId));
        ensureDirSync(caseDir);
        const framesDir = path.join(caseDir, 'frames');
        ensureDirSync(framesDir);

        const summary = { id: testCase.id, title: testCase.title, success: true, steps: [], startedAt: nowIso(), screenshots: [], video: undefined };

        const context = await launch.newContext({
          ...(storageState ? { storageState } : {}),
          recordVideo: { dir: path.join(caseDir, 'video'), size: { width: 1280, height: 720 } }
        });
        const page = await context.newPage();
        page.setDefaultTimeout(timeout);

        // 转发浏览器日志
        page.on('console', msg => {
          if (typeof onEvent === 'function') onEvent('log', { level: msg.type(), text: msg.text(), ts: Date.now(), caseId: testCase.id, title: testCase.title });
        });
        page.on('pageerror', err => {
          if (typeof onEvent === 'function') onEvent('log', { level: 'error', text: err.message, ts: Date.now(), caseId: testCase.id, title: testCase.title });
        });
        try {
          // 1) 若配置了登录入口，优先走登录域，确保单点登录态就绪
          const loginUrl = process.env.LOGIN_URL;
          if (loginUrl) {
            try {
              await page.goto(loginUrl);
              await page.waitForLoadState('networkidle');
              // 检测是否停留在登录页，若是则尝试自动登录
              const looksLikeLogin = await this.#looksLikeLoginPage(page);
              if (looksLikeLogin) {
                if (typeof onEvent === 'function') onEvent('log', { level: 'info', text: '检测到登录页，尝试自动登录…', ts: Date.now(), caseId: testCase.id, title: testCase.title });
                await this.#performAutoLogin(page, onEvent, testCase);
                await page.waitForLoadState('networkidle');
              }
            } catch (e) {
              if (typeof onEvent === 'function') onEvent('log', { level: 'warn', text: `预登录流程出现问题：${e.message}` , ts: Date.now(), caseId: testCase.id, title: testCase.title });
            }
          }

          // 2) 进入目标业务页面
          if (pageUrl) {
            // 若目标域为财务域，且当前仍在登录/门户域，优先尝试从门户点击跳转，确保 SSO 初始化
            try {
              const targetHost = new URL(pageUrl).host;
              const curHost = new URL(page.url()).host;
              if (/caiwu\.fuyoukache\.com$/.test(targetHost) && !/caiwu\.fuyoukache\.com$/.test(curHost)) {
                // 尝试点击门户中的“财务”入口或指向财务域的链接
                const financeLink = page.locator('a[href*="caiwu.fuyoukache.com"]').first();
                const financeTile = page.getByText('财务', { exact: false }).first();
                if (await financeLink.isVisible({ timeout: 1000 }).catch(() => false)) {
                  await financeLink.click();
                  await page.waitForLoadState('networkidle');
                } else if (await financeTile.isVisible({ timeout: 1000 }).catch(() => false)) {
                  await financeTile.click();
                  await page.waitForLoadState('networkidle');
                }
              }
            } catch {}

            await page.goto(pageUrl);
            await page.waitForLoadState('networkidle');

            // 若直接落到业务页却仍出现登录态缺失，二次尝试登录
            const stillLogin = await this.#looksLikeLoginPage(page);
            if (stillLogin) {
              try {
                if (typeof onEvent === 'function') onEvent('log', { level: 'info', text: '业务页检测到未登录，二次自动登录…', ts: Date.now(), caseId: testCase.id, title: testCase.title });
                await this.#performAutoLogin(page, onEvent, testCase);
                await page.goto(pageUrl);
                await page.waitForLoadState('networkidle');
              } catch (e) {
                if (typeof onEvent === 'function') onEvent('log', { level: 'error', text: `二次登录失败：${e.message}`, ts: Date.now(), caseId: testCase.id, title: testCase.title });
                summary.success = false;
              }
            }

            // 首帧
            const fp = path.join(framesDir, `frame-${Date.now()}.png`);
            await page.screenshot({ path: fp, fullPage: true }).catch(() => {});
            if (typeof onEvent === 'function') onEvent('frame', { url: this.#toAssetUrl(fp), ts: Date.now(), caseId: testCase.id, title: testCase.title });
          }

          const lines = (testCase.steps || []).flatMap(s => splitTextLines(s.action || s.step || ''));
          for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const action = inferActionFromText(raw);
            let attempt = 0;
            let ok = false;
            while (attempt <= retries && !ok) {
              try {
                await runAction(page, action);
                ok = true;
              } catch (e) {
                attempt++;
                if (attempt > retries) {
                  summary.success = false;
                  const p = path.join(caseDir, `step-${i+1}-error.png`);
                  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
                  summary.screenshots.push(p);
                  summary.steps.push({ index: i+1, action: action.verb, raw, success: false, error: e.message });
                }
              }
            }
            if (ok) summary.steps.push({ index: i+1, action: action.verb, raw, success: true });
            // 每步后截图一张用于实时预览
            try {
              const fp = path.join(framesDir, `frame-${Date.now()}-${i+1}.png`);
              await page.screenshot({ path: fp, fullPage: true });
              if (typeof onEvent === 'function') onEvent('frame', { url: this.#toAssetUrl(fp), ts: Date.now(), caseId: testCase.id, title: testCase.title });
            } catch {}
          }

          const expects = [
            ...splitTextLines(testCase.expectedResult || ''),
            ...((testCase.steps || []).flatMap(s => splitTextLines(s.expected || '')))
          ];
          for (let j = 0; j < expects.length; j++) {
            const items = inferExpectations(expects[j]);
            for (const it of items) {
              try {
                await runExpectation(page, it);
                summary.steps.push({ index: `E${j+1}`, expect: it.type, value: it.value, success: true });
              } catch (e) {
                summary.success = false;
                const p = path.join(caseDir, `expect-${j+1}-error.png`);
                await page.screenshot({ path: p, fullPage: true }).catch(() => {});
                summary.screenshots.push(p);
                summary.steps.push({ index: `E${j+1}`, expect: it.type, value: it.value, success: false, error: e.message });
              }
              // 断言后也抓一帧
              try {
                const fp = path.join(framesDir, `frame-${Date.now()}-E${j+1}.png`);
                await page.screenshot({ path: fp, fullPage: true });
                if (typeof onEvent === 'function') onEvent('frame', { url: this.#toAssetUrl(fp), ts: Date.now(), caseId: testCase.id, title: testCase.title });
              } catch {}
            }
          }

          const videoObj = page.video();
          await page.close().catch(() => {});
          await context.close().catch(() => {});
          if (videoObj) {
            try {
              const videoPath = await videoObj.path();
              summary.video = videoPath;
              if (typeof onEvent === 'function') onEvent('video', { url: this.#toAssetUrl(videoPath), caseId: testCase.id, title: testCase.title });
            } catch {}
          }
        } finally {
          // context/page 关闭在try内完成
        }

        summary.endedAt = nowIso();
        await writeFileSafe(path.join(caseDir, 'summary.json'), JSON.stringify(summary, null, 2));
        results.push(summary);
      }
    } finally {
      await launch.close().catch(() => {});
    }

    return { results };
  }

  #toAssetUrl(absPath) {
    // 将绝对路径映射为 /assets 下可访问的 URL
    const root = path.join(process.cwd());
    const rel = absPath.startsWith(root) ? absPath.slice(root.length).replace(/\\/g, '/').replace(/^\//, '') : absPath;
    return `/assets/${rel}`;
  }

  async #performAutoLogin(page, onEvent, testCase) {
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;
    if (!username || !password) {
      throw new Error('未配置 TEST_USERNAME/TEST_PASSWORD，无法自动登录');
    }

    if (typeof onEvent === 'function') onEvent('log', { level: 'info', text: `使用用户名 ${username} 自动登录`, ts: Date.now(), caseId: testCase?.id, title: testCase?.title });

    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // 寻找用户名输入框
    const userSelectors = [
      'input[name="username"]','input[name="user"]','input[name="account"]','input[type="text"]',
      'input[placeholder*="用户名"]','input[placeholder*="账号"]','input[placeholder*="手机号"]','input[placeholder*="邮箱"]'
    ];
    let userInput;
    for (const sel of userSelectors) {
      try {
        const loc = page.locator(sel).first();
        await loc.waitFor({ state: 'visible', timeout: 1500 });
        userInput = loc; break;
      } catch {}
    }
    if (!userInput) throw new Error('未找到用户名输入框');

    // 寻找密码输入框
    const pwdSelectors = ['input[name="password"]','input[type="password"]','input[placeholder*="密码"]'];
    let pwdInput;
    for (const sel of pwdSelectors) {
      try {
        const loc = page.locator(sel).first();
        await loc.waitFor({ state: 'visible', timeout: 1500 });
        pwdInput = loc; break;
      } catch {}
    }
    if (!pwdInput) throw new Error('未找到密码输入框');

    await userInput.fill('');
    await userInput.type(username, { delay: 20 });
    await pwdInput.fill('');
    await pwdInput.type(password, { delay: 20 });

    // 若存在验证码输入框，填写验证码（默认 1123，可用 TEST_CAPTCHA_CODE 覆盖）
    try {
      const captchaSelectors = [
        'input[name="captcha"]',
        'input[placeholder*="验证码"]',
        'input[id*="captcha"]',
        'input[type="text"]:below(:text("验证码"))'
      ];
      let captchaInput;
      for (const sel of captchaSelectors) {
        try {
          const loc = page.locator(sel).first();
          await loc.waitFor({ state: 'visible', timeout: 800 });
          captchaInput = loc; break;
        } catch {}
      }
      if (captchaInput) {
        const code = process.env.TEST_CAPTCHA_CODE || '1123';
        await captchaInput.fill('');
        await captchaInput.type(code, { delay: 10 });
      }
    } catch {}

    // 点击登录
    const loginSelectors = [
      'button[type="submit"]','input[type="submit"]','button:has-text("登录")','button:has-text("Login")','button:has-text("Sign In")','.login-btn','.btn-login','[class*="login"][class*="btn"]'
    ];
    let loginBtn;
    for (const sel of loginSelectors) {
      try {
        const loc = page.locator(sel).first();
        await loc.waitFor({ state: 'visible', timeout: 1500 });
        loginBtn = loc; break;
      } catch {}
    }
    if (loginBtn) await loginBtn.click(); else await pwdInput.press('Enter');

    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);
  }
}

module.exports = DirectExecutor;


