const fs = require('fs').promises;
const path = require('path');
const DeepSeekClient = require('./deepseek-client');
require('dotenv').config();

class UIAutomationGenerator {
  constructor() {
    this.deepseek = new DeepSeekClient();
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 4000;
  }

  async generateCompleteTestFile(parsedTestCase) {
    const prompt = this.buildPrompt(parsedTestCase);
    const messages = [
      {
        role: 'system',
        content: '你是一个专业的UI自动化测试工程师，擅长使用Playwright和TypeScript编写高质量的自动化测试代码。'
      },
      {
        role: 'user',
        content: prompt
      }
    ];
    const completion = await this.deepseek.chatCompletion(messages, {
      max_tokens: this.maxTokens,
      temperature: 0.3
    });
    const generatedCode = completion.choices[0].message.content;
    if (!generatedCode) {
      throw new Error('LLM没有生成代码');
    }
    return generatedCode;
  }

  buildPrompt(parsedTestCase) {
    const testName = parsedTestCase.testName || '未命名测试';
    const description = parsedTestCase.description || '无描述';
    const pageUrl = parsedTestCase.pageUrl || '未提供';
    const pageName = parsedTestCase.pageName || '未提供';
    const pageDescription = parsedTestCase.pageDescription || '无';
    const screenshot = parsedTestCase.screenshot ? '[已上传页面截图，可用于元素定位]' : '[无截图]';
    let stepsText = '无步骤信息';
    if (parsedTestCase.steps && Array.isArray(parsedTestCase.steps) && parsedTestCase.steps.length > 0) {
      stepsText = parsedTestCase.steps.map((step, index) => {
        const stepText = step.step || step.description || '步骤描述';
        const action = step.action || '';
        const expected = step.expected || '';
        return `${index + 1}. ${stepText}\n   - 操作: ${action}\n   - 预期: ${expected}`;
      }).join('\n');
    } else if (parsedTestCase.raw) {
      stepsText = parsedTestCase.raw;
    }
    return `请为以下测试用例生成完整的Playwright TypeScript自动化代码：\n\n测试用例信息：\n- 测试名称: ${testName}\n- 测试描述: ${description}\n- 页面名称: ${pageName}\n- 页面URL: ${pageUrl}\n- 页面描述: ${pageDescription}\n- 页面截图: ${screenshot}\n\n测试步骤：\n${stepsText}\n\n要求：\n1. 使用TypeScript和Playwright\n2. 使用页面对象模式（POM）\n3. 包含完整的测试步骤\n4. 添加适当的断言和验证\n5. 使用中文注释\n6. 包含错误处理\n7. 使用data-testid选择器（如果可能）\n8. 添加适当的等待机制\n9. 结合页面截图和页面描述，尽量精准定位元素\n\n请生成完整的测试文件，包括：\n- 必要的导入语句\n- 页面对象类\n- 测试用例类\n- 完整的测试方法\n\n请确保代码可以直接运行。`;
  }

  async saveGeneratedCode(code, testName) {
    const testsDir = path.join(__dirname, '..', 'tests', 'generated');
    await fs.mkdir(testsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${testName || 'auto-test'}-ui-automation-${timestamp}.spec.ts`;
    const filePath = path.join(testsDir, fileName);
    await fs.writeFile(filePath, code, 'utf-8');
    return filePath;
  }
}

module.exports = UIAutomationGenerator;