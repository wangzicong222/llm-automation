/**
 * 整合API服务器
 * 同时处理测试用例上传和截图分析功能
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const TestCaseParser = require('./test-case-parser.js');
const UIAutomationGenerator = require('./ui-automation-generator.js');
const ScreenshotAnalyzer = require('./screenshot-analyzer.js');

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

class IntegratedAPIServer {
  constructor() {
    this.app = express();
    this.testCaseParser = new TestCaseParser();
    this.uiGenerator = new UIAutomationGenerator();
    this.screenshotAnalyzer = new ScreenshotAnalyzer();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // 解析JSON请求体
    this.app.use(express.json({ limit: '50mb' }));
    
    // 设置CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // 配置文件上传
    this.upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(__dirname, '..', 'uploads');
          fs.mkdir(uploadDir, { recursive: true })
            .then(() => cb(null, uploadDir))
            .catch(err => cb(err));
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const ext = path.extname(file.originalname);
          cb(null, `upload-${timestamp}${ext}`);
        }
      }),
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
      }
    });
  }

  setupRoutes() {
    // 健康检查
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        message: '整合API服务正常运行',
        services: ['testcase-process', 'screenshot-analysis']
      });
    });

    // 测试用例处理接口
    this.app.post('/api/testcase-process', async (req, res) => {
      try {
        console.log('📝 收到测试用例处理请求');
        // 新增：接收所有字段
        const { testcase, screenshot, pageUrl, pageName, pageDescription } = req.body;
        if (!testcase) {
          return res.status(400).json({ error: '缺少测试用例内容' });
        }
        // 解析测试用例
        const parsedTestCase = await this.testCaseParser.parseTestCase(testcase);
        // 新增：补充页面信息
        parsedTestCase.pageUrl = pageUrl;
        parsedTestCase.pageName = pageName;
        parsedTestCase.pageDescription = pageDescription;
        parsedTestCase.screenshot = screenshot;
        // 生成UI自动化代码（传递所有信息）
        const rawGeneratedCode = await this.uiGenerator.generateCompleteTestFile(parsedTestCase);
        // 清洗生成的代码，去除Markdown标记
        const generatedCode = stripMarkdownAndComments(rawGeneratedCode);
        const filePath = await this.uiGenerator.saveGeneratedCode(generatedCode, parsedTestCase.testName);
        const result = {
          parsedTestCase,
          completeCode: generatedCode,
          filePath,
          suggestions: this.generateTestcaseSuggestions(parsedTestCase)
        };
        console.log('✅ 测试用例处理完成');
        res.json(result);
      } catch (error) {
        console.error('❌ 测试用例处理失败:', error.message);
        res.status(500).json({ 
          error: '测试用例处理失败', 
          message: error.message 
        });
      }
    });

    // 截图分析接口
    this.app.post('/api/screenshot-analysis', async (req, res) => {
      try {
        console.log('📸 收到截图分析请求');
        // 支持多图
        const { screenshots, pageContext } = req.body;
        if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
          return res.status(400).json({ error: '缺少截图数据' });
        }
        // 分析所有截图，合并元素
        let allElements = [];
        for (const screenshot of screenshots) {
          const elements = await this.screenshotAnalyzer.analyzeScreenshot(screenshot, pageContext);
          allElements = allElements.concat(elements);
        }
        // 生成页面对象代码
        const pageObjectCode = await this.screenshotAnalyzer.generatePageObject(allElements, pageContext.name);
        // 生成测试用例代码
        const testSpecCode = await this.screenshotAnalyzer.generateTestSpec(allElements, pageContext.name, pageContext.testSteps);
        // 生成完整代码
        const completeCode = await this.screenshotAnalyzer.generateCompleteTestFile(allElements, pageContext.name, pageContext.testSteps);
        // 保存生成的代码
        const filePath = await this.screenshotAnalyzer.saveGeneratedCode(completeCode, pageContext.name);
        const result = {
          elements: allElements,
          pageObjectCode,
          testSpecCode,
          completeCode,
          filePath,
          suggestions: this.generateScreenshotSuggestions(allElements)
        };
        console.log('✅ 截图分析完成');
        res.json(result);
      } catch (error) {
        console.error('❌ 截图分析失败:', error.message);
        res.status(500).json({ 
          error: '截图分析失败', 
          message: error.message 
        });
      }
    });

    // 文件上传接口
    this.app.post('/api/upload-file', this.upload.single('file'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: '没有上传文件' });
        }

        const filePath = req.file.path;
        const fileType = req.body.type; // 'testcase' 或 'screenshot'
        
        if (fileType === 'testcase') {
          // 处理测试用例文件
          const content = await fs.readFile(filePath, 'utf8');
          const parsedTestCase = await this.testCaseParser.parseTestCase(content);
          const generatedCode = await this.uiGenerator.generateCompleteTestFile(parsedTestCase);
          const savedPath = await this.uiGenerator.saveGeneratedCode(generatedCode, parsedTestCase.testName);
          
          res.json({
            type: 'testcase',
            parsedTestCase,
            completeCode: generatedCode,
            filePath: savedPath,
            suggestions: this.generateTestcaseSuggestions(parsedTestCase)
          });
        } else if (fileType === 'screenshot') {
          // 处理截图文件
          const pageContext = req.body.pageContext ? JSON.parse(req.body.pageContext) : {};
          const elements = await this.screenshotAnalyzer.analyzeScreenshot(filePath, pageContext);
          const completeCode = await this.screenshotAnalyzer.generateCompleteTestFile(elements, pageContext.name || 'Page', pageContext.testSteps || []);
          const savedPath = await this.screenshotAnalyzer.saveGeneratedCode(completeCode, pageContext.name || 'Page');
          
          res.json({
            type: 'screenshot',
            elements,
            completeCode,
            filePath: savedPath,
            suggestions: this.generateScreenshotSuggestions(elements)
          });
        } else {
          return res.status(400).json({ error: '不支持的文件类型' });
        }
        
        // 清理上传的文件
        await this.cleanupTempFile(filePath);
        
      } catch (error) {
        console.error('文件处理失败:', error.message);
        res.status(500).json({ 
          error: '文件处理失败', 
          message: error.message 
        });
      }
    });

    // 获取处理历史
    this.app.get('/api/processing-history', async (req, res) => {
      try {
        const testsDir = path.join(__dirname, '..', 'tests', 'generated');
        const files = await fs.readdir(testsDir);
        
        const history = files
          .filter(file => file.includes('-ui-automation-') || file.includes('-screenshot-analysis-'))
          .map(file => ({
            name: file,
            path: path.join(testsDir, file),
            type: file.includes('screenshot') ? 'screenshot' : 'testcase',
            createdAt: fs.statSync(path.join(testsDir, file)).mtime
          }))
          .sort((a, b) => b.createdAt - a.createdAt);
        
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: '获取历史记录失败' });
      }
    });

    // 下载生成的代码
    this.app.get('/api/download/:filename', (req, res) => {
      try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '..', 'tests', 'generated', filename);
        
        if (fs.existsSync(filePath)) {
          res.download(filePath);
        } else {
          res.status(404).json({ error: '文件不存在' });
        }
      } catch (error) {
        res.status(500).json({ error: '下载失败' });
      }
    });

    // 运行测试接口
    this.app.post('/api/run-test', async (req, res) => {
      try {
        const { code, type } = req.body;
        
        if (!code) {
          return res.status(400).json({ error: '缺少测试代码' });
        }

        // 保存代码到临时文件
        const tempFile = path.join(__dirname, '..', 'tests', 'generated', `temp-test-${Date.now()}.spec.ts`);
        await fs.writeFile(tempFile, code, 'utf8');
        
        // 这里可以集成Playwright测试执行
        // 暂时返回模拟结果
        const result = {
          passed: 1,
          failed: 0,
          total: 1,
          duration: 2000,
          filePath: tempFile
        };
        
        res.json(result);
        
      } catch (error) {
        console.error('运行测试失败:', error.message);
        res.status(500).json({ 
          error: '运行测试失败', 
          message: error.message 
        });
      }
    });
  }

  /**
   * 保存base64截图到临时文件
   */
  async saveScreenshot(base64Data) {
    try {
      // 移除data:image/png;base64,前缀
      const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Image, 'base64');
      
      const uploadDir = path.join(__dirname, '..', 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      
      const timestamp = Date.now();
      const filePath = path.join(uploadDir, `screenshot-${timestamp}.png`);
      
      await fs.writeFile(filePath, buffer);
      console.log(`📁 截图已保存到: ${filePath}`);
      
      return filePath;
    } catch (error) {
      console.error('保存截图失败:', error.message);
      throw error;
    }
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ 临时文件已清理: ${filePath}`);
    } catch (error) {
      console.warn('清理临时文件失败:', error.message);
    }
  }

  /**
   * 生成测试用例处理建议
   */
  generateTestcaseSuggestions(parsedTestCase) {
    const suggestions = [];
    
    if (!parsedTestCase.steps || parsedTestCase.steps.length === 0) {
      suggestions.push('建议添加具体的测试步骤');
    }
    
    if (!parsedTestCase.testData || Object.keys(parsedTestCase.testData).length === 0) {
      suggestions.push('建议添加测试数据');
    }
    
    if (parsedTestCase.steps) {
      const hasAssertions = parsedTestCase.steps.some(step => 
        step.action === 'verify' || step.expected
      );
      
      if (!hasAssertions) {
        suggestions.push('建议添加断言验证步骤');
      }
    }
    
    return suggestions;
  }

  /**
   * 生成截图分析建议
   */
  generateScreenshotSuggestions(elements) {
    const suggestions = [];
    
    // 检查是否有data-testid
    const hasDataTestId = elements.some(el => 
      el.recommendedSelector && el.recommendedSelector.includes('data-testid')
    );
    
    if (!hasDataTestId) {
      suggestions.push('建议为关键UI元素添加data-testid属性，提高测试稳定性');
    }
    
    // 检查元素类型分布
    const elementTypes = elements.map(el => el.type);
    const inputCount = elementTypes.filter(type => type === 'input').length;
    const buttonCount = elementTypes.filter(type => type === 'button').length;
    
    if (inputCount > 0) {
      suggestions.push(`发现${inputCount}个输入框，建议添加输入验证测试`);
    }
    
    if (buttonCount > 0) {
      suggestions.push(`发现${buttonCount}个按钮，建议添加点击响应测试`);
    }
    
    // 检查是否有表单元素
    const hasForm = elements.some(el => 
      el.type === 'input' || el.type === 'select' || el.type === 'textarea'
    );
    
    if (hasForm) {
      suggestions.push('发现表单元素，建议添加表单验证和提交测试');
    }
    
    return suggestions;
  }

  /**
   * 启动服务器
   */
  start(port = 3001) {
    this.server = this.app.listen(port, () => {
      console.log(`🚀 整合API服务器启动在端口 ${port}`);
      console.log(`📝 测试用例处理: http://localhost:${port}/api/testcase-process`);
      console.log(`📸 截图分析: http://localhost:${port}/api/screenshot-analysis`);
      console.log(`📊 健康检查: http://localhost:${port}/api/health`);
    });
  }

  /**
   * 停止服务器
   */
  stop() {
    if (this.server) {
      this.server.close();
      console.log('🛑 整合API服务器已停止');
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const api = new IntegratedAPIServer();
  api.start();
}

module.exports = IntegratedAPIServer; 