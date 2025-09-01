const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const LLMTestExecutor = require('./llm-executor.js');

const app = express();
const { TapdProvider } = require('./bug-provider');

// 查找测试相关附件（截图、视频、trace等）
async function findTestAttachments(testName, reportId) {
  const attachments = [];
  const resultsDir = path.join(__dirname, '../test-results');
  
  try {
    // 查找可能的附件目录
    const dirs = await fs.readdir(resultsDir, { withFileTypes: true });
    
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      
      const dirPath = path.join(resultsDir, dir.name);
      
      // 检查目录名是否包含测试名称
      if (testName && dir.name.toLowerCase().includes(testName.toLowerCase().replace(/\s+/g, '-'))) {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile()) {
            const ext = path.extname(file).toLowerCase();
            let type = 'file';
            
            if (['.png', '.jpg', '.jpeg'].includes(ext)) {
              type = 'screenshot';
            } else if (['.webm', '.mp4'].includes(ext)) {
              type = 'video';
            } else if (ext === '.zip' || file.includes('trace')) {
              type = 'trace';
            } else if (ext === '.md') {
              type = 'report';
            }
            
            attachments.push({
              name: file,
              path: filePath,
              type: type,
              size: stat.size
            });
          }
        }
      }
    }
    
    // 限制附件数量和大小
    return attachments
      .filter(att => att.size < 10 * 1024 * 1024) // 小于10MB
      .slice(0, 5); // 最多5个附件
      
  } catch (e) {
    console.warn('查找测试附件失败:', e.message);
    return [];
  }
}
const PORT = 3002;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// 为了简单的SSE解析，关闭express默认缓存
app.set('x-powered-by', false);

// 测试执行器实例
const testExecutor = new LLMTestExecutor();

// 运行统计 - 持久化到文件
const RUN_COUNT_FILE = path.join(__dirname, '../test-results/run-counts.json');
let RUN_COUNTS = {};

async function loadRunCounts() {
  try {
    const data = await fs.readFile(RUN_COUNT_FILE, 'utf8');
    RUN_COUNTS = JSON.parse(data || '{}');
  } catch (e) {
    RUN_COUNTS = {};
  }
}

async function saveRunCounts() {
  try {
    const dir = path.dirname(RUN_COUNT_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(RUN_COUNT_FILE, JSON.stringify(RUN_COUNTS, null, 2));
  } catch (e) {
    console.warn('保存运行统计失败:', e.message);
  }
}

// 初始化加载统计
loadRunCounts();

// 解析 Playwright JSON 报告（容错）
async function parsePlaywrightJsonReport(jsonPath) {
  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    const data = JSON.parse(raw || '{}');
    const tests = [];
    function collect(node) {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(collect); return; }
      if (typeof node !== 'object') return;

      const title = node.titlePath ? node.titlePath.join(' > ') : node.title;
      const outcome = node.outcome || node.status;
      const ok = typeof node.ok === 'boolean' ? node.ok : undefined;
      if (title && (outcome !== undefined || ok !== undefined)) {
        let isSuccess;
        if (ok !== undefined) {
          isSuccess = !!ok;
        } else {
          const o = String(outcome).toLowerCase();
          isSuccess = ['passed', 'expected', 'ok', 'success'].includes(o);
        }
        const isFailure = !isSuccess;
        tests.push({
          id: String(tests.length + 1),
          name: title,
          status: isFailure ? 'failure' : 'success',
          duration: node.duration || 0,
          error: node.error ? (node.error.message || String(node.error)) : undefined,
        });
      }
      for (const v of Object.values(node)) collect(v);
    }
    collect(data);
    const total = tests.length;
    const passed = tests.filter(x => x.status === 'success').length;
    const failed = total - passed;
    return {
      id: `pw-${Date.now()}`,
      name: 'Playwright JSON 报告',
      testSuite: '转换自 results.json',
      executionTime: new Date().toISOString(),
      status: failed === 0 ? 'success' : 'failure',
      totalTests: total,
      passedTests: passed,
      failedTests: failed,
      successRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      tests,
    };
  } catch (e) {
    return null;
  }
}

