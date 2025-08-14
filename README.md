# LLM Automation Project

基于 Playwright + LLM 的 Web UI 自动化测试项目

## 项目架构

```
llm-automation/
├── frontend/          # Vue 3 前端应用
├── tests/            # Playwright 测试文件
├── scripts/          # LLM 相关脚本
├── config/           # 配置文件
└── docs/             # 文档
```

## 功能特性

- 🎯 **智能测试生成**: 使用 LLM 自动生成测试用例
- 🤖 **自动化执行**: Playwright 驱动的 UI 自动化
- 🎨 **现代化 UI**: Vue 3 + Vite 构建的前端应用
- 📊 **测试报告**: 详细的测试结果和覆盖率报告
- 🔧 **灵活配置**: 支持多种环境和配置
- 📝 **测试用例转UI自动化**: 将自然语言测试用例自动转换为UI自动化代码
- 🧪 **测试执行与报告**: 完整的测试执行流程和报告系统
- 📸 **截图分析**: AI驱动的UI截图分析和测试生成

## 🆕 新功能

### 1. 测试用例转UI自动化

#### 功能概述
- **智能解析**: 使用LLM解析自然语言描述的测试用例
- **自动生成**: 生成高质量的Playwright TypeScript代码
- **智能执行**: 自动执行生成的测试并提供详细报告
- **多种输入**: 支持文件上传、手动输入、批量输入

#### 快速开始

##### Web界面操作
1. 启动项目：`npm run dev`
2. 访问：`http://localhost:5173/testcase-upload`
3. 选择输入方式（文件上传/手动输入/批量输入）
4. 配置处理选项
5. 点击"开始处理"

##### 命令行操作
```bash
# 处理单个测试用例
npm run testcase:process -- --testcase="用户登录功能测试"

# 处理文件中的测试用例
npm run testcase:process -- --file="examples/sample-test-cases.md"

# 测试功能
npm run testcase:test
```

### 2. 测试执行与报告系统

#### 功能概述
- **测试执行控制**: 执行单个或批量测试
- **实时进度监控**: 查看测试执行进度
- **详细结果分析**: 查看每个测试的执行结果
- **测试报告生成**: 生成完整的测试报告
- **改进建议**: 基于测试结果提供优化建议

#### 快速开始

##### Web界面操作
1. 启动所有服务：`npm run start:all`
2. 访问：`http://localhost:5173`
3. 登录系统
4. 进入"智能测试生成器"
5. 上传截图并分析
6. 在第3步后点击"执行测试"
7. 查看测试报告和结果

##### 独立使用
1. 启动测试执行API：`npm run test:execution`
2. 访问：`http://localhost:5173/test-execution`
3. 选择测试文件并执行
4. 查看详细结果和报告

### 测试用例格式
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

## 快速开始

### 方法一：一键启动所有服务
```bash
npm install
npm run install-browsers
npm run start:all
```

### 方法二：分步启动

#### 1. 安装依赖
```bash
npm install
npm run install-browsers
```

#### 2. 配置环境变量
复制 `env.example` 到 `.env` 并配置你的 DeepSeek API 密钥：

```bash
cp env.example .env
```

编辑 `.env` 文件，设置你的 DeepSeek API 密钥：

```bash
# DeepSeek API 配置
DEEPSEEK_API_KEY=your_actual_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_MAX_TOKENS=2000
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

#### 3. 启动服务
```bash
# 启动前端开发服务器
npm run dev

# 启动集成API服务器
npm run integrated:api

# 启动测试执行API服务器
npm run test:execution
```

#### 4. 运行测试
```bash
# 运行所有测试
npm run test

# 使用 UI 模式运行测试
npm run test:ui

# 生成测试用例
npm run llm:generate

# 执行 LLM 生成的测试
npm run llm:execute

# 测试用例转UI自动化
npm run testcase:process

