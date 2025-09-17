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

// 从中文句子通用地提取“目标短语”（未加引号也可）
function extractClickableText(text) {
  if (!text) return undefined;
  const t = text.replace(/\s+/g, '');
  // 形如：点击xxx(按钮/链接/选项...)
  const m1 = t.match(/(点击|单击)(.+?)(按钮|菜单|链接|选项|tab|页签)?/);
  if (m1 && m1[2]) {
    const val = m1[2]
      .replace(/页面|上|中|里|弹窗|对话框|中的|里的/g, '')
      .trim();
    if (val && val.length <= 8) return val; // 按钮文本通常不长
  }
  // 形如：点击“新建押金” / 单击【确定】
  const m2 = text.match(/[“【\[]([^”】\]]+)[”】\]]/);
  if (m2 && m2[1]) return m2[1].trim();
  return undefined;
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
  // 通用“名词+输入(框|栏|域)”
  const m3 = t.match(/([^，。；,.]+?)(输入框|文本域|输入栏|输入区)/);
  if (m3 && m3[1]) return m3[1];
  return undefined;
}

// 提取输入值：更鲁棒，适配多种中文标点和描述
function extractInputValue(text) {
  if (!text) return '';
  // 1) 优先取引号内
  const q = text.match(/(输入|填写)[^\n]*?[“"']([^”"']+)[”"']/);
  if (q && q[2]) return q[2].trim();
  // 2) 取“输入/填写”之后到句末（允许逗号、顿号等中文标点）
  const m = text.match(/(输入|填写)[:：\s]*([\s\S]+?)(?:到|至|$|。|；|;)/);
  if (m && m[2]) return m[2]
    .replace(/^[\s\u3000]+/, '')
    .replace(/^(到|至)/, '')
    .replace(/^(在|于)?(.*?)(中|里)?$/, (s) => s)
    .replace(/^(框中|文本框中|输入框中|到|至|:|：)+/g, '')
    .trim();
  return '';
}

// 通用地提取“选择/勾选”的目标文本（选项名）
function extractOptionText(text) {
  if (!text) return undefined;
  const m1 = text.match(/(选择|勾选|切换|点击).*?[“"']([^”"']+)[”"']/);
  if (m1 && m1[2]) return m1[2];
  const m2 = text.replace(/\s+/g, '').match(/(选择|勾选|切换)(.+?)(选项|按钮|单选|复选)?/);
  if (m2 && m2[2]) return m2[2];
  return undefined;
}

// 从某个定位点向近邻查找可编辑输入（排除 radio/checkbox/hidden）
async function nearestEditableInput(from) {
  const candidates = [
    from.locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea').first(),
    from.locator('..').locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea').first(),
    from.locator('..').locator('..').locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea').first(),
  ];
  for (const c of candidates) {
    try { await c.waitFor({ state: 'visible', timeout: 300 }); return c; } catch {}
  }
  return from; // 兜底返回原始节点（调用方需再作判断）
}

