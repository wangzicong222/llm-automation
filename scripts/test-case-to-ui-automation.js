/**
 * 测试用例转UI自动化主控制器
 * 
 * 功能：
 * 1. 整合测试用例解析器、UI自动化生成器和智能执行器
 * 2. 提供完整的端到端流程
 * 3. 支持批量处理和单个处理
 * 4. 生成详细的执行报告
 */

const TestCaseParser = require('./test-case-parser');
const UIAutomationGenerator = require('./ui-automation-generator');
const SmartUIExecutor = require('./smart-ui-executor');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

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

class TestCaseToUIAutomation {
  constructor() {
    this.parser = new TestCaseParser();
    this.generator = new UIAutomationGenerator();
    this.executor = new SmartUIExecutor();
  }

  /**
   * 完整的端到端流程：测试用例 → UI自动化 → 执行
   */
  async processTestCase(testCase, options = {}) {
    try {
      console.log('🚀 开始处理测试用例...');
      
      const defaultOptions = {
        generateCode: true,
        executeTest: true,
        saveReport: true,
        retryOnFailure: true
      };
      
      const config = { ...defaultOptions, ...options };
      
      // 步骤1: 解析测试用例
      console.log('📝 步骤1: 解析测试用例');
      const parsedTestCase = await this.parser.parseTestCase(testCase);
      
      // 验证解析结果
      this.parser.validateParsedTestCase(parsedTestCase);
      
      // 步骤2: 生成UI自动化代码
      let generatedCode = null;
      let testFilePath = null;
      
      if (config.generateCode) {
        console.log('🤖 步骤2: 生成UI自动化代码');
        generatedCode = await this.generator.generateCompleteTestFile(parsedTestCase);
        // 新增：清洗生成的代码
        generatedCode = stripMarkdownAndComments(generatedCode);
        // 保存生成的代码
        testFilePath = await this.generator.saveGeneratedCode(
          generatedCode, 
          parsedTestCase.testName
        );
      }
      
      // 步骤3: 执行UI自动化测试
      let executionResult = null;
      
      if (config.executeTest && testFilePath) {
        console.log('🚀 步骤3: 执行UI自动化测试');
        executionResult = await this.executor.executeTest(testFilePath);
        
        // 如果失败且启用重试
        if (!executionResult.success && config.retryOnFailure) {
          console.log('🔄 测试失败，尝试重新执行...');
          executionResult = await this.executor.executeTest(testFilePath);
        }
      }
      
      // 生成完整报告
      const report = await this.generateCompleteReport({
        originalTestCase: testCase,
        parsedTestCase,
        generatedCode,
        testFilePath,
        executionResult,
        config
      });
      
      return {
        success: true,
        parsedTestCase,
        generatedCode,
        testFilePath,
        executionResult,
        report
      };
      
    } catch (error) {
      console.error('❌ 处理测试用例失败:', error.message);
      
      const errorReport = await this.generateErrorReport(testCase, error);
      
      return {
        success: false,
        error: error.message,
        report: errorReport
      };
    }
  }

  /**
   * 批量处理测试用例
   */
  async processBatchTestCases(testCases, options = {}) {
    console.log(`🔄 开始批量处理 ${testCases.length} 个测试用例...`);
    
    const results = [];
    const startTime = Date.now();
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      try {
        console.log(`📝 处理第 ${i + 1}/${testCases.length} 个测试用例...`);
        
        const result = await this.processTestCase(testCase, options);
        results.push({
          ...result,
          index: i,
          originalTestCase: testCase
        });
        
        // 添加延迟避免API限制
        if (i < testCases.length - 1) {
          await this.delay(3000);
        }
      } catch (error) {
        console.error(`❌ 处理第 ${i + 1} 个测试用例失败:`, error.message);
        results.push({
          success: false,
          error: error.message,
          index: i,
          originalTestCase: testCase
        });
      }
    }
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    
    console.log(`✅ 批量处理完成，总耗时: ${totalTime}秒`);
    
    // 生成批量处理报告
    const batchReport = await this.generateBatchReport(results, totalTime);
    
