const fs = require('fs').promises;
const path = require('path');
const DeepSeekClient = require('./deepseek-client');
require('dotenv').config();

class LLMTestGenerator {
  constructor() {
    this.deepseek = new DeepSeekClient();
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 2000;
  }

  async generateTestPrompt(feature, pageDescription) {
    return `请为以下功能生成一个完整的Playwright测试用例：

功能描述：${feature}
页面描述：${pageDescription}

要求：
1. 使用TypeScript和Playwright
2. 包含完整的测试步骤
3. 添加适当的断言
4. 使用中文注释
5. 遵循最佳实践

请生成完整的测试文件内容：`;
  }

  async generateTest(feature, pageDescription) {
    try {
      console.log(`正在为功能 "${feature}" 生成测试用例...`);
      
      const prompt = await this.generateTestPrompt(feature, pageDescription);
      
      const messages = [
        {
          role: 'system',
          content: '你是一个专业的Web UI自动化测试工程师，擅长使用Playwright和TypeScript编写测试用例。'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const completion = await this.deepseek.chatCompletion(messages, {
        max_tokens: this.maxTokens,
        temperature: 0.3,
      });

      const generatedTest = completion.choices[0].message.content;
      
      if (!generatedTest) {
        throw new Error('LLM没有生成测试用例');
      }

      return generatedTest;
    } catch (error) {
      console.error('生成测试用例时出错:', error.message);
      throw error;
    }
  }

  async saveTestToFile(testContent, featureName) {
    try {
      const testsDir = path.join(__dirname, '..', 'tests', 'generated');
      
      // 确保目录存在
      await fs.mkdir(testsDir, { recursive: true });
      
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${featureName}-${timestamp}.spec.ts`;
      const filePath = path.join(testsDir, fileName);
      
      // 保存文件
      await fs.writeFile(filePath, testContent, 'utf8');
      
      console.log(`✅ 测试用例已保存到: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('保存测试文件时出错:', error.message);
      throw error;
    }
  }

  async generateAndSaveTest(feature, pageDescription) {
    try {
      const testContent = await this.generateTest(feature, pageDescription);
      const filePath = await this.saveTestToFile(testContent, feature);
      return filePath;
    } catch (error) {
      console.error('生成和保存测试用例失败:', error.message);
      throw error;
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const generator = new LLMTestGenerator();
  
  // 示例用法
  generator.generateAndSaveTest(
    '用户登录功能',
    '登录页面包含用户名输入框、密码输入框和登录按钮'
  ).catch(console.error);
}

module.exports = LLMTestGenerator; 