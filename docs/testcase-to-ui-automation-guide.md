# 测试用例转UI自动化使用指南

## 概述

本系统提供了完整的测试用例转UI自动化解决方案，支持将自然语言描述的测试用例自动转换为Playwright UI自动化代码并执行测试。

## 功能特性

- ✅ **多种输入方式**：支持文件上传、手动输入、批量输入
- ✅ **智能解析**：使用LLM解析测试用例，提取UI操作步骤
- ✅ **自动生成代码**：生成高质量的Playwright TypeScript代码
- ✅ **智能执行**：自动执行生成的测试并提供详细报告
- ✅ **错误恢复**：智能错误处理和重试机制
- ✅ **详细报告**：生成完整的测试执行报告和分析

## 快速开始

### 1. 环境准备

确保已安装项目依赖：

```bash
npm install
npm run install-browsers
```

### 2. 配置环境变量

复制并配置环境变量：

```bash
cp .env.example .env
```

在 `.env` 文件中配置：

```bash
# OpenAI API 配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=4000

# 应用配置
VITE_APP_TITLE=LLM Automation Demo
TEST_BASE_URL=http://localhost:5173
```

### 3. 启动前端应用

```bash
npm run dev
```

访问 `http://localhost:5173/testcase-upload` 进入测试用例上传页面。

## 使用方法

### 方式一：Web界面操作

1. **打开测试用例上传页面**
   - 访问 `http://localhost:5173/testcase-upload`

2. **选择输入方式**
   - **文件上传**：上传TXT、Markdown、JSON格式的测试用例文件
   - **手动输入**：直接在文本框中输入测试用例
   - **批量输入**：输入多个测试用例，用分隔符分开

3. **配置处理选项**
   - ✅ 生成UI自动化代码
   - ✅ 执行生成的测试
   - ✅ 保存详细报告
   - ✅ 失败时自动重试

4. **开始处理**
   - 点击"开始处理"按钮
   - 系统将自动解析、生成代码并执行测试

5. **查看结果**
   - 在结果区域查看处理状态
   - 查看生成的测试文件路径
   - 查看执行结果和详细报告

### 方式二：命令行操作

#### 处理单个测试用例

```bash
# 使用示例测试用例
npm run testcase:process -- --testcase="用户登录功能测试"
```

#### 处理文件中的测试用例

```bash
# 处理文件中的测试用例
npm run testcase:process -- --file="examples/sample-test-cases.md"
```

#### 批量处理测试用例

```bash
# 批量处理多个测试用例
npm run testcase:process -- --batch --file="examples/sample-test-cases.md"
```

## 测试用例格式

### 基本格式

测试用例应包含以下信息：

```markdown
**测试名称：** 用户登录功能测试
**测试描述：** 验证用户能够成功登录系统

**前置条件：**
- 用户已注册账号
- 系统正常运行

**测试步骤：**
1. 打开登录页面
2. 在用户名输入框中输入有效的用户名
3. 在密码输入框中输入对应的密码
4. 点击登录按钮
5. 验证成功跳转到用户主页

**后置条件：**
- 用户已成功登录
- 用户会话已建立

**测试数据：**
- 用户名：testuser@example.com
- 密码：TestPassword123

**期望结果：**
- 登录成功
- 页面跳转到用户主页
```

### 批量格式

多个测试用例可以用以下分隔符分开：

```markdown
## 测试用例1：用户登录功能
[测试用例1内容]

---

## 测试用例2：用户注册功能
[测试用例2内容]

===

## 测试用例3：商品搜索功能
[测试用例3内容]
```

## 生成的代码结构

系统会生成以下文件：

```
tests/generated/
├── user-login-function-test-2024-01-15T10-30-00-000Z.spec.ts
├── user-register-function-test-2024-01-15T10-35-00-000Z.spec.ts
└── product-search-function-test-2024-01-15T10-40-00-000Z.spec.ts
```

生成的代码包含：

- **页面对象**：封装页面元素和操作方法
- **测试用例**：完整的测试执行逻辑
- **测试数据**：测试所需的输入数据
- **断言验证**：结果验证逻辑

## 配置选项

### 处理配置

```javascript
{
  generateCode: true,        // 是否生成UI自动化代码
  executeTest: true,         // 是否执行生成的测试
  saveReport: true,          // 是否保存详细报告
  retryOnFailure: true       // 失败时是否自动重试
}
```

### 执行配置

```javascript
{
  headed: false,             // 是否使用有头模式
  debug: false,              // 是否启用调试模式
  retryCount: 2,             // 重试次数
  timeout: 30000,            // 超时时间（毫秒）
  screenshotOnFailure: true, // 失败时是否截图
  videoOnFailure: true       // 失败时是否录制视频
}
```

