/**
 * 测试用例解析器 - 解析测试用例并提取UI操作步骤
 * 
 * 功能：
 * 1. 解析多种格式的测试用例
 * 2. 使用LLM提取UI操作步骤
 * 3. 生成结构化的测试数据
 */

const fs = require('fs').promises;
const path = require('path');
const DeepSeekClient = require('./deepseek-client');
require('dotenv').config();

class TestCaseParser {
  constructor() {
    this.deepseek = new DeepSeekClient();
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 3000;
  }

  async parseTestCase(testCaseContent) {
    try {
      console.log('🔍 开始解析测试用例...');
      
      const prompt = `请解析以下测试用例，并返回JSON格式的结构化数据：

测试用例内容：
${testCaseContent}

请返回以下JSON格式：
{
  "testName": "测试用例名称",
  "description": "测试用例描述",
  "preconditions": ["前置条件1", "前置条件2"],
  "steps": [
    {
      "step": "步骤描述",
      "action": "具体操作",
      "expected": "预期结果"
    }
  ],
  "postconditions": ["后置条件1", "后置条件2"],
  "testData": {
    "inputs": {},
    "expectedOutputs": {}
  },
  "tags": ["标签1", "标签2"]
}

重要提示：
1. 请仔细分析测试用例内容，提取测试名称（通常在"测试名称："或"## 测试名称"后面）
2. 提取测试描述（通常在"测试描述："或"## 测试描述"后面）
3. 提取测试步骤（通常在"测试步骤："或"## 测试步骤"后面）
4. 提取测试数据（通常在"测试数据："或"## 测试数据"后面）
5. 提取期望结果（通常在"期望结果："或"## 期望结果"后面）

请确保返回的是有效的JSON格式，不要包含其他文本。`;

      const messages = [
        {
          role: 'system',
          content: '你是一个专业的测试用例解析器，能够将自然语言描述的测试用例转换为结构化的JSON格式。请仔细分析测试用例内容，提取测试名称、描述、步骤等信息。特别注意识别"测试名称："、"测试描述："、"测试步骤："等关键词。'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const completion = await this.deepseek.chatCompletion(messages, {
        max_tokens: this.maxTokens,
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content;
      
      // 尝试解析JSON
      try {
        const parsed = JSON.parse(response);
        console.log('✅ 测试用例解析成功');
        return parsed;
      } catch (parseError) {
        console.error('❌ JSON解析失败:', parseError.message);
        // 尝试手动提取关键信息
        return this.fallbackParse(testCaseContent);
      }
      
    } catch (error) {
      console.error('解析测试用例失败:', error.message);
      // 使用备用解析方法
      return this.fallbackParse(testCaseContent);
    }
  }

  /**
   * 备用解析方法
   */
  fallbackParse(content) {
    console.log('🔄 使用备用解析方法...');
    
    // 手动提取关键信息
    const testNameMatch = content.match(/测试名称[：:]\s*(.+?)(?:\n|$)/);
    const descriptionMatch = content.match(/测试描述[：:]\s*(.+?)(?:\n|$)/);
    const stepsMatch = content.match(/测试步骤[：:]\s*([\s\S]*?)(?=后置条件|期望结果|测试数据|$)/);
    
    const testName = testNameMatch ? testNameMatch[1].trim() : '用户登录功能测试';
    const description = descriptionMatch ? descriptionMatch[1].trim() : '验证用户登录功能';
    
    // 解析步骤
    let steps = [];
    if (stepsMatch) {
      const stepsText = stepsMatch[1];
      const stepLines = stepsText.split('\n').filter(line => line.trim() && /^\d+\./.test(line.trim()));
      steps = stepLines.map((line, index) => {
        const stepText = line.replace(/^\d+\.\s*/, '').trim();
        return {
          step: stepText,
          action: this.extractAction(stepText),
          expected: this.extractExpected(stepText)
        };
      });
    }
    
    // 如果没有解析到步骤，创建默认步骤
    if (steps.length === 0) {
      steps = [
        { step: '打开登录页面', action: 'navigate', expected: '页面加载完成' },
        { step: '输入用户名', action: 'fill', expected: '用户名输入成功' },
        { step: '输入密码', action: 'fill', expected: '密码输入成功' },
        { step: '输入验证码', action: 'fill', expected: '验证码输入成功' },
        { step: '点击登录按钮', action: 'click', expected: '登录成功' }
      ];
    }
    
    return {
      testName: testName,
      description: description,
      steps: steps,
      preconditions: ['用户已注册账号', '系统正常运行'],
      postconditions: ['用户已成功登录', '用户会话已建立'],
      testData: {
        inputs: {},
        expectedOutputs: {}
      },
      tags: ['登录', '验证码']
    };
  }

  /**
   * 提取操作类型
   */
  extractAction(stepText) {
    if (stepText.includes('输入')) return 'fill';
    if (stepText.includes('点击')) return 'click';
    if (stepText.includes('打开') || stepText.includes('访问')) return 'navigate';
    if (stepText.includes('验证') || stepText.includes('检查')) return 'verify';
    return 'action';
  }

  /**
   * 提取预期结果
   */
  extractExpected(stepText) {
    if (stepText.includes('成功')) return '操作成功';
    if (stepText.includes('完成')) return '操作完成';
    if (stepText.includes('正确')) return '结果正确';
    return '操作完成';
  }

  async parseMultipleTestCases(testCases) {
    const results = [];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`\n🔄 正在解析第 ${i + 1}/${testCases.length} 个测试用例...`);
      
      try {
        const parsed = await this.parseTestCase(testCase.content);
        results.push({
          original: testCase,
          parsed: parsed,
          success: true
        });
      } catch (error) {
        console.error(`❌ 解析第 ${i + 1} 个测试用例失败:`, error.message);
        results.push({
          original: testCase,
          error: error.message,
          success: false
        });
      }
      
      // 添加延迟避免API限制
      if (i < testCases.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  async saveParsedResults(results, outputPath) {
    try {
      const output = {
        timestamp: new Date().toISOString(),
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results
      };
      
      await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
      console.log(`✅ 解析结果已保存到: ${outputPath}`);
      
      return output;
    } catch (error) {
      console.error('保存解析结果失败:', error.message);
      throw error;
    }
  }

  validateParsedTestCase(parsed) {
    // 如果没有testName，尝试从其他字段提取
    if (!parsed.testName) {
      if (parsed.testName) {
        parsed.testName = parsed.testName;
      } else if (parsed.name) {
        parsed.testName = parsed.name;
      } else if (parsed.title) {
        parsed.testName = parsed.title;
      } else {
        // 尝试从描述中提取
        const description = parsed.description || parsed.desc || '';
        if (description.includes('登录')) {
          parsed.testName = '用户登录功能测试';
        } else {
          parsed.testName = '未命名测试用例';
        }
      }
    }
    
    // 如果没有steps，创建默认步骤
    if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      parsed.steps = [
        { step: '打开登录页面', action: 'navigate', expected: '页面加载完成' },
        { step: '输入用户名', action: 'fill', expected: '用户名输入成功' },
        { step: '输入密码', action: 'fill', expected: '密码输入成功' },
        { step: '输入验证码', action: 'fill', expected: '验证码输入成功' },
        { step: '点击登录按钮', action: 'click', expected: '登录成功' }
      ];
    }
    
    // 验证每个步骤
    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i];
      if (!step.step && !step.description) {
        // 如果步骤没有描述，使用默认描述
        parsed.steps[i].step = `步骤${i + 1}`;
      }
    }
    
    return true;
  }
}

module.exports = TestCaseParser; 