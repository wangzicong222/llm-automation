const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const LLMTestExecutor = require('./llm-executor.js');

const app = express();
const PORT = 3002;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 测试执行器实例
const testExecutor = new LLMTestExecutor();

// 获取可用的测试文件
app.get('/api/available-tests', async (req, res) => {
  try {
    const testsDir = path.join(__dirname, '../tests/generated');
    const files = await fs.readdir(testsDir);
    const testFiles = files.filter(file => file.endsWith('.spec.ts'));
    
    res.json({
      success: true,
      files: testFiles.map(file => `tests/generated/${file}`)
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
    const result = await testExecutor.executeTest(testFile);
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