## 报告和输出

### 生成的报告

系统会生成以下报告：

1. **完整处理报告**：包含解析、生成、执行的完整信息
2. **执行结果报告**：测试执行的具体结果和错误信息
3. **智能分析报告**：LLM对测试结果的分析和改进建议
4. **批量处理报告**：批量处理的汇总统计

### 报告位置

```
test-results/
├── reports/
│   ├── complete-report-user-login-2024-01-15T10-30-00-000Z.md
│   ├── test-report-user-login-2024-01-15T10-30-00-000Z.md
│   └── batch-report-2024-01-15T10-30-00-000Z.md
└── screenshots/
    ├── user-login-function-test-elements-2024-01-15T10-30-00-000Z.png
    └── user-login-function-test-workflow-2024-01-15T10-30-00-000Z.png
```

## 故障排除

### 常见问题

#### 1. API密钥配置错误

**症状**：提示"OpenAI API密钥无效"
**解决方案**：
- 检查 `.env` 文件中的 `OPENAI_API_KEY` 配置
- 确保API密钥有效且有足够额度

#### 2. 测试用例解析失败

**症状**：提示"无法解析测试用例"
**解决方案**：
- 检查测试用例格式是否符合要求
- 确保测试用例包含必要的步骤信息
- 尝试简化测试用例内容

#### 3. 生成的代码执行失败

**症状**：测试执行时出现元素定位错误
**解决方案**：
- 检查目标网站是否正常运行
- 验证元素选择器是否正确
- 调整等待时间和重试策略

#### 4. 网络连接问题

**症状**：API调用超时或失败
**解决方案**：
- 检查网络连接
- 验证防火墙设置
- 尝试使用代理或VPN

### 调试技巧

1. **启用调试模式**：
   ```bash
   npm run testcase:process -- --debug
   ```

2. **查看详细日志**：
   ```bash
   npm run testcase:process -- --verbose
   ```

3. **使用有头模式**：
   ```bash
   npm run testcase:process -- --headed
   ```

## 最佳实践

### 1. 测试用例编写

- 使用清晰、简洁的语言描述测试步骤
- 包含具体的输入数据和期望结果
- 明确前置条件和后置条件
- 使用标准的测试术语

### 2. 元素定位

- 优先使用稳定的选择器（如data-testid）
- 避免使用可能变化的文本内容
- 考虑页面加载时间和动态内容

### 3. 错误处理

- 添加适当的等待时间
- 使用智能重试机制
- 记录详细的错误信息

### 4. 性能优化

- 批量处理时添加延迟避免API限制
- 合理设置超时时间
- 定期清理旧的测试结果

## API接口

### 处理测试用例

```http
POST /api/testcase/process
Content-Type: application/json

{
  "testCases": ["测试用例内容"],
  "config": {
    "generateCode": true,
    "executeTest": true,
    "saveReport": true,
    "retryOnFailure": true
  }
}
```

### 响应格式

```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "parsedTestCase": { ... },
      "generatedCode": "...",
      "testFilePath": "tests/generated/...",
      "executionResult": { ... },
      "report": "..."
    }
  ],
  "batchReport": "...",
  "totalTime": 45.2,
  "successCount": 3,
  "failureCount": 0
}
```

## 扩展和定制

### 自定义解析器

可以扩展 `TestCaseParser` 类来支持更多格式：

```javascript
class CustomTestCaseParser extends TestCaseParser {
  async parseCustomFormat(content) {
    // 自定义解析逻辑
  }
}
```

### 自定义生成器

可以扩展 `UIAutomationGenerator` 类来生成不同框架的代码：

```javascript
class CustomUIGenerator extends UIAutomationGenerator {
  async generateSeleniumCode(parsedTestCase) {
    // 生成Selenium代码
  }
}
```

### 自定义执行器

可以扩展 `SmartUIExecutor` 类来支持其他测试框架：

```javascript
class CustomExecutor extends SmartUIExecutor {
  async executeSeleniumTest(testFile) {
    // 执行Selenium测试
  }
}
```

## 更新日志

### v1.0.0 (2024-01-15)
- ✅ 初始版本发布
- ✅ 支持测试用例解析和UI自动化生成
- ✅ 支持Web界面和命令行操作
- ✅ 支持批量处理和智能执行
- ✅ 支持详细报告生成

## 技术支持

如有问题或建议，请：

1. 查看本文档的故障排除部分
2. 检查项目的GitHub Issues
3. 联系开发团队

---

*最后更新：2024-01-15* 