    return {
      results,
      batchReport,
      totalTime,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    };
  }

  /**
   * 从文件处理测试用例
   */
  async processTestCasesFromFile(filePath, options = {}) {
    try {
      console.log(`📁 从文件读取测试用例: ${filePath}`);
      
      const parsedResults = await this.parser.parseTestCasesFromFile(filePath);
      const successfulResults = parsedResults.filter(r => r.parsed);
      
      if (successfulResults.length === 0) {
        throw new Error('没有成功解析的测试用例');
      }
      
      console.log(`✅ 成功解析 ${successfulResults.length} 个测试用例`);
      
      // 处理成功解析的测试用例
      const testCases = successfulResults.map(r => r.original);
      return await this.processBatchTestCases(testCases, options);
      
    } catch (error) {
      console.error('❌ 从文件处理测试用例失败:', error.message);
      throw error;
    }
  }

  /**
   * 生成完整报告
   */
  async generateCompleteReport(data) {
    const {
      originalTestCase,
      parsedTestCase,
      generatedCode,
      testFilePath,
      executionResult,
      config
    } = data;
    
    const timestamp = new Date().toLocaleString();
    
    const report = `
# 测试用例转UI自动化完整报告

## 基本信息
- **处理时间**: ${timestamp}
- **测试用例名称**: ${parsedTestCase.testName}
- **代码生成**: ${config.generateCode ? '✅ 是' : '❌ 否'}
- **测试执行**: ${config.executeTest ? '✅ 是' : '❌ 否'}
- **执行结果**: ${executionResult?.success ? '✅ 成功' : '❌ 失败'}

## 原始测试用例
\`\`\`
${originalTestCase}
\`\`\`

## 解析结果
- **测试名称**: ${parsedTestCase.testName}
- **描述**: ${parsedTestCase.description}
- **步骤数量**: ${parsedTestCase.steps.length}
- **前置条件**: ${parsedTestCase.preconditions?.length || 0} 个
- **后置条件**: ${parsedTestCase.postconditions?.length || 0} 个

## 测试步骤详情
${parsedTestCase.steps.map((step, index) => `
### 步骤 ${index + 1}
- **描述**: ${step.description}
- **操作**: ${step.action}
- **目标**: ${step.target}
- **选择器**: ${step.selector}
- **期望结果**: ${step.expected}
`).join('\n')}

## 生成的代码文件
${testFilePath ? `- **文件路径**: ${testFilePath}` : '- 未生成代码文件'}

## 执行结果
${executionResult ? `
- **执行成功**: ${executionResult.success ? '是' : '否'}
- **退出代码**: ${executionResult.result?.exitCode}
- **执行时间**: ${executionResult.timestamp}

### 执行输出
\`\`\`
${executionResult.result?.stdout || '无输出'}
\`\`\`

### 错误信息
\`\`\`
${executionResult.result?.stderr || '无错误'}
\`\`\`

### 智能分析
${executionResult.analysis || '无分析结果'}
` : '- 未执行测试'}

## 建议和改进
1. 检查生成的代码质量
2. 优化元素选择器
3. 改进等待策略
4. 增加错误处理
5. 优化测试数据

---
*报告生成时间: ${timestamp}*
    `;
    
    // 保存报告
    if (config.saveReport) {
      const reportFileName = `complete-report-${parsedTestCase.testName.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.md`;
      const reportPath = path.join(process.cwd(), 'test-results', 'reports', reportFileName);
      
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, report, 'utf8');
      
      console.log(`📄 完整报告已保存到: ${reportPath}`);
    }
    
    return report;
  }

  /**
   * 生成错误报告
   */
  async generateErrorReport(testCase, error) {
    const timestamp = new Date().toLocaleString();
    
    const report = `
# 测试用例处理错误报告

## 错误信息
- **错误时间**: ${timestamp}
- **错误类型**: ${error.name}
- **错误消息**: ${error.message}

## 原始测试用例
\`\`\`
${testCase}
\`\`\`

## 错误堆栈
\`\`\`
${error.stack}
\`\`\`

## 建议的解决方案
1. 检查测试用例格式是否正确
2. 验证API密钥配置
3. 检查网络连接
4. 查看详细错误日志
5. 联系技术支持

---
*报告生成时间: ${timestamp}*
    `;
    
    return report;
  }

  /**
   * 生成批量处理报告
   */
  async generateBatchReport(results, totalTime) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const report = `
# 批量测试用例处理报告

## 处理概览
- **总测试用例数**: ${results.length}
- **成功处理数**: ${successful.length}
- **失败处理数**: ${failed.length}
- **成功率**: ${(successful.length / results.length * 100).toFixed(2)}%
- **总耗时**: ${totalTime}秒
- **平均耗时**: ${(totalTime / results.length).toFixed(2)}秒

## 成功处理的测试用例
${successful.map(r => `- ✅ ${r.parsedTestCase.testName} (${r.testFilePath})`).join('\n')}

## 失败的测试用例
${failed.map(r => `- ❌ 测试用例 ${r.index + 1} (${r.error})`).join('\n')}

## 性能统计
- 平均处理时间: ${(totalTime / results.length).toFixed(2)}秒
- 最快处理: ${Math.min(...results.map(r => r.totalTime || 0)).toFixed(2)}秒
- 最慢处理: ${Math.max(...results.map(r => r.totalTime || 0)).toFixed(2)}秒

## 改进建议
1. 优化失败测试用例的格式
2. 改进错误处理机制
3. 增加重试逻辑
4. 优化API调用频率
5. 改进代码生成质量

---
*报告生成时间: ${new Date().toLocaleString()}*
    `;
    
    return report;
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TestCaseToUIAutomation; 