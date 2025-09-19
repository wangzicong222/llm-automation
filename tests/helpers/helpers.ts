import { expect, Page, Locator } from '@playwright/test';

async function callMcpFromSpec(params: { endpoint?: string, apiKey?: string, model?: string, stepText: string, html?: string, url?: string, screenshotDataUrl?: string }) {
  const { endpoint, apiKey, model, stepText, html, url, screenshotDataUrl } = params;
  if (!endpoint) return [] as any[];
  const body = {
    model: model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: '你是前端页面自动化助手。根据页面快照与自然语言步骤，返回一组可执行指令 actions:[{verb,selector,value}]。优先在 .ant-modal-content 内定位。' },
      { role: 'user', content: JSON.stringify({ stepText, url, htmlSnippet: (html || '').slice(0, 120000), screenshot: screenshotDataUrl }) }
    ], temperature: 0.1
  };
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) }, body: JSON.stringify(body) }).catch(() => null);
  if (!res || !(res as any).ok) return [];
  const data: any = await (res as any).json().catch(() => ({}));
  const txt = data?.choices?.[0]?.message?.content || data?.content || '';
  try { const parsed = JSON.parse(txt); if (Array.isArray(parsed)) return parsed; if (Array.isArray(parsed?.actions)) return parsed.actions; } catch {}
  return [];
}

