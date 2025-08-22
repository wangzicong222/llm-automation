const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const DeepSeekClient = require('./deepseek-client');
require('dotenv').config();

class LLMTestExecutor {
  constructor() {
    this.deepseek = new DeepSeekClient();
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 2000;
  }

  async executeTest(testFile) {
    try {
      console.log(`🚀 开始执行测试: ${testFile}`);
      
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
      // 支持 headed/slowMo 通过环境变量或进程参数控制
      const headed = process.env.PW_HEADED === 'true' ? '--headed' : '';
      const slowMo = process.env.PW_SLOWMO ? `--project="chromium"` : '';
      // 生成JSON和HTML报告；若传 PW_HEADED=true 则可视化执行
      const command = `npx playwright test "${testFile}" --reporter=json,html ${headed}`.trim();
      
      console.log(`📋 执行命令: ${command}`);
      
      exec(command, { cwd: process.cwd(), env: { ...process.env } }, (error, stdout, stderr) => {
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
          
          // 新增：确保HTML报告已生成
          try {
            const fs = require('fs');
            const reportDir = path.join(process.cwd(), 'playwright-report');
            if (fs.existsSync(reportDir)) {
              console.log('📊 HTML报告目录已生成');
            } else {
              console.log('⚠️ HTML报告目录未生成，尝试手动生成');
              // 手动生成HTML报告
              exec('npx playwright show-report --host=0.0.0.0 --port=9323', {
                cwd: process.cwd(),
                timeout: 10000
              }, (reportError) => {
                if (reportError) {
                  console.log('⚠️ 手动生成HTML报告失败:', reportError.message);
                } else {
                  console.log('✅ 手动生成HTML报告成功');
                }
              });
            }
          } catch (reportError) {
            console.log('⚠️ 检查HTML报告状态失败:', reportError.message);
          }
          
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

module.exports = LLMTestExecutor; 