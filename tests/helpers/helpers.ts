import { expect, Page, Locator } from '@playwright/test';

export async function waitModalVisible(page: Page) {
  await page.waitForSelector('.ant-modal-content', { state: 'visible' });
}

export function inModal(page: Page, selector: string): Locator {
  return page.locator(`.ant-modal-content ${selector}`);
}

export async function typeByLabel(page: Page, labelText: string, value: string) {
  await waitModalVisible(page);
  const formItem = inModal(page, `.ant-form-item:has(label:has-text("${labelText}")), .ant-form-item:has(.ant-form-item-label :has-text("${labelText}")), .ant-form-item:has(:text("${labelText}"))`).first();
  // 等待表单项出现（可见或至少挂载）
  try {
    await formItem.waitFor({ state: 'attached', timeout: 2000 });
  } catch {}

  // 在表单项内部优先找 textarea/input
  let input = formItem.locator('textarea, input:not([type="hidden"])').first();
  if (!(await input.count())) {
    // 进一步兜底：依据 placeholder 或全局回退
    const selectorParts = [
      `.ant-form-item:has(label:has-text("${labelText}")) input`,
      `.ant-form-item:has(label:has-text("${labelText}")) textarea`,
      `.ant-form-item:has(.ant-form-item-label :has-text("${labelText}")) input`,
      `.ant-form-item:has(.ant-form-item-label :has-text("${labelText}")) textarea`,
      `.ant-form-item:has(:text("${labelText}")) input`,
      `.ant-form-item:has(:text("${labelText}")) textarea`,
      `input[placeholder*="${labelText}"]`,
      `input[placeholder*="30字以内"]`,
      `textarea[placeholder*="${labelText}"]`,
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

  await input.scrollIntoViewIfNeeded();
  try {
    await input.fill('');
  } catch {
    await input.click({ force: true });
    await input.fill('');
  }
  await input.type(value, { delay: 10 });

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
        const inp = el as HTMLInputElement | HTMLTextAreaElement;
        inp.value = val;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        inp.dispatchEvent(new Event('blur', { bubbles: true }));
      }, value);
    }
  }
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
  return area;
}

export async function clickOptionByText(page: Page, text: string) {
  await waitModalVisible(page);
  const opt = inModal(page, `label:has-text("${text}"), .ant-radio-wrapper:has-text("${text}"), .ant-checkbox-wrapper:has-text("${text}")`).first();
  await expect(opt).toBeVisible();
  await opt.click();
}

export async function clickOk(page: Page) {
  const okBtn = inModal(page, '.ant-btn:has-text("确定"), button:has-text("确定"), .ant-modal-footer .ant-btn-primary').first();
  await expect(okBtn).toBeVisible();
  await expect(okBtn).toBeEnabled();
  await okBtn.click();
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