# 测试新功能
npm run testcase:test
```

## 项目结构说明

### Frontend (Vue 3)
- 使用 Vue 3 Composition API
- Vite 作为构建工具
- Pinia 状态管理
- Vue Router 路由管理

### Playwright 测试
- 支持多浏览器测试
- 页面对象模式 (POM)
- 自定义测试工具和助手
- 并行测试执行

### LLM 集成
- OpenAI GPT 集成
- 智能测试用例生成
- 自然语言测试描述
- 自动化测试执行

### 测试用例转UI自动化
- 测试用例解析器
- UI自动化生成器
- 智能执行器
- 详细报告生成

## 开发指南

### 添加新的测试页面

1. 在 `frontend/src/views/` 创建新的 Vue 组件
2. 在 `tests/pages/` 创建对应的页面对象
3. 在 `tests/specs/` 编写测试用例

### 使用 LLM 生成测试

```bash
# 生成特定功能的测试
npm run llm:generate -- --feature="用户登录"

# 执行生成的测试
npm run llm:execute -- --test="login-test"
```

### 使用测试用例转UI自动化

```bash
# 处理单个测试用例
npm run testcase:process -- --testcase="用户登录功能测试"

# 处理文件中的测试用例
npm run testcase:process -- --file="examples/sample-test-cases.md"

# 测试功能
npm run testcase:test
```

## 配置说明

### Playwright 配置
- 支持 Chrome、Firefox、Safari
- 可配置的视口大小和用户代理
- 截图和视频录制
- 并行执行配置

### LLM 配置
- OpenAI API 配置
- 提示词模板
- 测试生成策略
- 错误处理和重试机制

### 测试用例转UI自动化配置
- 测试用例解析配置
- UI自动化生成配置
- 执行配置
- 报告配置

## 最佳实践

### 1. 测试开发
- 使用页面对象模式
- 使用 data-testid 选择器
- 编写可读性强的测试用例
- 包含适当的断言

### 2. LLM 使用
- 提供清晰的功能描述
- 使用合适的提示词模板
- 检查生成的代码质量
- 根据反馈优化提示词

### 3. 测试用例编写
- 使用清晰、简洁的语言描述测试步骤
- 包含具体的输入数据和期望结果
- 明确前置条件和后置条件
- 使用标准的测试术语

### 4. 代码组织
- 遵循单一职责原则
- 使用 TypeScript 类型
- 保持代码简洁
- 添加适当的注释

## 扩展性

### 1. 添加新页面
1. 在 `frontend/src/views/` 创建 Vue 组件
2. 在 `frontend/src/router/` 添加路由
3. 在 `tests/pages/` 创建页面对象
4. 在 `tests/specs/` 编写测试用例

### 2. 集成新的 LLM 模型
1. 修改 `scripts/llm-generator.js`
2. 更新提示词模板
3. 调整模型参数
4. 测试生成效果

### 3. 添加新的测试类型
1. 扩展 BasePage 类
2. 创建专门的页面对象
3. 编写测试用例
4. 更新 LLM 生成器

### 4. 自定义测试用例解析
1. 扩展 TestCaseParser 类
2. 添加新的解析格式
3. 优化解析逻辑
4. 测试解析效果

## 性能优化

### 1. 测试执行
- 并行测试执行
- 浏览器复用
- 智能等待策略
- 资源清理

### 2. LLM 调用
- 批量处理
- 缓存机制
- 错误重试
- 成本控制

### 3. 前端性能
- 代码分割
- 懒加载
- 缓存策略
- 资源优化

## 监控和报告

### 1. 测试报告
- HTML 报告
- JSON 报告
- JUnit 报告
- 自定义报告

### 2. LLM 分析
- 测试结果分析
- 代码质量评估
- 改进建议
- 性能指标

### 3. 错误处理
- 详细错误信息
- 截图记录
- 视频录制
- 日志记录

## 安全考虑

### 1. API 密钥管理
- 环境变量存储
- 密钥轮换
- 访问控制
- 监控使用

### 2. 测试数据
- 数据隔离
- 清理机制
- 隐私保护
- 安全存储

### 3. 代码安全
- 输入验证
- 输出编码
- 依赖检查
- 安全审计

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License 