/**
 * 截图分析器 - 基于截图识别UI元素并生成选择器
 * 
 * 功能：
 * 1. 分析页面截图
 * 2. 识别UI元素（按钮、输入框、表格等）
 * 3. 生成智能选择器
 * 4. 提供元素定位建议
 */

const fs = require('fs').promises;
const path = require('path');
const DeepSeekClient = require('./deepseek-client');
require('dotenv').config();

class ScreenshotAnalyzer {
  constructor() {
    this.deepseek = new DeepSeekClient();
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 4000;
  }

  /**
   * 分析截图并识别UI元素
   */
  async analyzeScreenshot(imagePath, pageContext = {}) {
    try {
      console.log('🔍 开始分析截图...');
      
      let base64Image;
      
      // 检查是否是base64数据
      if (imagePath.startsWith('data:image/')) {
        // 直接使用base64数据
        base64Image = imagePath.replace(/^data:image\/[a-z]+;base64,/, '');
      } else {
        // 读取图片文件并转换为base64
        const imageBuffer = await fs.readFile(imagePath);
        base64Image = imageBuffer.toString('base64');
      }
      
      const prompt = this.buildAnalysisPrompt(pageContext);
      
      const messages = [
        {
          role: 'system',
          content: '你是一个专业的UI自动化测试专家，擅长分析网页截图并识别UI元素。请仔细分析截图中的每个UI元素，并提供最佳的元素定位策略。'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ];

      try {
        const completion = await this.deepseek.chatCompletion(messages, {
          max_tokens: this.maxTokens,
          temperature: 0.2,
        });

        const response = completion.choices[0].message.content;
        
        // 解析返回的元素信息
        const elements = this.parseElementsFromResponse(response);
        
        console.log(`✅ 识别到 ${elements.length} 个UI元素`);
        return elements;
      } catch (apiError) {
        console.error('DeepSeek API调用失败:', apiError.message);
        
        // 如果API不支持图像，返回模拟的元素
        console.log('🔄 使用模拟元素作为备用方案');
        return this.generateMockElements(pageContext);
      }
      
    } catch (error) {
      console.error('分析截图失败:', error.message);
      throw error;
    }
  }

  /**
   * 构建分析提示词
   */
  buildAnalysisPrompt(pageContext) {
    return `请分析这张网页截图，识别其中的UI元素并生成最佳的元素定位策略。

页面上下文信息：
${JSON.stringify(pageContext, null, 2)}

请识别以下类型的UI元素：
1. 输入框（文本框、密码框、搜索框等）
2. 按钮（登录按钮、提交按钮、取消按钮等）
3. 下拉菜单和选择框
4. 表格和列表
5. 链接和导航元素
6. 标签和文本元素
7. 图标和图片
8. 表单元素

对于每个识别到的元素，请提供：
1. 元素类型（input、button、select、table等）
2. 元素功能描述（如"用户名输入框"、"登录按钮"）
3. 最佳选择器策略（按优先级排序）：
   - data-testid（推荐）
   - id选择器
   - 类名选择器
   - 属性选择器
   - 文本内容选择器
   - XPath（最后选择）

请返回以下JSON格式：
{
  "elements": [
    {
      "type": "input",
      "description": "用户名输入框",
      "selectors": {
        "data-testid": "username-input",
        "id": "username",
        "name": "username",
        "placeholder": "请输入用户名",
        "xpath": "//input[@placeholder='请输入用户名']"
      },
      "recommendedSelector": "[data-testid='username-input']",
      "waitStrategy": "visible",
      "action": "fill"
    }
  ],
  "pageStructure": {
    "title": "页面标题",
    "mainSections": ["主要区域描述"],
    "navigation": ["导航元素描述"]
  },
  "suggestions": [
    "建议添加data-testid属性以提高测试稳定性",
    "建议为关键元素添加唯一标识"
  ]
}

请确保返回的是有效的JSON格式，不要包含其他文本。`;
  }

  /**
   * 解析LLM返回的元素信息
   */
  parseElementsFromResponse(response) {
    try {
      // 尝试直接解析JSON
      const parsed = JSON.parse(response);
      return parsed.elements || [];
    } catch (parseError) {
      console.log('⚠️ JSON解析失败，尝试手动提取元素信息');
      return this.extractElementsManually(response);
    }
  }

  /**
   * 手动提取元素信息（备用方案）
   */
  extractElementsManually(response) {
    const elements = [];
    
    // 简单的文本解析逻辑
    const lines = response.split('\n');
    let currentElement = null;
    
    for (const line of lines) {
      if (line.includes('"type"') || line.includes('"description"')) {
        if (currentElement) {
          elements.push(currentElement);
        }
        currentElement = {};
      }
      
      if (line.includes('"type"')) {
        const type = line.match(/"type":\s*"([^"]+)"/)?.[1];
        if (type) currentElement.type = type;
      }
      
      if (line.includes('"description"')) {
        const description = line.match(/"description":\s*"([^"]+)"/)?.[1];
        if (description) currentElement.description = description;
      }
      
      if (line.includes('"recommendedSelector"')) {
        const selector = line.match(/"recommendedSelector":\s*"([^"]+)"/)?.[1];
        if (selector) currentElement.recommendedSelector = selector;
      }
    }
    
    if (currentElement) {
      elements.push(currentElement);
    }
    
    return elements;
  }

  /**
   * 生成页面对象代码
   */
  async generatePageObject(elements, pageName) {
    try {
      console.log('📄 正在生成页面对象...');
      
      const className = this.generateClassName(pageName);
      
      const pageObjectCode = `
import { Page, Locator, expect } from '@playwright/test';

/**
 * ${pageName} 页面对象
 * 基于截图分析自动生成
 */
export class ${className} {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // 页面元素
${elements.map(element => {
  const elementName = this.generateElementName(element.description);
  const selector = element.recommendedSelector || '// 需要手动配置选择器';
  return `  ${elementName}: Locator = this.page.locator('${selector}');`;
}).join('\n')}

  // 页面操作方法
${elements.map(element => {
  const methodName = this.generateMethodName(element.description);
  const elementName = this.generateElementName(element.description);
  
  switch (element.type) {
    case 'input':
      return `  async ${methodName}(value: string) {
    await this.${elementName}.fill(value);
  }`;
    case 'button':
      return `  async ${methodName}() {
    await this.${elementName}.click();
    await this.page.waitForLoadState('networkidle');
  }`;
    case 'select':
      return `  async ${methodName}(value: string) {
    await this.${elementName}.selectOption(value);
  }`;
    default:
      return `  async ${methodName}() {
    await this.${elementName}.click();
  }`;
  }
}).join('\n\n')}

  // 验证方法
${elements.map(element => {
  const methodName = this.generateMethodName(element.description);
  const elementName = this.generateElementName(element.description);
  return `  async verify${methodName.charAt(0).toUpperCase() + methodName.slice(1)}() {
    await expect(this.${elementName}).toBeVisible();
  }`;
}).join('\n\n')}

  // 工具方法
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: \`test-results/screenshots/\${name}-\${Date.now()}.png\`,
      fullPage: true 
    });
  }
}`;

      return pageObjectCode;
    } catch (error) {
      console.error('生成页面对象失败:', error.message);
      throw error;
    }
  }

  /**
   * 生成测试用例代码
   */
  async generateTestSpec(elements, pageName) {
    try {
      console.log('🧪 正在生成测试用例...');
      
      const className = this.generateClassName(pageName);
      
      const testSpecCode = `
import { test, expect } from '@playwright/test';
import { ${className} } from './${className}.page';

/**
 * ${pageName} 测试用例
 * 基于截图分析自动生成
 */
test.describe('${pageName}', () => {
  let pageObject: ${className};

  test.beforeEach(async ({ page }) => {
    pageObject = new ${className}(page);
    await page.goto('${pageName === 'Login' ? '/login' : '/'}');
    await pageObject.waitForPageLoad();
  });

  test('基于截图的UI测试', async ({ page }) => {
    console.log('🚀 开始执行基于截图的UI测试');
    
    // 自动生成测试步骤
${elements.map((element, index) => {
  const methodName = this.generateMethodName(element.description);
  switch (element.type) {
    case 'input':
      return `    // 步骤 ${index + 1}: ${element.description}
    await pageObject.${methodName}('test-value');
    console.log('✅ 步骤 ${index + 1} 完成: ${element.description}');`;
    case 'button':
      return `    // 步骤 ${index + 1}: ${element.description}
    await pageObject.${methodName}();
    console.log('✅ 步骤 ${index + 1} 完成: ${element.description}');`;
    default:
      return `    // 步骤 ${index + 1}: ${element.description}
    await pageObject.${methodName}();
    console.log('✅ 步骤 ${index + 1} 完成: ${element.description}');`;
  }
}).join('\n\n')}

    console.log('✅ 基于截图的UI测试执行完成');
    await pageObject.takeScreenshot('${pageName}-screenshot-test-completed');
  });
});
      `;

      return testSpecCode;
    } catch (error) {
      console.error('生成测试用例失败:', error.message);
      throw error;
    }
  }

  /**
   * 生成完整的测试文件
   */
  async generateCompleteTestFile(elements, pageName, testSteps) {
    try {
      console.log('📝 正在生成完整的测试文件...');
      
      const className = this.generateClassName(pageName);
      const pageObjectCode = await this.generatePageObject(elements, pageName);
      const testSpecCode = await this.generateTestSpec(elements, pageName, testSteps);

      const completeCode = `
/**
 * ${pageName} - 基于截图分析的UI自动化测试
 * 生成时间: ${new Date().toLocaleString()}
 * 基于截图分析自动生成
 */

import { test, expect } from '@playwright/test';

// 页面对象
${pageObjectCode}

// 测试用例
${testSpecCode}
      `;

      return completeCode;
    } catch (error) {
      console.error('生成完整测试文件失败:', error.message);
      throw error;
    }
  }

  /**
   * 保存生成的代码到文件
   */
  async saveGeneratedCode(code, pageName) {
    try {
      const testsDir = path.join(__dirname, '..', 'tests', 'generated');
      await fs.mkdir(testsDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${pageName}-screenshot-analysis-${timestamp}.spec.ts`;
      const filePath = path.join(testsDir, fileName);
      
      await fs.writeFile(filePath, code, 'utf8');
      console.log(`✅ 基于截图分析的代码已保存到: ${filePath}`);
      
      return filePath;
    } catch (error) {
      console.error('保存生成的代码失败:', error.message);
      throw error;
    }
  }

  // 辅助方法
  generateClassName(name) {
    return name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('') + 'Page';
  }

  generateElementName(description) {
    return description
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toLowerCase() + word.slice(1))
      .join('');
  }

  generateMethodName(description) {
    return description
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .map(word => word.charAt(0).toLowerCase() + word.slice(1))
      .join('');
  }

  /**
   * 生成模拟元素（当API不支持图像分析时使用）
   */
  generateMockElements(pageContext) {
    const pageName = pageContext.name || 'Page';
    const isLoginPage = pageName.toLowerCase().includes('登录') || pageName.toLowerCase().includes('login');
    
    if (isLoginPage) {
      return [
        {
          type: 'input',
          description: '用户名输入框',
          recommendedSelector: '[data-testid="username"], #username, input[name="username"]'
        },
        {
          type: 'input',
          description: '密码输入框',
          recommendedSelector: '[data-testid="password"], #password, input[name="password"]'
        },
        {
          type: 'button',
          description: '登录按钮',
          recommendedSelector: '[data-testid="login-button"], button[type="submit"], .login-btn'
        }
      ];
    } else {
      return [
        {
          type: 'input',
          description: '搜索输入框',
          recommendedSelector: '[data-testid="search"], input[type="search"], .search-input'
        },
        {
          type: 'button',
          description: '提交按钮',
          recommendedSelector: '[data-testid="submit"], button[type="submit"], .submit-btn'
        },
        {
          type: 'link',
          description: '导航链接',
          recommendedSelector: '[data-testid="nav-link"], a[href], .nav-link'
        }
      ];
    }
  }
}

module.exports = ScreenshotAnalyzer; 