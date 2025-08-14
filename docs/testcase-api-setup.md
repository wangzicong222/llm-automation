# 测试用例API设置说明

## 问题解决

您遇到的404错误是因为前端页面在尝试调用后端API时找不到对应的接口。我们已经创建了完整的后端API服务来解决这个问题。

## 解决方案

### 方法一：一键启动（推荐）

使用我们提供的启动脚本，同时启动前端应用和API服务器：

```bash
npm run testcase:start
```

这个命令会：
1. 启动测试用例API服务器（端口3001）
2. 启动前端应用（端口5173）
3. 自动等待服务启动完成
4. 显示访问地址

### 方法二：分别启动

如果您想分别控制前端和API服务器：

#### 1. 启动API服务器
```bash
npm run testcase:api
```

#### 2. 启动前端应用
```bash
npm run dev
```

### 方法三：开发模式

使用开发模式，支持热重载：

```bash
# 启动API服务器（开发模式）
npm run testcase:api:dev

# 在另一个终端启动前端应用
npm run dev
```

## 验证API连接

运行以下命令测试API是否正常工作：

```bash
npm run testcase:test-api
```

如果测试通过，您会看到：
```
🧪 测试API连接...
📡 测试健康检查...
✅ 健康检查通过: { status: 'ok', ... }
🔍 测试测试用例解析...
✅ 测试用例解析成功: true
🔄 测试测试用例处理...
✅ 测试用例处理成功: true
📊 处理结果: { totalTests: 1, successCount: 1, failureCount: 0, totalTime: 2.5 }
🎉 API连接测试完成！所有功能正常。
```

## API接口说明

### 1. 健康检查
- **URL**: `GET http://localhost:3001/api/health`
- **功能**: 检查API服务器状态

### 2. 处理测试用例
- **URL**: `POST http://localhost:3001/api/testcase/process`
- **功能**: 解析、生成代码、执行测试
- **请求体**:
```json
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

### 3. 解析测试用例
- **URL**: `POST http://localhost:3001/api/testcase/parse`
- **功能**: 仅解析测试用例，不生成代码

### 4. 生成UI自动化代码
- **URL**: `POST http://localhost:3001/api/testcase/generate`
- **功能**: 基于解析结果生成代码

### 5. 执行UI自动化测试
- **URL**: `POST http://localhost:3001/api/testcase/execute`
- **功能**: 执行生成的测试

## 使用步骤

### 1. 启动系统
```bash
npm run testcase:start
```

### 2. 访问前端页面
打开浏览器访问：`http://localhost:5173/testcase-upload`

### 3. 输入测试用例
在"手动输入"标签页中粘贴以下测试用例：

```markdown
**测试名称：** 用户登录功能测试
**测试描述：** 验证用户能够成功登录系统

**前置条件：**
- 用户已注册账号
- 系统正常运行

**测试步骤：**
1. 打开登录页面
2. 在用户名输入框中输入有效的用户名：admin@example.com
3. 在密码输入框中输入对应的密码：Admin123456
4. 点击登录按钮
5. 验证成功跳转到用户主页
6. 验证页面显示用户信息

**后置条件：**
- 用户已成功登录
- 用户会话已建立

**测试数据：**
- 用户名：admin@example.com
- 密码：Admin123456

**期望结果：**
- 登录成功
- 页面跳转到用户主页
- 显示用户信息
```

### 4. 配置处理选项
- ✅ 生成UI自动化代码
- ✅ 执行生成的测试
- ✅ 保存详细报告
- ✅ 失败时自动重试

### 5. 开始处理
点击"开始处理"按钮，系统将：
1. 解析测试用例
2. 生成Playwright自动化代码
3. 执行UI自动化测试
4. 生成详细报告

## 故障排除

### 1. 端口冲突
如果3001端口被占用，可以修改API服务器端口：

```bash
# 修改 scripts/testcase-api-server.js 中的端口
const port = process.env.PORT || 3002;
```

然后更新前端代码中的API地址：
```javascript
const response = await axios.post('http://localhost:3002/api/testcase/process', {
  // ...
});
```

### 2. CORS错误
如果遇到CORS错误，检查API服务器的CORS配置：

```javascript
this.app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
```

### 3. 环境变量
确保已配置OpenAI API密钥：

```bash
# 在 .env 文件中
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=4000
```

### 4. 网络连接
确保网络连接正常，可以访问OpenAI API。

## 日志查看

### API服务器日志
API服务器会输出详细的处理日志：
```
📝 收到测试用例处理请求
🔄 开始处理 1 个测试用例
🔍 正在解析测试用例...
✅ 测试用例解析成功
🤖 正在生成UI自动化代码...
✅ UI自动化代码生成成功
🚀 正在执行UI自动化测试...
✅ 测试用例处理完成
```

### 前端日志
在浏览器开发者工具的控制台中查看前端日志。

## 性能优化

### 1. 批量处理
对于多个测试用例，建议使用批量处理：
```javascript
const testCases = [
  "测试用例1内容",
  "测试用例2内容",
  "测试用例3内容"
];
```

### 2. 异步处理
对于大量测试用例，可以考虑异步处理：
```javascript
// 分批处理
const batchSize = 5;
for (let i = 0; i < testCases.length; i += batchSize) {
  const batch = testCases.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### 3. 缓存机制
对于重复的测试用例，可以添加缓存机制。

## 安全考虑

### 1. API密钥安全
- 不要在代码中硬编码API密钥
- 使用环境变量存储敏感信息
- 定期轮换API密钥

### 2. 输入验证
- 验证测试用例格式
- 限制文件大小
- 防止恶意输入

### 3. 错误处理
- 不要在前端暴露敏感错误信息
- 记录详细的服务器日志
- 实现优雅的错误恢复

## 扩展功能

### 1. 添加新的API接口
在 `scripts/testcase-api-server.js` 中添加新的路由：

```javascript
this.app.post('/api/testcase/custom', async (req, res) => {
  // 自定义功能
});
```

### 2. 集成其他服务
可以集成其他AI服务或测试框架：

```javascript
// 集成其他AI服务
const otherAIResponse = await otherAIService.generate(testCase);
```

### 3. 添加认证
为API添加认证机制：

```javascript
// 添加JWT认证
this.app.use('/api', authenticateToken);
```

---

现在您可以正常使用测试用例上传功能了！如果还有问题，请查看服务器日志或运行 `npm run testcase:test-api` 进行诊断。 