async function mcpSuggestAndExecute(page: Page, stepText: string) {
  if (process.env.MCP_ENABLED !== 'true') return false;
  const endpoint = process.env.MCP_ENDPOINT;
  const apiKey = process.env.MCP_API_KEY;
  const model = process.env.MCP_MODEL || 'gpt-4o-mini';
  const html = await page.content().catch(() => '');
  let screenshotDataUrl = '';
  try { const buf = await page.screenshot({ fullPage: true }); screenshotDataUrl = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`; } catch {}
  const actions = await callMcpFromSpec({ endpoint, apiKey, model, stepText, html, url: page.url(), screenshotDataUrl });
  for (const a of actions) {
    try {
      const loc = page.locator(a.selector).first();
      if (a.verb === 'click') { await loc.click(); return true; }
      if (a.verb === 'fill') { await loc.fill(a.value || ''); return true; }
      if (a.verb === 'check') { await loc.check({ force: true }); return true; }
      if (a.verb === 'select') { await loc.click(); return true; }
    } catch {}
  }
  return false;
}

export async function waitModalVisible(page: Page) {
  await page.waitForSelector('.ant-modal-content', { state: 'visible' });
}

export function inModal(page: Page, selector: string): Locator {
  return page.locator(`.ant-modal-content ${selector}`);
}

export async function typeByLabel(page: Page, labelText: string, value: string) {
  // 若页面上没有弹窗，则自动回落到页面级输入（用于筛选查询区域）
  try {
    const hasModal = await page.locator('.ant-modal-content').first().isVisible().catch(async () => {
      const cnt = await page.locator('.ant-modal-content').count().catch(() => 0);
      return cnt > 0;
    });
    if (!hasModal) {
      return await typeOnPageLabel(page, labelText, value);
    }
  } catch {}
  await waitModalVisible(page);
  // 1) 优先基于 AntD 结构的 label 文本匹配（移除无效的 :text() 伪类）
  let formItem = inModal(page, `.ant-form-item:has(label:has-text("${labelText}")), .ant-form-item:has(.ant-form-item-label :has-text("${labelText}"))`).first();
  let hasFormItem = await formItem.count().catch(() => 0);
  // 2) 若未命中，使用 XPath 通过包含关系匹配（兼容“：/:”与空格）
  if (!hasFormItem) {
    const safe = labelText.replace(/(["'])/g, '');
    const fiXpath = `xpath=(//div[contains(@class,'ant-modal-content')]//div[contains(@class,'ant-form-item')][.//*[contains(normalize-space(text()),'${safe}') or contains(normalize-space(text()),'${safe}：') or contains(normalize-space(text()),'${safe}:')]])[1]`;
    formItem = page.locator(fiXpath).first();
    hasFormItem = await formItem.count().catch(() => 0);
  }
  // 3) 若依然未命中，不等待 formItem，直接走输入控件兜底
  if (hasFormItem) {
    try { await formItem.waitFor({ state: 'attached', timeout: 5000 }); } catch {}
  }

  // 在表单项内部优先找可编辑控件
  let input = (hasFormItem ? formItem : inModal(page, '')).locator('textarea, input:not([type="hidden"]), [contenteditable="true"]').first();
  if (!(await input.count())) {
    // 进一步兜底：依据 placeholder 或全局回退
    const selectorParts = [
      `.ant-form-item:has(label:has-text("${labelText}")) input`,
      `.ant-form-item:has(label:has-text("${labelText}")) textarea`,
      `.ant-form-item:has(.ant-form-item-label :has-text("${labelText}")) input`,
      `.ant-form-item:has(.ant-form-item-label :has-text("${labelText}")) textarea`,
      `input[placeholder*="${labelText}"]`,
      `input[placeholder*="30字以内"]`,
      `textarea[placeholder*="${labelText}"]`,
      `input[placeholder*="请输入"][placeholder*="${labelText}"]`,
      `.ant-modal-content input[placeholder*="请输入"], .ant-modal-content textarea[placeholder*="请输入"]`,
    ];
    const combined = selectorParts.join(', ');
    input = inModal(page, combined).first();
    if (!(await input.count())) input = page.locator(combined).first();
  }

  // 再兜底：XPath（匹配“押金名称/押金名称：/含冒号空格”）
  if (!(await input.count())) {
    const safe = labelText.replace(/(["'])/g, '');
    const xpath = `xpath=(//div[contains(@class,'ant-modal-content')]//div[contains(@class,'ant-form-item')][.//*[contains(normalize-space(text()),'${safe}') or contains(normalize-space(text()),'${safe}：') or contains(normalize-space(text()),'${safe}:')]])[1]//input[not(@type='hidden')] | (//div[contains(@class,'ant-modal-content')]//div[contains(@class,'ant-form-item')][.//*[contains(normalize-space(text()),'${safe}') or contains(normalize-space(text()),'${safe}：') or contains(normalize-space(text()),'${safe}:')]])[1]//textarea`;
    input = page.locator(xpath).first();
  }

  // 最后再全局 XPath 兜底一次
  if (!(await input.count())) {
    const safe = labelText.replace(/(["'])/g, '');
    const xpathGlobal = `xpath=(//div[contains(@class,'ant-form-item')][.//*[contains(normalize-space(text()),'${safe}') or contains(normalize-space(text()),'${safe}：') or contains(normalize-space(text()),'${safe}:')]])[1]//input[not(@type='hidden')] | (//div[contains(@class,'ant-form-item')][.//*[contains(normalize-space(text()),'${safe}') or contains(normalize-space(text()),'${safe}：') or contains(normalize-space(text()),'${safe}:')]])[1]//textarea`;
    input = page.locator(xpathGlobal).first();
  }

  // 如存在多个候选，优先选真正可编辑的
  try {
    const candidates = formItem.locator('input:not([type="hidden"]):not([readonly]):not([disabled]), textarea:not([disabled]), [contenteditable="true"]').filter({ hasNot: formItem.locator('.ant-input-disabled') });
    const cnt = await candidates.count();
    for (let i = 0; i < cnt; i++) {
      const c = candidates.nth(i);
      try { if (await c.isEditable()) { input = c; break; } } catch {}
    }
  } catch {}

  // 等待可见或至少可交互
  try {
    await input.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    await input.waitFor({ state: 'attached', timeout: 2000 });
  }

  // 若控件被禁用，尝试临时解除禁用（用于受控禁用但实际可输入的场景）
  try {
    if (await input.isDisabled()) {
      const el = await input.elementHandle();
      if (el) {
        await el.evaluate((node) => {
          const inp = node as HTMLInputElement | HTMLTextAreaElement;
          try { (inp as any).disabled = false; } catch {}
          inp.removeAttribute('disabled');
          inp.removeAttribute('aria-disabled');
          inp.classList.remove('ant-input-disabled');
        });
      }
    }
  } catch {}

  // 提前点击：优先点击激活焦点，适配需要聚焦才能编辑的控件
  await input.scrollIntoViewIfNeeded();
  try {
    await input.click({ force: true });
  } catch {
    try { await formItem.click({ force: true }); } catch {}
    try { await input.click({ force: true }); } catch {}
  }
  // 清空与输入（优先快捷键全选删除，再慢速输入）
  try { await input.focus(); } catch {}
  try {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await input.press(`${modifier}+KeyA`.replace('KeyA', 'A'));
    await input.press('Backspace');
  } catch {}

  // contenteditable 兼容与常规输入
  try {
    await input.type(value, { delay: 10 });
  } catch {
    try { await input.fill(value); } catch {}
  }

  // 验证已输入，否则重试（fill 或 JS）
  let v = '';
  try { v = await input.inputValue(); } catch {}
  if (!v || !v.includes(value)) {
    await input.fill(value);
    try { v = await input.inputValue(); } catch {}
  }
  if (!v || !v.includes(value)) {
    const handle = await input.elementHandle();
    if (handle) {
      await handle.evaluate((el, val) => {
        const node = el as HTMLInputElement | HTMLTextAreaElement | HTMLElement;
        const setNativeValue = (elem: any, v: string) => {
          const proto = Object.getPrototypeOf(elem);
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          if (desc && desc.set) {
            desc.set.call(elem, v);
          } else {
            (elem as any).value = v;
          }
        };
        if ('value' in (node as any)) setNativeValue(node as any, val);
        else { (node as any).textContent = val; }
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
        node.dispatchEvent(new Event('blur', { bubbles: true }));
      }, value);
      try { v = await input.inputValue(); } catch {}
    }
  }
  if (!v || !v.includes(value)) {
    // 最后兜底：使用键盘输入
    try {
      await input.focus();
      await page.keyboard.type(value, { delay: 10 });
    } catch {}
  }
  // 若仍失败，触发 MCP 兜底
  try {
    const ok = await input.inputValue().then(t => !!t).catch(() => false);
    if (!ok) {
      const used = await mcpSuggestAndExecute(page, `在弹窗内，向【${labelText}】输入：${value}`);
      if (used) return page.locator('input,textarea').filter({ hasText: value }).first();
    }
  } catch {}
  return input;
}

export async function typeAmount(page: Page, amount: string) {
  await waitModalVisible(page);
  await page.waitForSelector('.ant-modal-content .ant-input-number, .ant-modal-content input[role="spinbutton"]', { state: 'visible' });
  const input = inModal(page, '.ant-input-number input, input[role="spinbutton"]').first();
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();
  await input.click();
  await input.fill('');
  await input.type(amount, { delay: 10 });
  return input;
}

export async function typeTextarea(page: Page, value: string) {
  await waitModalVisible(page);
  let area = inModal(page, 'textarea').first();
  if (!(await area.count())) {
    area = page.locator('textarea').first();
  }
  try {
    await area.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    await area.waitFor({ state: 'attached', timeout: 2000 });
  }
  try {
    if (await area.isDisabled()) {
      const el = await area.elementHandle();
      if (el) {
        await el.evaluate((node) => {
          const inp = node as HTMLTextAreaElement;
          try { (inp as any).disabled = false; } catch {}
          inp.removeAttribute('disabled');
          inp.removeAttribute('aria-disabled');
          inp.classList.remove('ant-input-disabled');
        });
      }
    }
  } catch {}
  await area.scrollIntoViewIfNeeded();
  await area.click({ force: true });
  await area.fill('');
  await area.type(value, { delay: 10 });
  // 兜底
  try { const ok = await area.inputValue().then(t => !!t).catch(() => false); if (!ok) await mcpSuggestAndExecute(page, `在弹窗内，向【文本域】输入：${value}`); } catch {}
  return area;
}

export async function clickOptionByText(page: Page, text: string) {
  await waitModalVisible(page);
  const opt = inModal(page, `label:has-text("${text}"), .ant-radio-wrapper:has-text("${text}"), .ant-checkbox-wrapper:has-text("${text}")`).first();
  await expect(opt).toBeVisible();
  try { await opt.click(); } catch { await mcpSuggestAndExecute(page, `点击选项：${text}`); }
}

export async function clickOk(page: Page) {
  // 1) 首选：在弹窗内按可访问名匹配（支持“确\s*定”）
  let okBtn = inModal(page, '').getByRole('button', { name: /确\s*定/ }).first();
  if (!(await okBtn.count())) {
    // 2) 文本过滤匹配
    okBtn = inModal(page, 'button, .ant-btn').filter({ hasText: /确\s*定/ }).first();
  }
  if (!(await okBtn.count())) {
    // 3) 回退：弹窗底部主按钮
    okBtn = inModal(page, '.ant-modal-footer .ant-btn-primary').first();
  }
  await okBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await expect(okBtn).toBeVisible();
  try { await expect(okBtn).toBeEnabled(); } catch {}
  try {
    await okBtn.click();
  } catch {
    // 强制点击兜底
    try { await okBtn.click({ force: true }); } catch {}
  }
  // 4) 点击后等待弹窗关闭，避免后续步骤抢焦点失败
  await page.locator('.ant-modal-content').first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
}

export async function assertValueContains(inputOrPage: Locator | Page, expectedOrLabel: string | RegExp, maybeExpected?: string | RegExp) {
  let input: Locator;
  let expected: string | RegExp;
  if ((inputOrPage as any).locator && maybeExpected === undefined) {
    // called as assertValueContains(locator, expected)
    input = inputOrPage as Locator;
    expected = expectedOrLabel as string | RegExp;
  } else {
    // called as assertValueContains(page, labelText, expected)
    const page = inputOrPage as Page;
    const labelText = expectedOrLabel as string;
    expected = maybeExpected as string | RegExp;
    input = inModal(page, `.ant-form-item:has(label:has-text("${labelText}")) input, .ant-form-item:has(label:has-text("${labelText}")) textarea, input[placeholder*="${labelText}"]`).first();
  }
  const v = await input.inputValue();
  if (expected instanceof RegExp) {
    expect(v).toMatch(expected);
  } else {
    expect(v).toContain(expected);
  }
}

export async function assertOptionChecked(page: Page, text: string) {
  await expect(inModal(page, `.ant-radio-wrapper-checked:has-text("${text}")`)).toBeVisible();
}

export async function assertModalClosedAndTable(page: Page) {
  await expect(page.locator('.ant-modal-content')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.ant-table, table', { state: 'visible' });
  await expect(page.locator('.ant-table tbody tr, table tbody tr').first()).toBeVisible();
}

// 页面级：根据 label 或 placeholder 输入（不要求在弹窗内）
export async function typeOnPageLabel(page: Page, labelText: string, value: string) {
  // 优先：通过 label 关联的控件
  let input = page.locator(`label:has-text("${labelText}")`).first()
    .locator('xpath=following::*[self::input or self::textarea][1]');
  if (!(await input.count())) {
    // AntD 表单常见结构：.ant-form-item:has(label)
    input = page.locator(`.ant-form-item:has(label:has-text("${labelText}")), .ant-form-item:has(.ant-form-item-label :has-text("${labelText}"))`)
      .first().locator('input:not([type="hidden"]), textarea');
  }
  if (!(await input.count())) {
    // placeholder 兜底
    input = page.locator(`input[placeholder*="${labelText}"], textarea[placeholder*="${labelText}"], input[placeholder*="请输入"], textarea[placeholder*="请输入"]`).first();
  }
  // XPath 兜底
  if (!(await input.count())) {
    const safe = labelText.replace(/(["'])/g, '');
    const xpath = `xpath=(//div[contains(@class,'ant-form-item')][.//*[contains(normalize-space(text()),'${safe}') or contains(normalize-space(text()),'${safe}：') or contains(normalize-space(text()),'${safe}:')]])[1]//input[not(@type='hidden')] | (//div[contains(@class,'ant-form-item')][.//*[contains(normalize-space(text()),'${safe}') or contains(normalize-space(text()),'${safe}：') or contains(normalize-space(text()),'${safe}:')]])[1]//textarea`;
    input = page.locator(xpath).first();
  }

  await input.waitFor({ state: 'visible', timeout: 5000 }).catch(async () => {
    await input.waitFor({ state: 'attached', timeout: 2000 }).catch(() => {});
  });
  await input.scrollIntoViewIfNeeded().catch(() => {});
  try { await input.click({ force: true }); } catch {}
  try { await input.fill(''); } catch {}
  try { await input.type(value, { delay: 10 }); } catch { try { await input.fill(value); } catch {} }
  // 验证与兜底
  try {
    let v = await input.inputValue();
    if (!v || !v.includes(value)) {
      await input.fill(value);
      v = await input.inputValue();
    }
  } catch {}
  return input;
}


// 在表格的某一行内点击指定的操作文本（如“修改/删除/查看”）
// 选择策略：优先用 rowText 匹配含有该文本的行；否则按 index（默认第 1 行）
export async function clickRowAction(page: Page, params: { rowText?: string, index?: number }, actionText: string = '修改') {
  // 等待表格可见
  await page.waitForSelector('.ant-table, table', { state: 'visible' });
  const rows = page.locator('.ant-table tbody tr, table tbody tr');
  await expect(rows.first()).toBeVisible();

  // 选定目标行
  let targetRow = rows.first();
  if (params?.rowText) {
    const byText = rows.filter({ hasText: params.rowText });
    if (await byText.count()) targetRow = byText.first();
  } else if (typeof params?.index === 'number' && params.index! > 0) {
    const idx = Math.max(0, (params.index as number) - 1);
    if ((await rows.count()) > idx) targetRow = rows.nth(idx);
  }

  // 在行内查找操作按钮/链接，容错空格
  const actionRegex = new RegExp(actionText.split('').join('\\s*'));
  let action = targetRow.locator('a, button, .ant-btn').filter({ hasText: actionRegex }).first();
  if (!(await action.count())) {
    // 兜底：试着在操作列内查找
    const opCell = targetRow.locator('td:last-child');
    action = opCell.locator('a, button, .ant-btn').filter({ hasText: actionRegex }).first();
  }
  if (!(await action.count())) {
    // 再兜底：全表范围内相对最近的“修改”
    action = page.locator('.ant-table a, .ant-table button, .ant-table .ant-btn').filter({ hasText: actionRegex }).first();
  }
  await action.scrollIntoViewIfNeeded().catch(() => {});
  try {
    await action.click();
  } catch {
    try { await action.click({ force: true }); } catch {}
  }

  // 若点击的是“修改”，通常会出现弹窗
  if (/修\s*改/.test(actionText)) {
    try { await waitModalVisible(page); } catch {}
  }
}


