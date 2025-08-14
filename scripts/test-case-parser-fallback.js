/**
 * 测试用例解析器 - 带错误处理版本
 * 
 * 当OpenAI API不可用时提供备用解析方案
 */

const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class TestCaseParserWithFallback {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.model = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 3000;
  }

  /**
   * 解析单个测试用例（带错误处理）
   */
  async parseTestCase(testCase) {
    try {
      console.log('🔍 正在使用OpenAI解析测试用例...');
      
      const prompt = `
请分析以下测试用例，提取所有需要UI自动化的操作步骤：

测试用例内容：
${testCase}

请以JSON格式返回解析结果，格式如下：
{
  "testName": "测试用例名称",
  "description": "测试用例描述",
  "preconditions": ["前置条件1", "前置条件2"],
  "steps": [
    {
      "stepNumber": 1,
      "description": "步骤描述",
      "action": "操作类型（click|fill|select|verify|wait|navigate）",
      "target": "目标元素描述",
      "selector": "建议的选择器",
      "value": "输入值（如果需要）",
      "expected": "预期结果",
      "waitTime": "等待时间（毫秒）"
    }
  ],
  "postconditions": ["后置条件1", "后置条件2"],
  "testData": {
    "inputs": ["需要的输入数据"],
    "expectedOutputs": ["期望的输出"]
  }
}

要求：
1. 准确识别每个UI操作步骤
2. 为每个步骤生成合适的选择器
3. 包含适当的等待时间
4. 识别验证点
5. 提取测试数据需求

请确保返回的是有效的JSON格式。
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的测试用例分析专家，擅长将自然语言描述的测试用例转换为结构化的UI自动化步骤。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.2,
      });

      const response = completion.choices[0].message.content;
      
      // 尝试解析JSON响应
      try {
        const parsed = JSON.parse(response);
        console.log('✅ OpenAI解析成功');
        return parsed;
      } catch (parseError) {
        console.log('⚠️  JSON解析失败，尝试清理响应...');
        // 尝试提取JSON部分
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('无法解析LLM响应为JSON格式');
      }
    } catch (error) {
      console.log('❌ OpenAI解析失败:', error.message);
      console.log('🔄 使用备用解析方案...');
      
      return this.fallbackParse(testCase);
    }
  }

  /**
   * 备用解析方案
   */
  fallbackParse(testCase) {
    console.log('📝 使用规则基础解析...');
    
    try {
      // 提取测试名称
      const testNameMatch = testCase.match(/\*\*测试名称：\*\*(.*?)(?:\n|$)/);
      const testName = testNameMatch ? testNameMatch[1].trim() : '未命名测试';
      
      // 提取测试描述
      const descriptionMatch = testCase.match(/\*\*测试描述：\*\*(.*?)(?:\n|$)/);
      const description = descriptionMatch ? descriptionMatch[1].trim() : '';
      
      // 提取前置条件
      const preconditionsMatch = testCase.match(/\*\*前置条件：\*\*([\s\S]*?)(?:\*\*|$)/);
      const preconditions = preconditionsMatch ? 
        preconditionsMatch[1].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim().substring(1).trim()) : [];
      
      // 提取测试步骤
      const stepsMatch = testCase.match(/\*\*测试步骤：\*\*([\s\S]*?)(?:\*\*|$)/);
      const steps = [];
      
      if (stepsMatch) {
        const stepsText = stepsMatch[1];
        const stepLines = stepsText.split('\n').filter(line => line.trim().match(/^\d+\./));
        
        stepLines.forEach((line, index) => {
          const stepText = line.replace(/^\d+\.\s*/, '').trim();
          
          // 简单的步骤类型识别
          let action = 'click';
          let target = stepText;
          let selector = 'button, input, a';
          
          if (stepText.includes('输入')) {
            action = 'fill';
            selector = 'input[type="text"], input[type="password"], textarea';
          } else if (stepText.includes('选择') || stepText.includes('下拉')) {
            action = 'select';
            selector = 'select, option';
          } else if (stepText.includes('验证') || stepText.includes('检查')) {
            action = 'verify';
            selector = '*';
          } else if (stepText.includes('等待')) {
            action = 'wait';
            selector = '*';
          } else if (stepText.includes('打开') || stepText.includes('访问')) {
            action = 'navigate';
            selector = '*';
          }
          
          steps.push({
            stepNumber: index + 1,
            description: stepText,
            action: action,
            target: target,
            selector: selector,
            value: '',
            expected: '',
            waitTime: action === 'wait' ? 3000 : 1000
          });
        });
      }
      
      // 提取后置条件
      const postconditionsMatch = testCase.match(/\*\*后置条件：\*\*([\s\S]*?)(?:\*\*|$)/);
      const postconditions = postconditionsMatch ? 
        postconditionsMatch[1].split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim().substring(1).trim()) : [];
      
      // 提取测试数据
      const testDataMatch = testCase.match(/\*\*测试数据：\*\*([\s\S]*?)(?:\*\*|$)/);
      const testData = {
        inputs: [],
        expectedOutputs: []
      };
      
      if (testDataMatch) {
        const dataText = testDataMatch[1];
        const dataLines = dataText.split('\n').filter(line => line.trim().includes(':'));
        
        dataLines.forEach(line => {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            testData.inputs.push(`${key}: ${value}`);
          }
        });
      }
      
      // 提取期望结果
      const expectedMatch = testCase.match(/\*\*期望结果：\*\*([\s\S]*?)(?:\*\*|$)/);
      if (expectedMatch) {
        const expectedText = expectedMatch[1];
        const expectedLines = expectedText.split('\n').filter(line => line.trim().startsWith('-'));
        testData.expectedOutputs = expectedLines.map(line => line.trim().substring(1).trim());
      }
      
      const result = {
        testName,
        description,
        preconditions,
        steps,
        postconditions,
        testData
      };
      
      console.log('✅ 备用解析完成');
      console.log(`- 测试名称: ${testName}`);
      console.log(`- 步骤数量: ${steps.length}`);
      console.log(`- 前置条件: ${preconditions.length}`);
      console.log(`- 后置条件: ${postconditions.length}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ 备用解析也失败了:', error.message);
      
      // 返回最基本的解析结果
      return {
        testName: '测试用例',
        description: '自动解析的测试用例',
        preconditions: [],
        steps: [
          {
            stepNumber: 1,
            description: '打开页面',
            action: 'navigate',
            target: '页面',
            selector: '*',
            value: '',
            expected: '页面加载完成',
            waitTime: 3000
          }
        ],
        postconditions: [],
        testData: {
          inputs: [],
          expectedOutputs: []
        }
      };
    }
  }

  /**
   * 批量解析测试用例（带错误处理）
   */
  async parseTestCases(testCases) {
    console.log(`🔄 开始批量解析 ${testCases.length} 个测试用例...`);
    
    const results = [];
    for (let i = 0; i < testCases.length; i++) {
      try {
        console.log(`📝 解析第 ${i + 1}/${testCases.length} 个测试用例...`);
        const parsed = await this.parseTestCase(testCases[i]);
        results.push({
          original: testCases[i],
          parsed: parsed,
          index: i,
          method: parsed.testName !== '测试用例' ? 'openai' : 'fallback'
        });
      } catch (error) {
        console.error(`❌ 解析第 ${i + 1} 个测试用例失败:`, error.message);
        results.push({
          original: testCases[i],
          parsed: null,
          error: error.message,
          index: i
        });
      }
    }
    
    const successCount = results.filter(r => r.parsed).length;
    const openaiCount = results.filter(r => r.method === 'openai').length;
    const fallbackCount = results.filter(r => r.method === 'fallback').length;
    
    console.log(`✅ 批量解析完成，成功解析 ${successCount}/${testCases.length} 个测试用例`);
    console.log(`- OpenAI解析: ${openaiCount} 个`);
    console.log(`- 备用解析: ${fallbackCount} 个`);
    
    return results;
  }

  /**
   * 验证解析结果
   */
  validateParsedTestCase(parsed) {
    if (!parsed.testName) {
      throw new Error('缺少测试用例名称');
    }
    
    if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('缺少测试步骤');
    }
    
    // 验证每个步骤
    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i];
      if (!step.description || !step.action) {
        throw new Error(`步骤 ${i + 1} 缺少必要信息`);
      }
    }
    
    return true;
  }
}

module.exports = TestCaseParserWithFallback; 