// 解析 Markdown 用例为结构化对象
function parseMarkdownTestCases(markdown) {
  if (!markdown || typeof markdown !== 'string') return [];
  console.log('🔍 开始解析Markdown，长度:', markdown.length);
  const lines = markdown.split(/\r?\n/);
  console.log('🔍 分割后的行数:', lines.length);
  const cases = [];
  let current = null;
  let mode = null; // 'steps' | 'expects' | null

  const pushCurrent = () => {
    if (current) {
      cases.push(current);
      current = null;
      mode = null;
    }
  };

  for (const raw of lines) {
    // 预清洗：去掉 Markdown 粗体/行内代码等轻量标记，统一全角冒号
    let line = raw.trim();
    line = line.replace(/\*\*(.*?)\*\*/g, '$1'); // **粗体** → 文本
    line = line.replace(/\`([^`]*)\`/g, '$1');     // `行内代码` → 文本
    line = line.replace(/[：:]\s*$/g, '：');        // 结尾统一成全角冒号
    line = line.replace(/^\s*[•·]\s*/g, '- ');      // • / · 前缀 → -
    if (!line) { mode = null; continue; }
    
    console.log('🔍 处理行:', line, '当前模式:', mode);

    // 分段标题（多模式）
    const titleMatchers = [
      /^##\s*测试用例\s*\d+[:：]\s*(.*)$/,
      /^###?\s*(用例|案例|Case|Test)[:：]\s*(.*)$/i,
      /^(用例|案例|Case|Test)[:：]\s*(.*)$/i,
    ];
    let titleMatched = null;
    for (const re of titleMatchers) {
      const m = line.match(re);
      if (m) { titleMatched = m[m.length - 1]; break; }
    }
    if (titleMatched !== null) {
      pushCurrent();
      current = { title: titleMatched || '未命名用例', steps: [], expects: [] };
      continue;
    }

    // 分隔线作为新用例分段（--- 或 ===）
    if (/^[-=_]{3,}$/.test(line)) { pushCurrent(); continue; }

      // 区块标识
  if (/^步(骤|驟)[:：]$/i.test(line)) { mode = 'steps'; continue; }
  if (/^(预期|期望|Expected)[:：]?$/i.test(line)) { mode = 'expects'; continue; }
  
  // 新增：识别"预期结果:"格式
  if (/^预期结果[:：]?$/i.test(line)) { mode = 'expects'; continue; }

    // 可选标题行：标题：xxx
    const mTitle = line.match(/^(标题|Title)[:：]\s*(.*)$/i);
    if (mTitle) {
      if (!current) current = { title: '', steps: [], expects: [] };
      current.title = mTitle[2] || current.title || '未命名用例';
      continue;
    }

    if (!current) { current = { title: '未命名用例', steps: [], expects: [] }; }

    // 步骤：有数字或短横线或处于 steps 模式
    const stepByNumber = line.match(/^\d+[\.)]\s*(.*)$/);
    const stepByDash = line.match(/^[-•]\s*(.*)$/);
    if (mode === 'steps' && (stepByNumber || stepByDash)) {
      current.steps.push((stepByNumber ? stepByNumber[1] : stepByDash[1]).trim());
      continue;
    }
    if (stepByNumber) { current.steps.push(stepByNumber[1].trim()); continue; }
    
    // 新增：处理没有空格的数字步骤格式（如"1.进入页面"）
    const stepByNumberNoSpace = line.match(/^(\d+[\.)])(.+)$/);
    if (stepByNumberNoSpace) {
      current.steps.push(stepByNumberNoSpace[2].trim());
      continue;
    }
    
    // 新增：处理"1. 步骤"格式（数字+点+空格+步骤）
    const stepByNumberWithSpace = line.match(/^\d+[\.)]\s+(.+)$/);
    if (stepByNumberWithSpace) {
      current.steps.push(stepByNumberWithSpace[1].trim());
      continue;
    }

    // 预期：短横线/圆点或处于 expects 模式
    const expectByDash = line.match(/^[-•]\s*(.*)$/);
    if (mode === 'expects' && expectByDash) { current.expects.push(expectByDash[1].trim()); continue; }
    if (!mode && expectByDash && /应|显示|选中|成功|失败|提示|可见|包含|等于|相等/.test(expectByDash[1])) {
      // 未显式进入 expects，但看起来像预期
      current.expects.push(expectByDash[1].trim());
      continue;
    }

    // 回退：无模式时按步骤处理
    if (!mode && stepByDash) { current.steps.push(stepByDash[1].trim()); continue; }
  }
  pushCurrent();
  return cases.filter(c => (c.title && c.title.trim()) || c.steps.length > 0 || c.expects.length > 0);
}

// 将中文步骤映射为可执行代码（启发式）
function mapStepToCode(step, ruleSummary) {
  if (!step) return null;
  const s = step.trim();
  // 以“验证/校验”开头的步骤，转由预期规则处理
  if (/^(验证|校验)/.test(s)) {
    const mapped = mapExpectToCode(s.replace(/^(验证|校验)/, ''), ruleSummary);
    if (mapped) {
      ruleSummary.steps.push({ text: s, rule: 'mapped-to-expect', hit: true });
      // 直接返回断言代码，而不是让上层回退生成注释
      return mapped;
    }
  }
  // 导航类
  if (/进入|打开/.test(s) && /页面/.test(s)) {
    ruleSummary.steps.push({ text: s, rule: 'navigate-page', hit: true });
    return `// 已在测试内置跳转至页面`;
  }
  
  // 新增：处理"进入押金管理页面"这种格式
  if (/进入.*管理页面/.test(s)) {
    ruleSummary.steps.push({ text: s, rule: 'navigate-management-page', hit: true });
    return `// 已在测试内置跳转至页面`;
  }
  // 点击按钮
  const clickBtn = s.match(/点击[“"']?(.+?)[”"']?按钮/);
  if (clickBtn) {
    const name = clickBtn[1];
    ruleSummary.steps.push({ text: s, rule: 'click-button-by-name', hit: true });
    return `await page.getByRole('button', { name: '${name}' }).click();`;
  }
  // 点击"确定/取消/X"
  if (/点击["']?确定["']?/.test(s)) { ruleSummary.steps.push({ text: s, rule: 'click-confirm', hit: true }); return `await page.getByRole('button', { name: /^(确定|确认|保 存|保存)$/ }).click();`; }
  if (/点击[""']?取消[""']?/.test(s)) { ruleSummary.steps.push({ text: s, rule: 'click-cancel', hit: true }); return `await page.getByRole('button', { name: '取消' }).click();`; }
  if (/右上角.*["']?X[""']?/.test(s)) return `await page.locator('.ant-modal-close').click();`;
  // 勾选/选择某个选项（通用，适配 radio/checkbox/label）
  const chooseOpt = s.match(/(勾选|选择|点击)["'](.+?)["']/);
  if (chooseOpt) {
    const label = chooseOpt[2];
    ruleSummary.steps.push({ text: s, rule: 'choose-option-by-label', hit: true });
    return `await page.locator('.ant-modal-content').locator('label:has-text("${label}"), .ant-radio-wrapper:has-text("${label}"), .ant-checkbox-wrapper:has-text("${label}")').first().click();`;
  }
  // 文本输入：如 "在XXX中输入'YYY'" 或 "输入'YYY'到XXX"
  const inputToField = s.match(/(在|向)?([\u4e00-\u9fa5A-Za-z0-9_\s"'']+?)(输入框|文本框|输入栏|字段|中|里)?(输入|填写)["'](.+?)["']/);
  const fillValueFirst = s.match(/(输入|填写)["'](.+?)[""'].*(到|至|到达|在)(.+?)(中|里)?$/);
  if (inputToField || fillValueFirst) {
    const labelText = (inputToField ? inputToField[2] : (fillValueFirst ? fillValueFirst[4] : '')).replace(/["']/g, '').trim();
    const value = (inputToField ? inputToField[5] : (fillValueFirst ? fillValueFirst[2] : '')) || '';
    const v = value || '示例文本';
    ruleSummary.steps.push({ text: s, rule: 'fill-input-by-label', hit: true });
    return (
      `{\n` +
      `  const targetInput = page.locator('.ant-modal-content .ant-form-item:has(label:has-text("${labelText}"))').locator('input:not([type="hidden"]), textarea').first();\n` +
      `  await targetInput.scrollIntoViewIfNeeded();\n` +
      `  await targetInput.click();\n` +
      `  await targetInput.fill('');\n` +
      `  await targetInput.type(${JSON.stringify(value || '示例文本')}, { delay: 10 });\n` +
      `}`
    );
  }
  // 打开/展开"新增/新建/创建"之类的弹窗/面板（通用）
  if (/(打开|展开|新建|新增|创建).*["'](.+?)["']?/.test(s)) {
    const m = s.match(/["'](.+?)["']/)
    const btn = m ? m[1] : null
    if (btn) { ruleSummary.steps.push({ text: s, rule: 'open-by-button', hit: true }); return `await page.getByRole('button', { name: '${btn}' }).first().click();` }
  }

  // 下拉选择：在XXX下拉中选择"YYY"/选择下拉"YYY"/选择"YYY"选项
  if (/下拉/.test(s) && /选(择|中)/.test(s) && /["'](.+?)["']/.test(s)) {
    const field = (s.match(/在(.+?)下拉/) || [])[1] || ''
    const value = (s.match(/["'](.+?)["']/) || [])[1]
    ruleSummary.steps.push({ text: s, rule: 'select-dropdown', hit: true })
    return (
      `{\n` +
      `  ${field ? `const selectField = page.locator('.ant-form-item:has(label:has-text("${field}")) .ant-select');` : `const selectField = page.locator('.ant-select').first();`}\n` +
      `  await selectField.click();\n` +
      `  await page.locator('.ant-select-dropdown .ant-select-item-option[title="${value}"], .ant-select-dropdown .ant-select-item:has-text("${value}")').first().click();\n` +
      `}`
    )
  }

  // 表格勾选：在表格中勾选"YYY"/勾选"YYY"行
  if (/(表格|列表).*(勾选|选中)|勾选.*行/.test(s) && /["'](.+?)["']/.test(s)) {
    const rowKey = (s.match(/["'](.+?)["']/) || [])[1]
    ruleSummary.steps.push({ text: s, rule: 'table-row-check', hit: true })
    return (
      `{\n` +
      `  const row = page.locator('tr:has(:text("${rowKey}"))');\n` +
      `  await row.locator('input[type="checkbox"]').first().check({ force: true });\n` +
      `}`
    )
  }

  // 标签切换：切换到"XXX"标签/Tab
  if (/(切换|进入).*(标签|Tab)/.test(s) && /["'](.+?)["']/.test(s)) {
    const tab = (s.match(/["'](.+?)["']/) || [])[1]
    ruleSummary.steps.push({ text: s, rule: 'switch-tab', hit: true })
    return `await page.getByRole('tab', { name: '${tab}' }).click();`
  }

  // 日期选择：在XXX日期选择器中选择"YYYY-MM-DD"/选择日期"YYYY-MM-DD"
  if ((/日期|date/.test(s)) && /[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(s)) {
    const field = (s.match(/在(.+?)(日期|date)/) || [])[1] || ''
    const dateVal = (s.match(/([0-9]{4}-[0-9]{2}-[0-9]{2})/) || [])[1]
    ruleSummary.steps.push({ text: s, rule: 'pick-date', hit: true })
    return (
      `{\n` +
      `  ${field ? `const dateInput = page.locator('.ant-form-item:has(label:has-text("${field}")) input').first();` : `const dateInput = page.locator('.ant-picker input').first();`}\n` +
      `  await dateInput.click();\n` +
      `  await dateInput.fill('${dateVal}');\n` +
      `  await dateInput.press('Enter');\n` +
      `}`
    )
  }
  // 通用：在文本域中输入长文本
  if (/(文本域|多行|textarea).*(输入|填写)/.test(s)) {
    const value = (s.match(/输入["'](.+?)["']/) || [])[1] || '示例多行文本';
    ruleSummary.steps.push({ text: s, rule: 'fill-textarea', hit: true });
    return (
      `{\n` +
      `  const area = page.locator('.ant-modal-content textarea').first();\n` +
      `  await area.fill('');\n` +
      `  await area.type('${value}', { delay: 10 });\n` +
      `}`
    );
  }
  // 超长输入（1001个字符）
  if (/1001个字符|1000个字符以上/.test(s)) {
    ruleSummary.steps.push({ text: s, rule: 'fill-1001-chars', hit: true });
    return (
      `{\n` +
      `  const longText = 'A'.repeat(1001);\n` +
      `  const descArea = page.locator('.ant-modal-content textarea').first();\n` +
      `  await descArea.fill(longText);\n` +
      `}`
    );
  }

  // 指定长度/字符集输入：在XXX中输入31个字符/特殊字符/中英文
  if (/在.+?(中|里).*(输入|填写).*(\d+个字符|特殊字符|中英文)/.test(s)) {
    const labelText = (s.match(/在(.+?)(输入|填写)/) || [])[1]?.replace(/(中|里)$/,'').trim() || '';
    let value = 'A'.repeat(31);
    if (/\d+个字符/.test(s)) {
      const n = parseInt((s.match(/(\d+)个字符/) || [])[1] || '31', 10);
      if (Number.isFinite(n) && n > 0) value = 'A'.repeat(n);
    } else if (/特殊字符/.test(s)) {
      value = '!@#$%^&*()_+-={}[]:;"\',.<>/?~';
    } else if (/中英文/.test(s)) {
      value = '中文ABCabc123';
    }
    ruleSummary.steps.push({ text: s, rule: 'fill-by-pattern', hit: true });
    return (
      `{\n` +
      `  const targetInput = page.locator('.ant-modal-content .ant-form-item:has(label:has-text("${labelText}"))').locator('input:not([type="hidden"]), textarea').first();\n` +
      `  await targetInput.fill('');\n` +
      `  await targetInput.type(${JSON.stringify(value)}, { delay: 10 });\n` +
      `}`
    );
  }

  // 清空指定字段
  if (/清空.+?(字段|输入框)/.test(s)) {
    const labelText = (s.match(/清空(.+?)(字段|输入框)/) || [])[1] || '';
    ruleSummary.steps.push({ text: s, rule: 'clear-field', hit: true });
    return (
      `{\n` +
      `  const targetInput = page.locator('.ant-modal-content .ant-form-item:has(label:has-text("${labelText}"))').locator('input:not([type="hidden"]), textarea').first();\n` +
      `  await targetInput.fill('');\n` +
      `}`
    );
  }

  ruleSummary.steps.push({ text: s, rule: 'unmatched', hit: false });
  return null;
}

// 将中文预期映射为断言（启发式）
function mapExpectToCode(exp, ruleSummary) {
  if (!exp) return null;
  const e = exp.trim();
  if (/弹窗.*弹出|正常弹出/.test(e)) {
    ruleSummary.expects.push({ text: e, rule: 'modal-visible', hit: true });
    return (`await expect(page.locator('.ant-modal-content')).toBeVisible();`);
  }
  // “弹窗标题正确显示/为xxx”
  if (/弹窗标题(正确)?显示/.test(e) && !(/["“”]/.test(e))) {
    ruleSummary.expects.push({ text: e, rule: 'modal-title-visible', hit: true });
    return (`await expect(page.locator('.ant-modal-title')).toBeVisible();`);
  }
  // 预期：弹窗标题包含"xxx"
  const title2 = e.match(/(弹窗|对话框|Modal).*(标题|title).*?["'](.+?)["']/);
  if (title2) {
    ruleSummary.expects.push({ text: e, rule: 'modal-title-contains', hit: true });
    return (`await expect(page.locator('.ant-modal-title')).toContainText('${title2[3]}');`);
  }
  const title = e.match(/弹窗标题.*["'](.+?)["']/);
  if (title) {
    ruleSummary.expects.push({ text: e, rule: 'modal-title-regexp', hit: true });
    return (`await expect(page.locator('.ant-modal-title')).toHaveText(/${title[1]}/);`);
  }
  // 弹窗包含若干输入字段：以中文顿号、逗号分隔
  const hasFields = e.match(/(包含|应有|应包含).*?(输入|字段|表单).*?[:：](.+)$/)
  if (hasFields) {
    const list = hasFields[3].split(/[、，,]/).map(x => x.trim()).filter(Boolean)
    ruleSummary.expects.push({ text: e, rule: 'modal-has-fields', hit: true })
    return list.map(lbl => `await expect(page.locator('.ant-modal-content .ant-form-item:has(label:has-text("${lbl}"))')).toBeVisible();`).join('\n');
  }
  // 所有输入都有占位/标识
  if (/所有.*输入.*(占位|placeholder|标识)/.test(e)) {
    ruleSummary.expects.push({ text: e, rule: 'all-input-has-placeholder', hit: true })
    return (
      `const items = page.locator('.ant-modal-content .ant-form-item');\n` +
      `const count = await items.count();\n` +
      `for (let i=0;i<count;i++){\n` +
      `  const it = items.nth(i);\n` +
      `  const input = it.locator('input:not([type="hidden"]), textarea').first();\n` +
      `  if (await input.count()){\n` +
      `    const ph = await input.getAttribute('placeholder');\n` +
      `    expect(ph ?? '').not.toEqual('');\n` +
      `  }\n` +
      `}`
    );
  }
  if (/必填字段/.test(e)) {
    ruleSummary.expects.push({ text: e, rule: 'required-fields-visible', hit: true });
    return (
      `const inputs = page.locator('.ant-modal-content input:not([type="hidden"])');\n` +
      `await expect(inputs.first()).toBeVisible();\n` +
      `await expect(page.locator('.ant-modal-content textarea')).toBeVisible();\n` +
      `await expect(page.locator('.ant-modal-content .ant-radio-group')).toBeVisible();`
    );
  }
  if (/两个操作按钮.*(取消|确定)/.test(e)) {
    ruleSummary.expects.push({ text: e, rule: 'two-actions-visible', hit: true });
    return (
      `await expect(page.getByRole('button', { name: '取消' })).toBeVisible();\n` +
      `await expect(page.getByRole('button', { name: /^(确定|确认|保 存|保存)$/ })).toBeVisible();`
    );
  }
  // 通用：验证"XXX"被选中
  const checked = e.match(/(选中|被选中).*?["'](.+?)["']/);
  if (checked) {
    const label = checked[2];
    ruleSummary.expects.push({ text: e, rule: 'option-checked', hit: true });
    return (`await expect(page.locator('.ant-modal-content label:has-text("${label}") input[type="radio"], .ant-modal-content label:has-text("${label}") input[type="checkbox"]').first()).toBeChecked();`);
  }
  if (/选中.*明显.*反馈/.test(e)) {
    ruleSummary.expects.push({ text: e, rule: 'selected-feedback-visible', hit: true });
    return (`await expect(page.locator('.ant-modal-content .ant-radio-wrapper-checked')).toBeVisible();`);
  }
  if (/应提示.*超出.*长度|字数限制/.test(e)) {
    ruleSummary.expects.push({ text: e, rule: 'length-exceeded-error', hit: true })
    return (`await expect(page.locator('.ant-form-item-explain-error')).toContainText(/超出|长度|字数/);`);
  }
  if (/显示当前输入的字数/.test(e)) {
    return `// TODO: 如果有字数统计元素，请在此添加选择器断言`;
  }
  if (/未填写.*点击.*确定.*提示/.test(e)) {
    return `// TODO: 根据校验提示元素断言为空提示，例如 .ant-form-item-explain-error`;
  }
  if (/填写完整.*点击.*确定.*保存成功|关闭弹窗/.test(e)) {
    return `// TODO: 依据系统的成功提示断言，例如 .ant-message-success 或弹窗关闭`;
  }
  if (/输入合法字符.*(正常|成功).*显示/.test(e)) {
    ruleSummary.expects.push({ text: e, rule: 'valid-input-no-error', hit: true })
    return (`await expect(page.locator('.ant-form-item-explain-error')).toHaveCount(0);`);
  }
  ruleSummary.expects.push({ text: e, rule: 'unmatched', hit: false });
  return null;
}

// 安全解析测试文件路径，限制在 tests/generated 目录
function resolveTestFilePath(relativeFile) {
  const testsDir = path.join(__dirname, '../tests/generated');
  const normalized = path.normalize(relativeFile || '');
  const fullPath = path.join(__dirname, '..', normalized.startsWith('tests/') ? normalized : path.join('tests/generated', normalized));
  if (!fullPath.startsWith(path.join(__dirname, '..'))) {
    throw new Error('非法路径');
  }
  if (!fullPath.startsWith(testsDir)) {
    throw new Error('仅允许访问 tests/generated 目录下的文件');
  }
  return { fullPath, testsDir };
}

// 获取可用的测试文件
app.get('/api/available-tests', async (req, res) => {
  try {
    const testsDir = path.join(__dirname, '../tests/generated');
    const files = await fs.readdir(testsDir);
    const testFiles = files.filter(file => file.endsWith('.spec.ts'));

    const items = await Promise.all(
      testFiles.map(async (file) => {
        const fullPath = path.join(testsDir, file);
        let stats;
        try {
          stats = await fs.stat(fullPath);
        } catch {
          stats = { mtimeMs: Date.now() };
        }
        const p = `tests/generated/${file}`;
        return { path: p, updatedAt: stats.mtimeMs, runs: RUN_COUNTS[p] || 0 };
      })
    );

    res.json({
      success: true,
      files: items
    });
  } catch (error) {
    console.error('获取测试文件失败:', error);
    res.status(500).json({
      success: false,
      message: '获取测试文件失败',
      error: error.message
    });
  }
});

// 获取运行统计
app.get('/api/run-counts', async (req, res) => {
  try {
    await loadRunCounts();
    res.json({ success: true, counts: RUN_COUNTS });
  } catch (e) {
    res.status(500).json({ success: false, message: '获取运行统计失败' });
  }
});

// 读取脚本内容
app.get('/api/script', async (req, res) => {
  try {
    const { file } = req.query;
    if (!file) {
      return res.status(400).json({ success: false, message: '缺少参数 file' });
    }
    const { fullPath, testsDir } = resolveTestFilePath(file);
    let content;
    try {
      content = await fs.readFile(fullPath, 'utf8');
    } catch (err) {
      // 兜底：仅用文件名在 tests/generated 下再尝试一次（防止路径前缀不一致）
      try {
        const alt = path.join(testsDir, path.basename(file));
        content = await fs.readFile(alt, 'utf8');
      } catch (err2) {
        console.error('读取脚本失败: ', fullPath, err2.message);
        return res.status(404).json({ success: false, message: '读取脚本失败', error: err2.message, file });
      }
    }
    let meta = {};
    try {
      const metaPath = `${fullPath}.meta.json`;
      const metaRaw = await fs.readFile(metaPath, 'utf8');
      meta = JSON.parse(metaRaw || '{}');
    } catch (_) {}
    res.json({ success: true, file, content, meta });
  } catch (error) {
    console.error('读取脚本失败:', error);
    res.status(500).json({ success: false, message: '读取脚本失败', error: error.message });
  }
});

// 保存脚本内容
app.post('/api/script', async (req, res) => {
  try {
    const { file, content, meta } = req.body || {};
    if (!file || typeof content !== 'string') {
      return res.status(400).json({ success: false, message: '参数错误：需要 file 与 content' });
    }
    const { fullPath, testsDir } = resolveTestFilePath(file);
    await fs.mkdir(testsDir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    if (meta && typeof meta === 'object') {
      try {
        const metaPath = `${fullPath}.meta.json`;
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      } catch (e) {
        console.warn('写入脚本元数据失败:', e.message);
      }
    }
    res.json({ success: true, file });
  } catch (error) {
    console.error('保存脚本失败:', error);
    res.status(500).json({ success: false, message: '保存脚本失败', error: error.message });
  }
});

// 删除脚本
app.delete('/api/script', async (req, res) => {
  try {
    const { file } = req.query;
    if (!file) {
      return res.status(400).json({ success: false, message: '缺少参数 file' });
    }
    const { fullPath } = resolveTestFilePath(file);
    await fs.unlink(fullPath);
    res.json({ success: true, file });
  } catch (error) {
    console.error('删除脚本失败:', error);
    res.status(500).json({ success: false, message: '删除脚本失败', error: error.message });
  }
});

// 执行单个测试
app.post('/api/execute-test', async (req, res) => {
  try {
    const { testFile, options } = req.body;
    
    if (!testFile) {
      return res.status(400).json({
        success: false,
        message: '请提供测试文件路径'
      });
    }
    
    console.log(`开始执行测试: ${testFile}`);
    
    const startTime = Date.now();
    // 允许前端开启 headed 模式
    if (options && options.headed) {
      process.env.PW_HEADED = 'true';
    } else {
      delete process.env.PW_HEADED;
    }
    const result = await testExecutor.executeTest(testFile);
    // 统计 +1 并保存
    RUN_COUNTS[testFile] = (RUN_COUNTS[testFile] || 0) + 1;
    await saveRunCounts();
    const duration = Date.now() - startTime;
    
    // 新增：执行测试后，重新生成HTML报告
    console.log('🔄 重新生成HTML报告...');
    try {
      // 使用Playwright命令重新生成HTML报告
      const { exec } = require('child_process');
      const generateHtmlReport = () => {
        return new Promise((resolve, reject) => {
          exec('npx playwright show-report --host=0.0.0.0 --port=9323', {
            cwd: process.cwd(),
            timeout: 10000
          }, (error, stdout, stderr) => {
            if (error) {
              console.log('⚠️ HTML报告生成警告:', error.message);
              resolve(); // 不阻塞主流程
            } else {
              console.log('✅ HTML报告重新生成完成');
              resolve();
            }
          });
        });
      };
      
      await generateHtmlReport();
    } catch (reportError) {
      console.log('⚠️ HTML报告重新生成失败:', reportError.message);
    }
    
    // 新增：生成 Playwright HTML 报告
    const reportId = `report-${Date.now()}`;
    try {
      await generatePlaywrightReport(reportId);
      console.log('✅ Playwright 报告生成成功');
    } catch (reportError) {
      console.error('❌ 生成 Playwright 报告失败:', reportError);
    }
    
    // 保存简要报告到文件
    try {
      const reportsDir = path.join(__dirname, '../test-results/reports');
      await fs.mkdir(reportsDir, { recursive: true });
      const report = {
        id: `single-${Date.now()}`,
        name: (testFile || '').split('/').pop(),
        testSuite: '单用例',
        executionTime: new Date().toISOString(),
        status: result.success ? 'success' : 'failure',
        totalTests: 1,
        passedTests: result.success ? 1 : 0,
        failedTests: result.success ? 0 : 1,
        successRate: result.success ? 100 : 0,
        tests: [
          {
            id: '1',
            name: (testFile || '').split('/').pop(),
            status: result.success ? 'success' : 'failure',
            duration,
            error: result.error || undefined
          }
        ],
        reportId
      };
      await fs.writeFile(path.join(reportsDir, `${report.id}.json`), JSON.stringify(report, null, 2));
    } catch (e) {
      console.warn('写入单用例报告失败:', e.message);
    }

    res.json({
      success: true,
      testFile,
      success: result.success,
      duration,
      result: result.result,
      analysis: result.analysis,
      error: result.error,
      reportId: reportId // 新增：返回报告ID
    });
    
  } catch (error) {
    console.error('执行测试失败:', error);
    res.status(500).json({
      success: false,
      message: '执行测试失败',
      error: error.message
    });
  }
});

// 执行所有测试
app.post('/api/execute-all-tests', async (req, res) => {
  try {
    const { options } = req.body;
    
    console.log('开始执行所有测试...');
    
    const testsDir = path.join(__dirname, '../tests/generated');
    const files = await fs.readdir(testsDir);
    const testFiles = files.filter(file => file.endsWith('.spec.ts'));
    
    if (testFiles.length === 0) {
      return res.json({
        success: true,
        results: [],
        message: '没有找到测试文件'
      });
    }
    
    const testFilePaths = testFiles.map(file => `tests/generated/${file}`);
    const startTime = Date.now();
    
    const results = await testExecutor.executeMultipleTests(testFilePaths);
    const duration = Date.now() - startTime;
    
    const report = testExecutor.generateExecutionReport(results);
    
    // 新增：生成 Playwright HTML 报告
    const reportId = `report-${Date.now()}`;
    try {
      await generatePlaywrightReport(reportId);
      console.log('✅ Playwright 报告生成成功');
    } catch (reportError) {
      console.error('❌ 生成 Playwright 报告失败:', reportError);
    }
    
    // 保存汇总报告
    try {
      const reportsDir = path.join(__dirname, '../test-results/reports');
      await fs.mkdir(reportsDir, { recursive: true });
      const summary = {
        id: `suite-${Date.now()}`,
        name: '批量执行',
        testSuite: '全部用例',
        executionTime: new Date().toISOString(),
        status: report.passed === report.total ? 'success' : 'failure',
        totalTests: report.total,
        passedTests: report.passed,
        failedTests: report.failed,
        successRate: report.total > 0 ? Math.round((report.passed / report.total) * 100) : 0,
        tests: results.map((r, idx) => ({ id: String(idx + 1), name: r.testFile || `case-${idx+1}` , status: r.success ? 'success' : 'failure', duration: r.duration || 0, error: r.error || undefined })),
        reportId
      };
      await fs.writeFile(path.join(reportsDir, `${summary.id}.json`), JSON.stringify(summary, null, 2));
    } catch (e) {
      console.warn('写入汇总报告失败:', e.message);
    }

    res.json({
      success: true,
      results,
      report: {
        ...report,
        duration,
        reportId: reportId // 新增：返回报告ID
      }
    });
    
  } catch (error) {
    console.error('执行所有测试失败:', error);
    res.status(500).json({
      success: false,
      message: '执行所有测试失败',
      error: error.message
    });
  }
});

// 列出保存的报告
app.get('/api/reports', async (req, res) => {
  try {
    const reportsDir = path.join(__dirname, '../test-results/reports');
    await fs.mkdir(reportsDir, { recursive: true });
    const files = await fs.readdir(reportsDir);
    const items = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(reportsDir, f), 'utf8');
        const json = JSON.parse(raw);
        items.push(json);
      } catch {}
    }
    // 最近的在前
    items.sort((a, b) => new Date(b.executionTime).getTime() - new Date(a.executionTime).getTime());
    // 如果没有专门的报告文件，尝试从 Playwright JSON 报告转换一份
    if (items.length === 0) {
      const jsonReport = path.join(__dirname, '../test-results/results.json');
      try {
        const converted = await parsePlaywrightJsonReport(jsonReport);
        if (converted) items.push(converted);
      } catch {}
    }
    res.json({ success: true, reports: items });
  } catch (e) {
    res.status(500).json({ success: false, message: '读取报告失败', error: e.message });
  }
});

// 获取单个报告
app.get('/api/report/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const file = path.join(__dirname, '../test-results/reports', `${id}.json`);
    const raw = await fs.readFile(file, 'utf8');
    const json = JSON.parse(raw);
    res.json({ success: true, report: json });
  } catch (e) {
    res.status(404).json({ success: false, message: '报告不存在' });
  }
});

// 提 Bug（单条）
app.post('/api/bugs/report', async (req, res) => {
  try {
    const payload = req.body || {};
    const {
      testName,
      pageUrl,
      env = 'test',
      browser = 'chromium',
      steps = [],
      expects = [],
      unmatchedRules = [],
      matchedRules = [],
      logs = '',
      attachments = [],
      tapd = {},
      executionTime,
      duration,
      reportId
    } = payload;

    const provider = new TapdProvider(process.env);
    
    // 尝试查找相关的测试附件（截图、视频、trace等）
    const foundAttachments = await findTestAttachments(testName, reportId);
    const allAttachments = [...attachments, ...foundAttachments];
    
    // 构建更详细的描述
    const description = [
      `【测试场景】`,
      `- 测试用例: ${testName || '未命名用例'}`,
      `- 页面地址: ${pageUrl || '-'}`,
      `- 测试环境: ${env}`,
      `- 浏览器: ${browser}`,
      `- 执行时间: ${executionTime ? new Date(executionTime).toLocaleString('zh-CN') : '-'}`,
      `- 执行耗时: ${duration ? `${duration}ms` : '-'}`,
      reportId ? `- 报告ID: ${reportId}` : '',
      '',
      `【复现步骤】`,
      ...(steps.length > 0 ? steps.map((s, i) => {
        const text = typeof s === 'string' ? s : s.text;
        const hit = typeof s === 'object' && s.hit !== undefined ? (s.hit ? ' ✅' : ' ❌') : '';
        return `${i + 1}. ${text}${hit}`;
      }) : ['暂无详细步骤记录']),
      '',
      `【期望结果】`,
      ...(expects.length > 0 ? expects.map(e => {
        const text = typeof e === 'string' ? e : e.text;
        const hit = typeof e === 'object' && e.hit !== undefined ? (e.hit ? ' ✅' : ' ❌') : '';
        return `- ${text}${hit}`;
      }) : ['暂无期望结果记录']),
      '',
      `【实际结果】`,
      ...(unmatchedRules.length > 0 ? unmatchedRules.map(u => {
        const text = typeof u === 'string' ? u : (u.text || u.rule || String(u));
        return `❌ ${text}`;
      }) : ['测试执行失败，具体失败点请查看错误日志']),
      '',
      matchedRules.length > 0 ? `【成功验证项】` : '',
      ...matchedRules.map(m => {
        const text = typeof m === 'string' ? m : (m.text || m.rule || String(m));
        return `✅ ${text}`;
      }),
      matchedRules.length > 0 ? '' : '',
      logs ? `【错误日志】` : '',
      logs ? '```' : '',
      logs || '',
      logs ? '```' : '',
      '',
      `【附件信息】`,
      ...(allAttachments.length > 0 ? allAttachments.map(att => {
        const size = att.size ? `${Math.round(att.size/1024)}KB` : 'unknown size';
        const type = att.type || 'file';
        const name = att.name || att.path || 'unnamed';
        const path = att.path ? ` (${att.path})` : '';
        return `- ${type}: ${name} (${size})${path}`;
      }) : ['暂无附件']),
      allAttachments.length > 0 ? `注意：由于TAPD API限制，附件暂未直接上传，请手动添加相关截图和视频` : '',
      '',
      `---`,
      `此Bug由UI自动化测试系统自动创建`,
      `创建人: ${provider.displayName}`,
      `生成时间: ${new Date().toLocaleString('zh-CN')}`
    ].filter(line => line !== null && line !== undefined).join('\n');

    const bug = await provider.createBug({
      title: `[UI自动化] ${testName || '未命名用例'}`,
      description,
      severity: tapd.severity,
      priority: tapd.priority,
      module_id: tapd.module_id,
      owner: tapd.owner,
      attachments: allAttachments,
    });

    res.json({ success: true, bug });
  } catch (e) {
    console.error('创建Bug失败:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// 从手动输入/文件元数据生成基础测试代码
app.post('/api/generate-test', async (req, res) => {
  try {
    const { inputMethod, manualInput, files } = req.body || {};
    const pageName = manualInput?.pageName || '未命名页面';
    const pageUrl = manualInput?.pageUrl || '/';
    const pageDesc = manualInput?.pageDescription || '';
    const bodyMd = manualInput?.testCaseBody || '';

    // 将 Markdown 用例拆分为多个测试
    const parsedCases = parseMarkdownTestCases(bodyMd);
    const header = `import { test, expect } from '@playwright/test';\n\n`;
    const suiteStart = `test.describe('${pageName} - 自动生成用例', () => {\n`;
    const suiteEnd = `});\n`;
    const tests = parsedCases.length > 0 ? parsedCases.map((c, i) => {
      const stepCodes = (c.steps || []).map(s => mapStepToCode(s) || `// 步骤：${s}`).join('\n');
      const expectCodes = (c.expects || []).map(e => mapExpectToCode(e) || `// 预期：${e}`).join('\n');
      return `  test('${c.title || '用例' + (i+1)}', async ({ page }) => {\n    await page.goto('${pageUrl}');\n    await page.waitForLoadState('networkidle');\n${stepCodes ? stepCodes + '\n' : ''}${expectCodes ? expectCodes + '\n' : ''}  });\n`;
    }).join('\n') : `  test('页面可访问', async ({ page }) => {\n    await page.goto('${pageUrl}');\n    await page.waitForLoadState('networkidle');\n    await expect(page).toHaveURL(/${pageUrl.replace(/\//g, '\\/')}/);\n  });\n`;
    const code = header + suiteStart + tests + suiteEnd;
    // 兜底：若未产生命中（例如用户未用“步骤/预期”分节），从原始 Markdown 行尝试规则匹配，确保前端“命中规则”有数据
    if ((ruleSummary.steps.length === 0 && ruleSummary.expects.length === 0) && (bodyMd || '').trim()) {
      const rawLines = bodyMd.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      for (const line of rawLines) {
        const text = line.replace(/^[-•\d\.)]\s*/, '');
        if (!text) continue;
        if (/应|显示|选中|成功|失败|提示|可见|包含|等于|相等|标题/.test(text)) {
          mapExpectToCode(text, ruleSummary);
        } else {
          mapStepToCode(text, ruleSummary);
        }
      }
    }
    // 若依然没有命中，则给出占位记录，便于前端展示
    if (ruleSummary.steps.length === 0 && ruleSummary.expects.length === 0) {
      ruleSummary.steps.push({ text: '未检测到可匹配的步骤语句', rule: 'none', hit: false });
      ruleSummary.expects.push({ text: '未检测到可匹配的预期语句', rule: 'none', hit: false });
    }

    // 兜底：若未产生命中（例如用户未用“步骤/预期”分节），从原始 Markdown 行尝试规则匹配，以便前端展示命中规则
    if ((ruleSummary.steps.length === 0 && ruleSummary.expects.length === 0) && (bodyMd || '').trim()) {
      const rawLines = bodyMd.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
      for (const line of rawLines) {
        const text = line.replace(/^[-•\d\.\)]\s*/, '')
        if (!text) continue
        if (/应|显示|选中|成功|失败|提示|可见|包含|等于|相等|标题/.test(text)) {
          mapExpectToCode(text, ruleSummary)
        } else {
          mapStepToCode(text, ruleSummary)
        }
      }
    }
    // 若依然没有命中，则给出占位记录，便于前端展示
    if (ruleSummary.steps.length === 0 && ruleSummary.expects.length === 0) {
      ruleSummary.steps.push({ text: '未检测到可匹配的步骤语句', rule: 'none', hit: false })
      ruleSummary.expects.push({ text: '未检测到可匹配的预期语句', rule: 'none', hit: false })
    }

    // 同步保存到 tests/generated 目录
    const testsDir = path.join(__dirname, '../tests/generated');
    await fs.mkdir(testsDir, { recursive: true });
    const safeName = String(pageName)
      .replace(/[^\u4e00-\u9fa5\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'auto-test';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${safeName}-ui-automation-${ts}.spec.ts`;
    const filePath = path.join(testsDir, fileName);
    await fs.writeFile(filePath, code, 'utf8');

    res.json({ success: true, code, file: `tests/generated/${fileName}` });
  } catch (error) {
    console.error('生成测试代码失败:', error);
    res.status(500).json({ success: false, message: '生成测试代码失败', error: error.message });
  }
});

// 流式：生成测试（SSE 推送步骤/摘要/结果）
app.post('/api/generate-test-stream', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // 立即刷新响应头，避免代理缓冲
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const send = (event, dataObj) => {
      try {
        const dataStr = JSON.stringify(dataObj);
        console.log(`📤 发送 ${event} 事件，数据长度: ${dataStr.length} 字符`);
        res.write(`event: ${event}\n`);
        res.write(`data: ${dataStr}\n\n`);
        console.log(`✅ ${event} 事件发送完成`);
      } catch (e) {
        console.error(`❌ 发送 ${event} 事件失败:`, e);
        // 写入失败通常是客户端断开
      }
    };

    // 初始心跳，确保前端可读到第一帧
    send('ping', { t: Date.now() });

    // 客户端断开时清理（使用 res 的 close，更可靠）
    res.on('close', () => {
      try {
        console.log('[SSE] client connection closed');
      } catch {}
    });

    const { inputMethod, manualInput, files } = req.body || {};
    const pageName = manualInput?.pageName || '未命名页面';
    const pageUrl = manualInput?.pageUrl || '/';
    const bodyMd = manualInput?.testCaseBody || '';
    
    console.log('📝 接收到的用例内容:', bodyMd);
    console.log('📝 用例内容长度:', bodyMd.length);
    console.log('📝 用例内容前100字符:', bodyMd.substring(0, 100));

    send('progress', { message: '校验输入与上传文件' });
    await new Promise(r => setTimeout(r, 150));
    send('progress', { message: '抽取页面关键信息与控件' });

    const parsedCases = parseMarkdownTestCases(bodyMd);
    console.log('🔍 解析到的用例:', JSON.stringify(parsedCases, null, 2));
    send('progress', { message: `解析用例文本并结构化步骤（${parsedCases.length} 个用例）` });

    const header = `import { test, expect } from '@playwright/test';\n\n`;
    const suiteStart = `test.describe('${pageName} - 自动生成用例', () => {\n`;
    const suiteEnd = `});\n`;
    const ruleSummary = { steps: [], expects: [] };
    const tests = parsedCases.length > 0 ? parsedCases.map((c, i) => {
      const stepCodes = (c.steps || []).map(s => mapStepToCode(s, ruleSummary) || `// 步骤：${s}`).join('\n');
      const expectCodes = (c.expects || []).map(e => mapExpectToCode(e, ruleSummary) || `// 预期：${e}`).join('\n');
      return `  test('${c.title || '用例' + (i+1)}', async ({ page }) => {\n    await page.goto('${pageUrl}');\n    await page.waitForLoadState('networkidle');\n${stepCodes ? stepCodes + '\n' : ''}${expectCodes ? expectCodes + '\n' : ''}  });\n`;
    }).join('\n') : `  test('页面可访问', async ({ page }) => {\n    await page.goto('${pageUrl}');\n    await page.waitForLoadState('networkidle');\n    await expect(page).toHaveURL\(/${pageUrl.replace(/\//g, '\\/')}\/\);\n  });\n`;
    const code = header + suiteStart + tests + suiteEnd;
    // 若有结构化用例，将用例标题作为进度步骤抛给前端，增强“步骤推演”数据
    if (parsedCases.length > 0) {
      parsedCases.forEach((c, i) => send('progress', { message: `${i + 1}. ${c.title || '用例' + (i+1)}` }));
    }

    // 兜底：如果未命中任何规则，则基于原始 Markdown 行做启发式匹配
    if ((ruleSummary.steps.length === 0 && ruleSummary.expects.length === 0) && (bodyMd || '').trim()) {
      console.log('🔍 开始兜底规则匹配，原始文本:', bodyMd);
      const rawLines = bodyMd.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      console.log('📝 解析到的行数:', rawLines.length);
      for (const line of rawLines) {
        const text = line.replace(/^[-•\d\.)]\s*/, '');
        if (!text) continue;
        console.log('🔍 处理行:', text);
        if (/应|显示|选中|成功|失败|提示|可见|包含|等于|相等|标题|预期|结果/.test(text)) {
          console.log('✅ 识别为预期:', text);
          mapExpectToCode(text, ruleSummary);
        } else {
          console.log('✅ 识别为步骤:', text);
          mapStepToCode(text, ruleSummary);
        }
      }
      console.log('📊 兜底后的规则摘要:', ruleSummary);
    }
    // 仍为空则填充占位项，确保前端能渲染
    if (ruleSummary.steps.length === 0 && ruleSummary.expects.length === 0) {
      ruleSummary.steps.push({ text: '未检测到可匹配的步骤语句', rule: 'none', hit: false });
      ruleSummary.expects.push({ text: '未检测到可匹配的预期语句', rule: 'none', hit: false });
    }

    // 保存到 tests/generated 目录，保持与非流式接口一致的落盘行为
    const testsDir = path.join(__dirname, '../tests/generated');
    await fs.mkdir(testsDir, { recursive: true });
    const safeName = String(pageName)
      .replace(/[^\u4e00-\u9fa5\w-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'auto-test';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${safeName}-ui-automation-${ts}.spec.ts`;
    const filePath = path.join(testsDir, fileName);
    await fs.writeFile(filePath, code, 'utf8');

    send('analysis', { summary: '已生成基础用例与断言，建议执行前确认关键定位与前置条件。' });
    
    // 调试：打印规则摘要
    console.log('🚀 准备发送规则摘要:', JSON.stringify(ruleSummary, null, 2));
    
    // 先发送一个简化版的 rules 事件，确保前端能收到
    console.log('📤 准备发送简化版 rules 事件...');
    const simpleRules = { 
      steps: ruleSummary.steps.slice(0, 3), // 只发送前3个步骤
      expects: ruleSummary.expects.slice(0, 3) // 只发送前3个预期
    };
    send('rules', simpleRules);
    console.log('✅ 简化版 rules 事件已发送');
    
    // 强制刷新输出缓冲区
    console.log('🔄 强制刷新输出缓冲区...');
    if (res.flush) res.flush();
    
    // 等待一下，确保 rules 事件被处理
    console.log('⏳ 等待 1000ms...');
    await new Promise(r => setTimeout(r, 1000));
    console.log('✅ 等待完成');
    
    // 再次强制刷新
    console.log('🔄 再次强制刷新输出缓冲区...');
    if (res.flush) res.flush();
    
    // 然后发送完整的 result 事件
    console.log('📤 准备发送 result 事件...');
    send('result', { code, steps: parsedCases.flatMap(c => c.steps || []).slice(0, 12), file: `tests/generated/${fileName}`, rules: ruleSummary });
    console.log('✅ result 事件已发送');
    
    // 最后强制刷新
    console.log('🔄 最后强制刷新输出缓冲区...');
    if (res.flush) res.flush();
    
    // 再等待一下，确保所有事件都被发送
    console.log('⏳ 最后等待 500ms...');
    await new Promise(r => setTimeout(r, 500));
    console.log('✅ 最后等待完成');
    
    // 最后强制刷新
    console.log('🔄 最终强制刷新输出缓冲区...');
    if (res.flush) res.flush();

    res.end();
  } catch (e) {
    try {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message: e.message })}\n\n`);
    } catch {}
    res.end();
  }
});

// 工具函数：去除Markdown标记和说明，只保留TypeScript代码
function stripMarkdownAndComments(raw) {
  if (!raw) return '';
  
  let code = raw.trim();
  
  // 去除代码块标记
  if (code.startsWith('```')) {
    code = code.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
  }
  
  // 去除所有以#开头的标题行
  code = code.replace(/^#.*$/gm, '');
  
  // 去除所有以```开头和结尾的行
  code = code.replace(/^```.*$/gm, '');
  
  // 去除所有以数字.、数字) 开头的说明行
  code = code.replace(/^\s*\d+[\.|\)]\s.*$/gm, '');
  
  // 去除所有以##、###、####等开头的说明行
  code = code.replace(/^#+\s.*$/gm, '');
  
  // 去除所有以"代码说明"、"说明"、"测试流程"等常见中文说明开头的行
  code = code.replace(/^(代码说明|说明|测试流程|错误处理|等待机制|验证点|测试数据|这个测试可以直接运行).*$/gm, '');
  
  // 去除所有中文说明行（以中文字符开头的行）
  code = code.replace(/^[\u4e00-\u9fa5].*$/gm, '');
  
  // 去除所有以"- "开头的说明行
  code = code.replace(/^\s*-\s.*$/gm, '');
  
  // 去除所有以"• "开头的说明行
  code = code.replace(/^\s*•\s.*$/gm, '');
  
  // 去除所有以"注意："、"提示："等开头的说明行
  code = code.replace(/^(注意|提示|说明|注意：|提示：|说明：).*$/gm, '');
  
  // 去除所有以"```bash"、"```typescript"等开头的代码块标记行
  code = code.replace(/^```[a-zA-Z]*$/gm, '');
  
  // 去除所有以"npm install"、"npx playwright"等开头的安装说明行
  code = code.replace(/^(npm install|npx playwright|yarn add).*$/gm, '');
  
  // 去除所有以"运行测试"、"执行测试"等开头的说明行
  code = code.replace(/^(运行测试|执行测试|测试命令).*$/gm, '');
  
  // 去除所有以"文件结构"、"目录结构"等开头的说明行
  code = code.replace(/^(文件结构|目录结构|项目结构).*$/gm, '');
  
  // 去除所有以"使用说明"、"安装指南"等开头的说明行
  code = code.replace(/^(使用说明|安装指南|配置说明).*$/gm, '');
  
  // 去除所有以"总结"、"总结："等开头的说明行
  code = code.replace(/^(总结|总结：|总结说明).*$/gm, '');
  
  // 去除所有以"以上是"、"以下是"等开头的行
  code = code.replace(/^(以上是|以下是|这是).*$/gm, '');
  
  // 去除所有以"采用"、"使用"等开头的行
  code = code.replace(/^(采用|使用|基于).*$/gm, '');
  
  // 去除所有以"页面对象模式"、"POM"等开头的行
  code = code.replace(/^(页面对象模式|POM|Page Object Model).*$/gm, '');
  
  // 去除所有以"测试用例类"、"测试逻辑"等开头的行
  code = code.replace(/^(测试用例类|测试逻辑|页面细节).*$/gm, '');
  
  // 去除所有以"使用placeholder属性"、"使用文本内容"等开头的行
  code = code.replace(/^(使用placeholder属性|使用文本内容|使用data-testid属性).*$/gm, '');
  
  // 去除所有以"使用waitFor"、"使用waitForLoadState"等开头的行
  code = code.replace(/^(使用waitFor|使用waitForLoadState|使用networkidle).*$/gm, '');
  
  // 去除所有以"使用try-catch"、"错误会被记录"等开头的行
  code = code.replace(/^(使用try-catch|错误会被记录|错误会被重新抛出).*$/gm, '');
  
  // 去除所有以"验证URL"、"验证页面"等开头的行
  code = code.replace(/^(验证URL|验证页面|验证跳转).*$/gm, '');
  
  // 去除所有以"使用test.step"、"每个步骤"等开头的行
  code = code.replace(/^(使用test.step|每个步骤|步骤描述).*$/gm, '');
  
  // 去除所有以"login.spec.ts"、"loginPage.ts"等开头的文件名说明行
  code = code.replace(/^(`[^`]+\.(spec|ts|js)`|`[^`]+\.(spec|ts|js)`\s*\([^)]+\)).*$/gm, '');
  
  // 去除所有以"npm install"、"npx playwright test"等开头的命令说明行
  code = code.replace(/^(```bash|```shell|```cmd).*$/gm, '');
  
  // 去除所有以"注意："、"由于无法访问"等开头的行
  code = code.replace(/^(注意：|由于无法访问|验证码处理).*$/gm, '');
  
  // 去除所有以"如果验证码是"、"可能需要其他处理方式"等开头的行
  code = code.replace(/^(如果验证码是|可能需要其他处理方式|如使用测试环境).*$/gm, '');
  
  // 去除所有以"固定验证码"、"绕过验证码机制"等开头的行
  code = code.replace(/^(固定验证码|绕过验证码机制|动态生成).*$/gm, '');
  
  // 新增：更彻底的清理
  // 去除所有包含反引号的行（通常是文件名说明）
  code = code.replace(/^.*`.*$/gm, '');
  
  // 去除所有以反引号开头或结尾的行
  code = code.replace(/^`.*$/gm, '');
  code = code.replace(/^.*`$/gm, '');
  
  // 去除所有以"```"开头的行
  code = code.replace(/^```.*$/gm, '');
  
  // 去除所有以"bash"、"shell"、"cmd"等开头的行
  code = code.replace(/^(bash|shell|cmd|typescript|javascript).*$/gm, '');
  
  // 去除所有以"npm"、"npx"、"yarn"等开头的行
  code = code.replace(/^(npm|npx|yarn).*$/gm, '');
  
  // 去除所有以"安装"、"运行"、"执行"等开头的行
  code = code.replace(/^(安装|运行|执行|测试).*$/gm, '');
  
  // 去除所有以"命令"、"指南"、"说明"等开头的行
  code = code.replace(/^(命令|指南|说明|配置).*$/gm, '');
  
  // 去除所有以"环境"、"测试环境"等开头的行
  code = code.replace(/^(环境|测试环境|生产环境).*$/gm, '');
  
  // 去除所有以"验证码"、"动态"、"固定"等开头的行
  code = code.replace(/^(验证码|动态|固定|绕过).*$/gm, '');
  
  // 去除所有以"机制"、"方式"、"处理"等开头的行
  code = code.replace(/^(机制|方式|处理|调整).*$/gm, '');
  
  // 去除所有以"实际"、"情况"、"页面"等开头的行
  code = code.replace(/^(实际|情况|页面|访问).*$/gm, '');
  
  // 去除所有以"无法"、"可能"、"需要"等开头的行
  code = code.replace(/^(无法|可能|需要|根据).*$/gm, '');
  
  // 去除所有以"如果"、"如"、"使用"等开头的行
  code = code.replace(/^(如果|如|使用|采用).*$/gm, '');
  
  // 去除所有以"测试"、"测试用例"等开头的行
  code = code.replace(/^(测试|测试用例|测试文件).*$/gm, '');
  
  // 去除所有以"文件"、"目录"、"项目"等开头的行
  code = code.replace(/^(文件|目录|项目|结构).*$/gm, '');
  
  // 去除所有以"代码"、"实现"、"编写"等开头的行
  code = code.replace(/^(代码|实现|编写|生成).*$/gm, '');
  
  // 去除所有以"采用"、"使用"、"基于"等开头的行
  code = code.replace(/^(采用|使用|基于|采用).*$/gm, '');
  
  // 去除所有以"模式"、"POM"、"对象"等开头的行
  code = code.replace(/^(模式|POM|对象|页面).*$/gm, '');
  
  // 去除所有以"元素"、"操作"、"封装"等开头的行
  code = code.replace(/^(元素|操作|封装|定位).*$/gm, '');
  
  // 去除所有以"属性"、"选择器"、"文本"等开头的行
  code = code.replace(/^(属性|选择器|文本|内容).*$/gm, '');
  
  // 去除所有以"waitFor"、"waitForLoadState"等开头的行
  code = code.replace(/^(waitFor|waitForLoadState|networkidle).*$/gm, '');
  
  // 去除所有以"try-catch"、"错误"、"捕获"等开头的行
  code = code.replace(/^(try-catch|错误|捕获|处理).*$/gm, '');
  
  // 去除所有以"验证"、"检查"、"断言"等开头的行
  code = code.replace(/^(验证|检查|断言|URL).*$/gm, '');
  
  // 去除所有以"步骤"、"分解"、"描述"等开头的行
  code = code.replace(/^(步骤|分解|描述|可读).*$/gm, '');
  
  // 去除所有以"每个"、"都有"、"明确"等开头的行
  code = code.replace(/^(每个|都有|明确|步骤).*$/gm, '');
  
  // 去除所有以"login.spec.ts"、"loginPage.ts"等开头的行
  code = code.replace(/^(login\.spec\.ts|loginPage\.ts).*$/gm, '');
  
  // 去除所有以"测试用例"、"页面对象"等开头的行
  code = code.replace(/^(测试用例|页面对象).*$/gm, '');
  
  // 去除所有以"npm install"、"npx playwright test"等开头的行
  code = code.replace(/^(npm install|npx playwright test).*$/gm, '');
  
  // 去除所有以"注意："、"由于无法访问"等开头的行
  code = code.replace(/^(注意：|由于无法访问).*$/gm, '');
  
  // 去除所有以"验证码处理"、"可能需要"等开头的行
  code = code.replace(/^(验证码处理|可能需要).*$/gm, '');
  
  // 去除所有以"其他处理方式"、"如使用"等开头的行
  code = code.replace(/^(其他处理方式|如使用).*$/gm, '');
  
  // 去除所有以"测试环境"、"固定验证码"等开头的行
  code = code.replace(/^(测试环境|固定验证码).*$/gm, '');
  
  // 去除所有以"绕过验证码机制"、"动态生成"等开头的行
  code = code.replace(/^(绕过验证码机制|动态生成).*$/gm, '');
  
  // 新增：处理所有可能的npm、npx、yarn命令
  code = code.replace(/^(npm|npx|yarn).*$/gm, '');
  
  // 新增：处理所有可能的bash、shell命令
  code = code.replace(/^(bash|shell|cmd).*$/gm, '');
  
  // 新增：处理所有可能的安装、运行命令
  code = code.replace(/^(安装|运行|执行|测试|命令|指南|说明|配置).*$/gm, '');
  
  // 新增：处理所有可能的代码块标记
  code = code.replace(/^```.*$/gm, '');
  
  // 新增：处理所有可能的反引号内容
  code = code.replace(/^.*`.*$/gm, '');
  
  // 去除多余空行
  code = code.replace(/\n{3,}/g, '\n\n');
  
  // 去除行首行尾空白
  code = code.split('\n').map(line => line.trim()).join('\n');
  
  // 去除完全空白的行
  code = code.split('\n').filter(line => line.trim() !== '').join('\n');
  
  // 最终清理：去除所有非代码行
  const lines = code.split('\n');
  const cleanedLines = lines.filter(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return false;
    
    // 保留所有以import、export、const、let、var、function、class、test、async、await开头的行
    if (/^(import|export|const|let|var|function|class|test|async|await|if|else|try|catch|finally|for|while|switch|case|default|return|throw|new|this|super|extends|implements|interface|type|enum|namespace|declare|module|require|console\.|expect\(|page\.|browser\.|await\s+)/.test(trimmedLine)) {
      return true;
    }
    
    // 保留所有包含代码的行（包含括号、分号、等号、箭头等）
    if (/[{}()\[\]]|;|=|=>|\.|\(|\)|,|:|<|>|\+|-|\*|\/|%|&|\||!|\?/.test(trimmedLine)) {
      return true;
    }
    
    // 保留所有以//开头的注释行
    if (trimmedLine.startsWith('//')) {
      return true;
    }
    
    // 保留所有以/*开头的多行注释
    if (trimmedLine.startsWith('/*')) {
      return true;
    }
    
    // 保留所有以*/结尾的多行注释
    if (trimmedLine.endsWith('*/')) {
      return true;
    }
    
    // 去除其他所有行
    return false;
  });
  
  // 修复代码格式：确保每行之间有正确的换行符
  let result = cleanedLines.join('\n').trim();
  
  // 确保代码以换行符结尾
  if (result && !result.endsWith('\n')) {
    result += '\n';
  }
  
  return result;
}

// 执行生成的测试代码
app.post('/api/execute-generated-test', async (req, res) => {
  try {
    const { testCode, testName } = req.body;
    
    if (!testCode) {
      return res.status(400).json({
        success: false,
        message: '请提供测试代码'
      });
    }
    
    // 新增：清洗代码
    const cleanedCode = stripMarkdownAndComments(testCode);
    // 创建临时测试文件
    const tempFileName = `temp-${Date.now()}.spec.ts`;
    const tempFilePath = path.join(__dirname, '../tests/generated', tempFileName);
    
    await fs.writeFile(tempFilePath, cleanedCode, 'utf8');
    
    console.log(`执行生成的测试: ${tempFileName}`);
    
    const startTime = Date.now();
    const result = await testExecutor.executeTest(tempFilePath);
    const duration = Date.now() - startTime;
    
    // 生成 Playwright HTML 报告
    const reportId = `report-${Date.now()}`;
    try {
      await generatePlaywrightReport(reportId);
    } catch (reportError) {
      console.error('生成 Playwright 报告失败:', reportError);
    }
    
    // 清理临时文件
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      console.error('清理临时文件失败:', cleanupError);
    }
    
    res.json({
      success: true,
      testFile: tempFileName,
      success: result.success,
      duration,
      result: result.result,
      analysis: result.analysis,
      error: result.error,
      reportId: reportId // 新增：返回报告ID
    });
    
  } catch (error) {
    console.error('执行生成的测试失败:', error);
    res.status(500).json({
      success: false,
      message: '执行生成的测试失败',
      error: error.message
    });
  }
});

// 获取测试报告
app.get('/api/test-report/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    const reportPath = path.join(__dirname, '../test-results', `${testId}.json`);
    
    const reportData = await fs.readFile(reportPath, 'utf8');
    const report = JSON.parse(reportData);
    
    res.json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('获取测试报告失败:', error);
    res.status(500).json({
      success: false,
      message: '获取测试报告失败',
      error: error.message
    });
  }
});

// 生成测试报告
app.post('/api/generate-report', async (req, res) => {
  try {
    const { results, options } = req.body;
    
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({
        success: false,
        message: '请提供测试结果数据'
      });
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passedTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length,
      successRate: results.length > 0 ? 
        Math.round((results.filter(r => r.success).length / results.length) * 100) : 0,
      results: results,
      recommendations: generateRecommendations(results)
    };
    
    // 保存报告
    const reportId = `report-${Date.now()}`;
    const reportPath = path.join(__dirname, '../test-results', `${reportId}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    res.json({
      success: true,
      reportId,
      report
    });
    
  } catch (error) {
    console.error('生成测试报告失败:', error);
    res.status(500).json({
      success: false,
      message: '生成测试报告失败',
      error: error.message
    });
  }
});

// 生成 Playwright HTML 报告
async function generatePlaywrightReport(reportId) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`📊 准备启动 Playwright 报告服务: ${reportId}`);
      
      // 检查是否已经有报告服务在运行
      const isPortInUse = await checkPortInUse(9323);
      
      if (isPortInUse) {
        console.log('⚠️ 端口 9323 已被占用，使用现有服务');
        // 如果端口被占用，直接返回现有服务的URL
        resolve({ 
          reportUrl: 'http://localhost:9323', 
          reportId, 
          existingService: true,
          message: '使用现有报告服务'
        });
        return;
      }
      
      console.log(`🚀 端口 9323 可用，启动新的 Playwright 报告服务`);
      
      // 使用 spawn 启动报告服务
      const reportProcess = spawn('npx', ['playwright', 'show-report', '--host=0.0.0.0', '--port=9323'], {
        cwd: process.cwd(),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      let hasResolved = false;
      
      // 设置超时，避免无限等待
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          console.log('⏰ 启动超时，尝试使用现有服务');
          hasResolved = true;
          resolve({ 
            reportUrl: 'http://localhost:9323', 
            reportId, 
            existingService: true,
            message: '启动超时，使用现有服务'
          });
        }
      }, 5000);
      
      reportProcess.stdout.on('data', (data) => {
        const dataStr = data.toString();
        output += dataStr;
        console.log('📤 Playwright 报告输出:', dataStr);
        
        // 检查是否成功启动
        if (dataStr.includes('Serving') || dataStr.includes('localhost:9323')) {
          if (!hasResolved) {
            console.log('✅ Playwright 报告服务已成功启动');
            hasResolved = true;
            clearTimeout(timeout);
            resolve({ 
              reportUrl: 'http://localhost:9323', 
              reportId, 
              existingService: false,
              message: '新服务启动成功'
            });
          }
        }
      });
      
      reportProcess.stderr.on('data', (data) => {
        const dataStr = data.toString();
        errorOutput += dataStr;
        console.error('❌ Playwright 报告错误:', dataStr);
        
        // 检查是否是端口占用错误
        if (dataStr.includes('EADDRINUSE') || dataStr.includes('address already in use')) {
          if (!hasResolved) {
            console.log('🔄 检测到端口冲突，尝试使用现有服务');
            hasResolved = true;
            clearTimeout(timeout);
            resolve({ 
              reportUrl: 'http://localhost:9323', 
              reportId, 
              existingService: true,
              message: '端口冲突，使用现有服务'
            });
          }
        }
      });
      
      reportProcess.on('error', (error) => {
        console.error('💥 启动 Playwright 报告服务失败:', error.message);
        
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          
          // 如果启动失败，尝试使用现有服务
          checkPortInUse(9323).then(isInUse => {
            if (isInUse) {
              console.log('🔄 尝试使用现有的报告服务');
              resolve({ 
                reportUrl: 'http://localhost:9323', 
                reportId, 
                existingService: true,
                message: '启动失败，使用现有服务'
              });
            } else {
              reject(error);
            }
          }).catch(() => {
            reject(error);
          });
        }
      });
      
      reportProcess.on('exit', (code) => {
        console.log(`📤 Playwright 报告进程退出，代码: ${code}`);
        
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          
          // 检查端口是否仍然可用
          checkPortInUse(9323).then(isInUse => {
            if (isInUse) {
              console.log('🔄 进程退出但端口可用，使用现有服务');
              resolve({ 
                reportUrl: 'http://localhost:9323', 
                reportId, 
                existingService: true,
                message: '进程退出，使用现有服务'
              });
            } else {
              resolve({ 
                reportUrl: 'http://localhost:9323', 
                reportId, 
                existingService: false,
                message: '服务启动完成'
              });
            }
          }).catch(() => {
            resolve({ 
              reportUrl: 'http://localhost:9323', 
              reportId, 
              existingService: false,
              message: '服务启动完成'
            });
          });
        }
      });
      
    } catch (error) {
      console.error('💥 生成 Playwright 报告时发生错误:', error);
      reject(error);
    }
  });
}

// 检查端口是否被占用
async function checkPortInUse(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    // 设置超时，避免长时间等待
    const timeout = setTimeout(() => {
      server.close();
      resolve(false); // 超时认为端口可用
    }, 1000);
    
    server.listen(port, () => {
      clearTimeout(timeout);
      server.once('close', () => {
        resolve(false); // 端口可用
      });
      server.close();
    });
    
    server.on('error', (err) => {
      clearTimeout(timeout);
      if (err.code === 'EADDRINUSE') {
        resolve(true); // 端口被占用
      } else {
        console.log(`⚠️ 端口 ${port} 检查时发生其他错误:`, err.code);
        resolve(false); // 其他错误认为端口可用
      }
    });
  });
}

// 生成改进建议
function generateRecommendations(results) {
  const recommendations = [];
  
  const failedTests = results.filter(r => !r.success);
  const slowTests = results.filter(r => r.duration > 10000);
  const successRate = results.length > 0 ? 
    (results.filter(r => r.success).length / results.length) * 100 : 0;
  
  if (failedTests.length > 0) {
    recommendations.push('建议检查失败测试的页面元素选择器是否正确');
    recommendations.push('考虑增加等待时间或重试机制');
  }
  
  if (successRate < 80) {
    recommendations.push('测试成功率较低，建议优化测试用例');
  }
  
  if (slowTests.length > 0) {
    recommendations.push('部分测试执行时间较长，建议优化测试性能');
  }
  
  if (results.length === 0) {
    recommendations.push('没有测试结果，请先执行测试');
  }
  
  return recommendations;
}

// 查看 Playwright 测试报告
app.get('/api/playwright-report', (req, res) => {
  try {
    // 返回 Playwright 报告的访问地址
    res.json({
      success: true,
      reportUrl: 'http://localhost:9323',
      message: 'Playwright 测试报告已准备就绪'
    });
  } catch (error) {
    console.error('获取 Playwright 报告失败:', error);
    res.status(500).json({
      success: false,
      message: '获取 Playwright 报告失败',
      error: error.message
    });
  }
});

// 启动 Playwright 报告服务器
app.post('/api/start-playwright-report', async (req, res) => {
  try {
    const reportId = `report-${Date.now()}`;
    await generatePlaywrightReport(reportId);
    
    res.json({
      success: true,
      reportId,
      reportUrl: 'http://localhost:9323',
      message: 'Playwright 报告服务已启动'
    });
  } catch (error) {
    console.error('启动 Playwright 报告服务失败:', error);
    res.status(500).json({
      success: false,
      message: '启动 Playwright 报告服务失败',
      error: error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '测试执行API服务正常运行',
    timestamp: new Date().toISOString()
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🧪 测试执行API服务器运行在端口 ${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
});

module.exports = app; 