// 在弹窗内优先，通用选择“选项文本”。支持 radio/checkbox/select 下拉
async function chooseOptionByText(page, optionText) {
  if (!optionText) return false;
  // 1) radio/checkbox label
  const containers = [
    '.ant-modal-content .ant-radio-group',
    '.ant-modal-content .ant-checkbox-group',
    '.ant-radio-group',
    '.ant-checkbox-group'
  ];
  for (const sel of containers) {
    try {
      const c = page.locator(sel).first();
      if (await c.isVisible({ timeout: 200 }).catch(() => false)) {
        const target = c.getByText(optionText, { exact: false }).first();
        await target.click({ timeout: 500 });
        return true;
      }
    } catch {}
  }
  // 2) 尝试打开下拉并从面板选择
  try {
    // 先点击任何可作为选择触发的控件（在弹窗内优先）
    const trigger = page.locator('.ant-modal-content [role="combobox"], .ant-modal-content .ant-select-selector, [role="combobox"], .ant-select-selector').first();
    if (await trigger.isVisible({ timeout: 200 }).catch(() => false)) {
      await trigger.click();
    }
    const opt = page.locator('.ant-select-dropdown').getByText(optionText, { exact: false }).first();
    await opt.click({ timeout: 800 });
    return true;
  } catch {}
  // 3) 兜底：直接点击包含该文本的元素
  try {
    await page.getByText(optionText, { exact: false }).first().click({ timeout: 500 });
    return true;
  } catch {}
  return false;
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
      // 优先尝试 textarea（用于释义/备注类长文本）
      candidates.push(
        page
          .locator('.ant-modal-content .ant-form-item:has(label:has-text("' + label + '"))')
          .locator('textarea, input:not([type="hidden"])')
          .first()
      );
      candidates.push(
        page
          .locator('.ant-form-item:has(label:has-text("' + label + '"))')
          .locator('textarea, input:not([type="hidden"])')
          .first()
      );
      // 邻近文本 → 父级 → 可编辑输入
      candidates.push(
        page.getByText(label, { exact: false })
          .locator('..')
          .locator('input:not([type="hidden"]), textarea')
          .first()
      );
      // placeholder/aria-label 包含 label
      candidates.push(page.locator(`input[placeholder*="${label}"]`).first());
      candidates.push(page.locator(`[aria-label*="${label}"]`).first());
    }
    // 若句子包含“对应/相关/本项”，优先在已选中的单选/复选附近寻找输入框（通用“跟随上一步选择的项”）
    if (/对应|相关|本项/.test(action.raw)) {
      try {
        const checked = page.locator('.ant-modal-content .ant-radio-wrapper-checked, .ant-modal-content [aria-checked="true"], .ant-modal-content input[type="radio"]:checked, .ant-modal-content input[type="checkbox"]:checked').first();
        await checked.waitFor({ state: 'visible', timeout: 300 });
        const near = await nearestEditableInput(checked);
        candidates.push(near);
      } catch {}
    }
    // 若文本语义或长度像“释义/描述/备注/说明/多行”，优先选择 textarea
    const looksLikeTextarea = /(文本域|多行|释义|描述|备注|说明)/.test(action.raw);
    if (looksLikeTextarea) {
      candidates.push(page.locator('.ant-modal-content textarea').first());
    }
    // 弹窗内首个空白输入作为兜底
    candidates.push(page.locator('.ant-modal-content input:not([type="hidden"]):not([disabled])').first());
    candidates.push(page.locator('.ant-modal-content textarea').first());
  }
  if (action.verb === 'click') {
    const btnText = extractClickableText(action.raw);
    if (btnText) {
      // 优先在弹窗内找，再全局找
      const spacedInsensitive = new RegExp(btnText.split('').map(ch => /[\w\u4e00-\u9fa5]/.test(ch) ? `${ch}\\s*` : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(''));
      candidates.push(page.locator('.ant-modal-content').getByRole('button', { name: btnText }));
      candidates.push(page.getByRole('button', { name: btnText }));
      // 名称中可能包含空格（如“确 定”），用空格不敏感匹配
      candidates.push(page.locator('.ant-modal-content').getByRole('button', { name: spacedInsensitive }));
      candidates.push(page.getByRole('button', { name: spacedInsensitive }));
      candidates.push(page.getByText(btnText));
      candidates.push(page.getByText(spacedInsensitive));
      // 弹窗页脚主按钮兜底
      candidates.push(page.locator('.ant-modal-content .ant-modal-footer .ant-btn-primary').first());
    }
    // 通用选项文本（单选/多选/下拉）
    const optText = extractOptionText(action.raw) || btnText;
    if (optText) {
      candidates.push(page.locator('.ant-modal-content .ant-radio-group, .ant-modal-content .ant-checkbox-group').getByText(optText, { exact: false }));
      candidates.push(page.locator('.ant-radio-group, .ant-checkbox-group').getByText(optText, { exact: false }));
      candidates.push(page.locator('.ant-select-dropdown').getByText(optText, { exact: false }));
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
      await locator.first().click();
      return;
    case 'fill': {
      // 解析值（去除“框中”“：”等噪声）
      const value = extractInputValue(action.raw);
      const target = locator.first();
      // 数值型优先选择具备 number/decimal 能力的输入
      if (/^[-+]?\d+(\.\d+)?$/.test(value)) {
        // 先在被选中单选项附近找数字输入，再回退 target
        try {
          const checked = page.locator('.ant-modal-content .ant-radio-wrapper-checked, .ant-modal-content [aria-checked="true"], .ant-modal-content input[type="radio"]:checked').first();
          const near = await nearestEditableInput(checked);
          const numericNear = near.locator('input[type=number], input[inputmode=decimal], input[role=spinbutton]').first();
          await numericNear.waitFor({ state: 'visible', timeout: 300 });
          await numericNear.fill(value);
          return;
        } catch {}
        const numeric = target.locator('input[type=number], input[inputmode=decimal], input[role=spinbutton]').first();
        try { await numeric.waitFor({ state: 'visible', timeout: 300 }); await numeric.fill(value); return; } catch {}
      }
      // 若目标是只读的 span/input（某些 UI 采用只读外壳 + 内部真实 input），尝试向内层 input 回退
      // 若目标是 textarea 则直接填；若是 input 则直接填；否则回退到内部第一个 input/textarea
      try {
        const role = await target.evaluate(el => (el instanceof HTMLTextAreaElement) ? 'textarea' : (el instanceof HTMLInputElement ? 'input' : 'other')).catch(() => 'other');
        if (role === 'textarea' || role === 'input') {
          await target.fill(value);
        } else {
          const inner = target.locator('textarea, input').first();
          await inner.waitFor({ state: 'visible', timeout: 200 });
          await inner.fill(value);
        }
      } catch (e) { throw e; }
      return;
    }
    case 'select':
      // 通用：优先使用选项文本通道
      {
        const opt = extractOptionText(action.raw) || extractName(action.raw);
        const ok = await chooseOptionByText(page, opt);
        if (!ok && opt) {
          await page.getByText(opt).first().click();
        }
      }
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

async function runActionWithMcpFallback(page, action, opts = {}) {
  const { onEvent, metrics, execMode = (process.env.DIRECT_EXEC_MODE || 'rule-first'), mcpLimits = {} } = opts || {};
  const mcpEnabled = process.env.MCP_ENABLED === 'true';
  const maxCallsPerCase = Number(mcpLimits.maxCallsPerCase ?? (process.env.MCP_MAX_CALLS_PER_CASE || 5));
  try {
    if (execMode !== 'mcp-only') {
      await runAction(page, action);
      return true;
    }
  } catch (err) {
    if (!mcpEnabled && execMode !== 'mcp-only') throw err;
    if (metrics) {
      metrics.mcpTriggered = (metrics.mcpTriggered || 0) + 1;
      metrics.ruleFailures = (metrics.ruleFailures || 0) + 1;
    }
    if (typeof onEvent === 'function') onEvent('log', { level: 'warn', text: `规则执行失败或跳过规则，尝试MCP：${err?.message || ''}`, ts: Date.now() });
    // 采集上下文
    const html = await page.content().catch(() => '');
    let screenshotDataUrl = '';
    try {
      const buf = await page.screenshot({ fullPage: true });
      screenshotDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    } catch {}
    const { callMcpSuggest } = require('./mcp-client');
    const { actions } = await callMcpSuggest({
      endpoint: process.env.MCP_ENDPOINT,
      apiKey: process.env.MCP_API_KEY,
      model: process.env.MCP_MODEL,
      stepText: action.raw,
      html,
      url: page.url(),
      lastError: err?.message,
      screenshotDataUrl
    });
    // 安全白名单
    const allowedVerbs = new Set(['click', 'fill', 'select', 'check']);
    for (const a of actions || []) {
      try {
        if (!allowedVerbs.has(a.verb)) continue;
        if (a.verb === 'click') await page.locator(a.selector).first().click();
        else if (a.verb === 'fill') await page.locator(a.selector).first().fill(a.value || '');
        else if (a.verb === 'select') await page.locator(a.selector).first().click();
        else if (a.verb === 'check') await page.locator(a.selector).first().check({ force: true });
        if (metrics) metrics.mcpSuccess = (metrics.mcpSuccess || 0) + 1;
        if (typeof onEvent === 'function') onEvent('log', { level: 'info', text: 'MCP 兜底执行成功', ts: Date.now() });
        // 简易缓存（内存）：按 URL 路径 + 步骤文本
        try {
          const key = `${new URL(page.url()).pathname}|${(action.raw || '').trim()}`;
          const list = (global.__selectorCache = global.__selectorCache || new Map());
          const arr = list.get(key) || [];
          arr.unshift({ verb: a.verb, selector: a.selector, value: a.value });
          list.set(key, arr.slice(0, 3));
        } catch {}
        return true;
      } catch (e) {
        if (typeof onEvent === 'function') onEvent('log', { level: 'warn', text: `MCP 指令失败：${e.message}`, ts: Date.now() });
      }
    }
    throw err;
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

  async executeCases({ cases = [], pageUrl, browser = 'chromium', headless = true, timeout = 30000, retries = 0, storageState, onEvent, visualMode = false, debugMode = false, execMode = (process.env.DIRECT_EXEC_MODE || 'rule-first'), mcpLimits = {} }) {
    const browserType = pickBrowser(browser);
    
    // 可视化模式配置
    const launchOptions = { 
      headless: headless && !visualMode && !debugMode,
      slowMo: debugMode ? 1000 : 0, // 调试模式添加延迟
      devtools: debugMode // 调试模式打开开发者工具
    };
    
    const launch = await browserType.launch(launchOptions);
    const results = [];

    try {
      for (const testCase of cases) {
        const runId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const caseDir = path.join(this.baseOutputDir, String(testCase.id || testCase.title || runId));
        ensureDirSync(caseDir);
        const framesDir = path.join(caseDir, 'frames');
        ensureDirSync(framesDir);

        const summary = { id: testCase.id, title: testCase.title, success: true, steps: [], startedAt: nowIso(), screenshots: [], video: undefined, metrics: {} };

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
          // 1) 直接访问目标页面
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

            // 检测目标页面是否需要登录
            const needsLogin = await this.#looksLikeLoginPage(page);
            if (needsLogin) {
              try {
                if (typeof onEvent === 'function') onEvent('log', { level: 'info', text: '目标页面需要登录，尝试自动登录…', ts: Date.now(), caseId: testCase.id, title: testCase.title });
                await this.#performAutoLogin(page, onEvent, testCase);
                // 登录后重新访问目标页面
                await page.goto(pageUrl);
                await page.waitForLoadState('networkidle');
              } catch (e) {
                if (typeof onEvent === 'function') onEvent('log', { level: 'error', text: `自动登录失败：${e.message}`, ts: Date.now(), caseId: testCase.id, title: testCase.title });
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
            
            // 调试模式：发送步骤信息并等待用户确认
            if (debugMode && typeof onEvent === 'function') {
              onEvent('log', { 
                level: 'info', 
                text: `🔍 调试模式 - 步骤 ${i+1}/${lines.length}: ${raw}`, 
                ts: Date.now(), 
                caseId: testCase.id, 
                title: testCase.title 
              });
              onEvent('debug-step', { 
                stepIndex: i+1, 
                totalSteps: lines.length, 
                stepText: raw, 
                action: action.verb,
                ts: Date.now(),
                caseId: testCase.id,
                title: testCase.title
              });
              
              // 在调试模式下，等待用户确认继续
              await new Promise(resolve => setTimeout(resolve, 2000)); // 给用户2秒时间观察
            }
            
            let attempt = 0;
            let ok = false;
            while (attempt <= retries && !ok) {
              try {
                await runActionWithMcpFallback(page, action, { onEvent, metrics: summary.metrics, execMode, mcpLimits });
                ok = true;
                
                // 调试模式：执行成功后也发送确认
                if (debugMode && typeof onEvent === 'function') {
                  onEvent('log', { 
                    level: 'success', 
                    text: `✅ 步骤 ${i+1} 执行成功: ${raw}`, 
                    ts: Date.now(), 
                    caseId: testCase.id, 
                    title: testCase.title 
                  });
                }
              } catch (e) {
                attempt++;
                if (attempt > retries) {
                  summary.success = false;
                  const p = path.join(caseDir, `step-${i+1}-error.png`);
                  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
                  summary.screenshots.push(p);
                  summary.steps.push({ index: i+1, action: action.verb, raw, success: false, error: e.message });
                  
                  // 调试模式：失败时也发送详细信息
                  if (debugMode && typeof onEvent === 'function') {
                    onEvent('log', { 
                      level: 'error', 
                      text: `❌ 步骤 ${i+1} 执行失败: ${e.message}`, 
                      ts: Date.now(), 
                      caseId: testCase.id, 
                      title: testCase.title 
                    });
                  }
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


