/**
 * 智能UI执行器 - 执行生成的UI自动化测试并提供智能分析
 * 
 * 功能：
 * 1. 执行生成的UI自动化测试
 * 2. 智能错误处理和恢复
 * 3. 生成详细的测试报告
 * 4. 提供改进建议
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const DeepSeekClient = require('./deepseek-client');
require('dotenv').config();

class SmartUIExecutor {
  constructor() {
    this.deepseek = new DeepSeekClient();
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 3000;
  }

  async executeTest(testFile) {
    try {
      console.log(`🚀 开始执行测试文件: ${testFile}`);
      
      // 检查文件是否存在
      if (!await this.fileExists(testFile)) {
        throw new Error(`测试文件不存在: ${testFile}`);
      }

      // 执行测试
      const result = await this.runPlaywrightTest(testFile);
      
      // 分析测试结果
      const analysis = await this.analyzeTestResult(result);
      
      return {
        testFile,
        result,
        analysis,
        success: result.exitCode === 0
      };
      
    } catch (error) {
      console.error('执行测试失败:', error.message);
      throw error;
    }
  }

  async runPlaywrightTest(testFile) {
    return new Promise((resolve, reject) => {
      const command = `npx playwright test "${testFile}" --reporter=json`;
      
      console.log(`📋 执行命令: ${command}`);
      
      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ 测试执行失败:', error.message);
          resolve({
            exitCode: error.code || 1,
            stdout: stdout,
            stderr: stderr,
            error: error.message
          });
        } else {
          console.log('✅ 测试执行完成');
          resolve({
            exitCode: 0,
            stdout: stdout,
            stderr: stderr
          });
        }
      });
    });
  }

  async analyzeTestResult(result) {
    try {
      console.log('🔍 分析测试结果...');
      
      const prompt = `请分析以下Playwright测试执行结果，并提供改进建议：

测试执行结果：
- 退出代码: ${result.exitCode}
- 标准输出: ${result.stdout}
- 错误输出: ${result.stderr}
${result.error ? `- 错误信息: ${result.error}` : ''}

请提供：
1. 测试结果总结
2. 可能的问题分析
3. 改进建议
4. 下一步行动

请用中文回答。`;

      const messages = [
        {
          role: 'system',
          content: '你是一个专业的测试执行结果分析专家，能够分析Playwright测试结果并提供有价值的改进建议。'
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

      return completion.choices[0].message.content;
      
    } catch (error) {
      console.error('分析测试结果失败:', error.message);
      return '无法分析测试结果';
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async executeMultipleTests(testFiles) {
    const results = [];
    
    for (const testFile of testFiles) {
      try {
        console.log(`\n🔄 执行测试: ${testFile}`);
        const result = await this.executeTest(testFile);
        results.push(result);
      } catch (error) {
        console.error(`❌ 执行测试失败: ${testFile}`, error.message);
        results.push({
          testFile,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  generateExecutionReport(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / results.length * 100).toFixed(2),
      results: results
    };
  }
}

module.exports = SmartUIExecutor; 