<template>
  <div class="integrated-test">
    <div class="header">
      <h1>🤖 智能测试生成器</h1>
      <p>上传测试用例、页面截图和页面信息，自动生成UI自动化测试代码</p>
    </div>
    <!-- 直接展示合并后的表单，无Tab切换 -->
    <div class="content-container">
      <div class="content-panel">
        <form @submit.prevent="processAll" class="all-in-one-form">
          <h2>1. 测试用例与页面信息</h2>
          <!-- 用例输入方式选择 -->
          <div class="input-method">
            <label class="method-label">
              <input type="radio" v-model="testcaseInputMethod" value="file" />
              <span>文件上传</span>
            </label>
            <label class="method-label">
              <input type="radio" v-model="testcaseInputMethod" value="manual" />
              <span>手动输入</span>
            </label>
          </div>
          <!-- 文件上传 -->
          <div v-if="testcaseInputMethod === 'file'" class="file-upload">
            <div class="upload-area" @click="triggerFileUpload" @drop="handleFileDrop" @dragover.prevent>
              <input ref="fileInput" type="file" accept=".md,.txt,.doc,.docx" @change="handleFileUpload" style="display: none" />
              <div class="upload-content">
                <div class="upload-icon">📁</div>
                <p>点击或拖拽上传测试用例文件</p>
                <p class="upload-hint">支持 Markdown、TXT、DOC 格式</p>
              </div>
            </div>
            <div v-if="uploadedFile" class="file-info">
              <span>已上传: {{ uploadedFile.name }}</span>
              <button @click="removeFile" class="remove-btn">删除</button>
            </div>
          </div>
          <!-- 手动输入 -->
          <div v-if="testcaseInputMethod === 'manual'" class="manual-input">
            <textarea v-model="manualTestcase" placeholder="请输入测试用例内容..." rows="10"></textarea>
          </div>
          <!-- 截图上传 -->
          <div class="screenshot-section">
            <h3>页面截图</h3>
            <div class="upload-area" @click="triggerScreenshotUpload" @drop="handleScreenshotDrop" @dragover.prevent>
              <input ref="screenshotInput" type="file" accept="image/*" multiple @change="handleScreenshotUpload" style="display: none" />
              <div class="upload-content" v-if="screenshots.length === 0">
                <div class="upload-icon">📸</div>
                <p>点击或拖拽上传截图</p>
                <p class="upload-hint">支持 PNG、JPG、JPEG 格式</p>
              </div>
              <div class="screenshot-preview" v-else>
                <div v-for="(img, idx) in screenshots" :key="idx" style="display:inline-block;position:relative;margin:0 10px 10px 0;">
                  <img :src="img" alt="截图预览" style="max-width:180px;max-height:120px;border-radius:8px;" />
                  <button @click.stop="removeScreenshot(idx)" class="remove-btn" style="position:absolute;top:10px;right:10px;">删除</button>
                </div>
              </div>
            </div>
          </div>
          <!-- 页面信息 -->
          <div class="page-config-section">
            <h3>页面信息</h3>
            <div class="form-group">
              <label>页面名称：</label>
              <input v-model="pageName" placeholder="例如：登录页面、用户管理页面" />
            </div>
            <div class="form-group">
              <label>页面URL：</label>
              <input v-model="pageUrl" placeholder="例如：/login、/users" />
            </div>
            <div class="form-group">
              <label>页面描述：</label>
              <textarea v-model="pageDescription" placeholder="描述页面的主要功能和特点"></textarea>
            </div>
          </div>
          <!-- 一键生成按钮 -->
          <div class="action-section">
            <button type="submit" :disabled="!canProcessAll" class="process-btn">
              🚀 一键生成自动化代码
            </button>
          </div>
          
          <!-- 生成进度 - 在生成按钮下方 -->
          <div v-if="isProcessing" class="generation-progress">
            <div class="progress-header-generation">
              <span class="progress-status-generation">{{ processingMessage }}</span>
              <span class="progress-percentage-generation">{{ generationProgress }}%</span>
            </div>
            <div class="progress-bar-generation">
              <div class="progress-fill-generation" :style="{ width: generationProgress + '%' }"></div>
            </div>
            <div class="progress-steps-generation">
              <span v-if="generationStep >= 1" class="step-completed">✅ 解析测试用例</span>
              <span v-if="generationStep >= 2" class="step-completed">✅ 分析页面元素</span>
              <span v-if="generationStep >= 3" class="step-completed">✅ 生成测试代码</span>
              <span v-if="generationStep >= 4" class="step-completed">✅ 代码优化</span>
              <span v-if="generationStep === 0" class="step-pending">⏳ 准备生成...</span>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- 测试执行和报告功能区域 - 始终显示 -->
    <div class="permanent-actions-section">
      <h2>🚀 测试执行与报告</h2>
      <p>执行生成的测试用例并查看详细的测试报告</p>
      
      <!-- 测试执行控制面板 -->
      <div class="execution-control-panel">
        <div class="panel-header">
          <h3>测试执行控制</h3>
        </div>
        
        <!-- 测试文件选择 -->
        <div class="control-group">
          <label>选择测试文件：</label>
          <div class="file-select-container">
            <select v-model="selectedTestFile" class="test-file-select">
              <option value="">请选择测试文件</option>
              <option v-for="file in availableTestFiles" :key="file" :value="file">
                {{ file.replace('tests/generated/', '') }}
              </option>
            </select>
            <button @click="loadAvailableTestFiles" class="refresh-btn" title="刷新文件列表">
              🔄
            </button>
          </div>
        </div>

        <!-- 执行选项 -->
        <div class="control-group">
          <label>执行选项：</label>
          <div class="execution-options">
            <label class="option-label">
              <input type="checkbox" v-model="executionOptions.headless" />
              无头模式
            </label>
            <label class="option-label">
              <input type="checkbox" v-model="executionOptions.parallel" />
              并行执行
            </label>
            <label class="option-label">
              <input type="checkbox" v-model="executionOptions.retry" />
              失败重试
            </label>
          </div>
        </div>

        <!-- 执行按钮 -->
        <div class="execution-actions">
          <button @click="executeSelectedTest" :disabled="!selectedTestFile" class="execute-btn">
            ▶️ 执行选中测试
          </button>
          <button @click="executeGeneratedTest" class="execute-current-btn" :disabled="!processingResult">
            ⚡ 执行当前生成的测试
          </button>
          <button @click="executeAllTests" class="execute-all-btn">
            🚀 执行所有测试
          </button>
        </div>
        
        <!-- 执行进度 - 移到执行按钮下方 -->
        <div v-if="isExecuting" class="execution-progress-inline">
          <div class="progress-header-inline">
            <span class="progress-status">{{ executionStatus }}</span>
            <span class="progress-percentage">{{ executionProgress }}%</span>
          </div>
          <div class="progress-bar-inline">
            <div class="progress-fill-inline" :style="{ width: executionProgress + '%' }"></div>
          </div>
          <div class="progress-stats-inline">
            <span>已执行: {{ executedTests }}/{{ totalTests }}</span>
            <span>通过: {{ passedTests }}</span>
            <span>失败: {{ failedTests }}</span>
          </div>
        </div>
      </div>

      <!-- 报告功能 -->
      <div class="report-actions">
        <button @click="viewPlaywrightReport" class="playwright-report-btn">
          🎭 查看详细报告
        </button>
        <button @click="exportTestResults" class="export-btn" :disabled="!processingResult">
          📥 导出结果
        </button>
      </div>
      
      <div class="action-tips">
        <p><strong>提示：</strong></p>
        <ul>
          <li>执行选中测试：从下拉列表中选择特定的测试文件执行</li>
          <li>执行当前生成的测试：执行刚刚生成的测试代码</li>
          <li>执行所有测试：批量执行所有已生成的测试文件</li>
          <li>查看详细报告：打开 Playwright 原生测试报告</li>
        </ul>
      </div>
    </div>

    <!-- 处理结果 -->
    <div v-if="processingResult" class="result-section">
      <h2>处理结果</h2>
      
      <!-- 处理信息 -->
      <div class="result-info">
        <div class="info-item">
          <strong>处理方式：</strong>
          <span>{{ activeTab === 'testcase' ? '测试用例解析' : '截图分析' }}</span>
        </div>
        <div class="info-item">
          <strong>生成时间：</strong>
          <span>{{ new Date().toLocaleString() }}</span>
        </div>
      </div>

      <!-- 识别到的元素（截图分析结果） -->
      <div v-if="processingResult.elements" class="elements-section">
        <h3>识别到的UI元素</h3>
        <div class="elements-grid">
          <div v-for="element in processingResult.elements" :key="element.description" class="element-card">
            <div class="element-header">
              <span class="element-type">{{ element.type }}</span>
              <span class="element-description">{{ element.description }}</span>
            </div>
            <div class="element-selector">
              <strong>推荐选择器：</strong>
              <code>{{ element.recommendedSelector }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- 生成的代码 -->
      <div class="code-section">
        <h3>生成的自动化测试代码 <span class="run-tip">（可直接运行）</span></h3>
        <div class="code-content code-scrollable">
          <pre><code class="language-ts">{{ formattedCode }}</code></pre>
        </div>
        <div class="code-actions code-actions-row">
          <button @click="copyCode" class="copy-btn highlight-btn">📋 复制代码</button>
          <button @click="downloadCode" class="download-btn highlight-btn">📥 下载代码</button>
        </div>
        <!-- 新增：执行和报告按钮，生成代码后始终可见 -->
        <div class="execution-actions" style="margin-top: 1.5rem;">
          <button @click="executeGeneratedTest" class="execute-btn">
            ▶️ 执行测试
          </button>
          <button @click="viewPlaywrightReport" class="playwright-report-btn">
            🎭 查看详细报告
          </button>
          <button @click="exportTestResults" class="export-btn">
            📥 导出结果
          </button>
        </div>
      </div>
    </div>
    <!-- 执行和报告功能只在截图分析Tab下显示 -->
    <div v-if="false" class="execution-section">
      <!-- 这里原有的按钮区域被隐藏 -->
    </div>



    <!-- 加载状态 -->
    <div v-if="isProcessing" class="loading-section">
      <div class="loading-spinner"></div>
      <p>{{ processingMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 响应式数据
const activeTab = ref('testcase')
const isProcessing = ref(false)
const processingMessage = ref('')
const processingResult = ref<any>(null)

// 测试用例相关
const testcaseInputMethod = ref('file')
const uploadedFile = ref<File | null>(null)
const manualTestcase = ref('')
const fileInput = ref<HTMLInputElement>()

// 截图分析相关
const screenshots = ref<string[]>([])
const pageName = ref('')
const pageUrl = ref('')
const pageDescription = ref('')
const screenshotInput = ref<HTMLInputElement>()

// 测试执行相关
const selectedTestFile = ref('')
const availableTestFiles = ref<string[]>([])
const executionOptions = ref({
  headless: true,
  parallel: false,
  retry: true
})
const isExecuting = ref(false)
const executionStatus = ref('')
const executionProgress = ref(0)
const totalTests = ref(0)
const executedTests = ref(0)
const passedTests = ref(0)
const failedTests = ref(0)

// 生成进度相关
const generationProgress = ref(0)
const generationStep = ref(0)

// 计算属性
const canProcessTestcase = computed(() => {
  if (testcaseInputMethod.value === 'file') {
    return uploadedFile.value !== null
  } else if (testcaseInputMethod.value === 'manual') {
    return manualTestcase.value.trim().length > 0
  }
  return false
})

const canAnalyzeScreenshot = computed(() => {
  return screenshots.value.length > 0 && pageName.value;
})

const canProcessAll = computed(() => {
  return canProcessTestcase.value && screenshots.value.length > 0 && pageName.value;
})

// 自动去除AI返回的markdown代码块标记和说明，只保留TypeScript代码
const stripMarkdownAndComments = (raw: string): string => {
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
};

const formattedCode = computed(() => {
  if (!processingResult.value || !processingResult.value.completeCode) return '';
  return stripMarkdownAndComments(processingResult.value.completeCode);
});

// 测试用例处理方法
const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    uploadedFile.value = file
  }
}

const handleFileDrop = (event: DragEvent) => {
  event.preventDefault()
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    uploadedFile.value = files[0]
  }
}

const removeFile = () => {
  uploadedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const processAll = async () => {
  if (!canProcessAll.value) return

  isProcessing.value = true
  processingMessage.value = '正在生成自动化代码...'
  generationProgress.value = 0
  generationStep.value = 0
  
  try {
    // 步骤1: 解析测试用例
    generationStep.value = 1
    generationProgress.value = 25
    processingMessage.value = '正在解析测试用例...'
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const allData = {
      testcase: testcaseInputMethod.value === 'file' ? await readFileContent(uploadedFile.value!) : manualTestcase.value,
      screenshots: screenshots.value, // 用于后端接口的截图字段也需改为 screenshots.value
      pageUrl: pageUrl.value,
      pageName: pageName.value,
      pageDescription: pageDescription.value
    }

    // 步骤2: 分析页面元素
    generationStep.value = 2
    generationProgress.value = 50
    processingMessage.value = '正在分析页面元素...'
    await new Promise(resolve => setTimeout(resolve, 500))

    const response = await fetch('http://localhost:3001/api/testcase-process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(allData)
    })

    // 步骤3: 生成测试代码
    generationStep.value = 3
    generationProgress.value = 75
    processingMessage.value = '正在生成测试代码...'
    await new Promise(resolve => setTimeout(resolve, 500))

    if (response.ok) {
      processingResult.value = await response.json()
      
      // 步骤4: 代码优化
      generationStep.value = 4
      generationProgress.value = 100
      processingMessage.value = '正在优化代码...'
      await new Promise(resolve => setTimeout(resolve, 300))
      
      processingMessage.value = '生成完成！'
      
      // 新增：自动刷新可用的测试文件列表
      await loadAvailableTestFiles()
      
      // 新增：自动选择新生成的文件（如果存在）
      if (processingResult.value.filePath) {
        const fileName = processingResult.value.filePath.split('/').pop()
        if (fileName) {
          const fullPath = `tests/generated/${fileName}`
          if (availableTestFiles.value.includes(fullPath)) {
            selectedTestFile.value = fullPath
          }
        }
      }
      
    } else {
      throw new Error('生成失败')
    }
  } catch (error) {
    console.error('生成自动化代码失败:', error)
    alert('生成失败，请重试')
  } finally {
    isProcessing.value = false
  }
}

const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// 截图分析方法
const triggerScreenshotUpload = () => {
  screenshotInput.value?.click()
}

const handleScreenshotUpload = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        screenshots.value.push(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    });
  }
}

const handleScreenshotDrop = (event: DragEvent) => {
  event.preventDefault();
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          screenshots.value.push(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

const removeScreenshot = (idx: number) => {
  screenshots.value.splice(idx, 1);
}

const startScreenshotAnalysis = async () => {
  if (!canAnalyzeScreenshot.value) return

  isProcessing.value = true
  processingMessage.value = '正在分析截图...'
  
  try {
    const analysisData = {
      screenshots: screenshots.value, // 用于后端接口的截图字段也需改为 screenshots.value
      pageContext: {
        name: pageName.value,
        url: pageUrl.value,
        description: pageDescription.value
      }
    }

    const response = await fetch('http://localhost:3001/api/screenshot-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(analysisData)
    })

    if (response.ok) {
      processingResult.value = await response.json()
      
      // 新增：自动刷新可用的测试文件列表
      await loadAvailableTestFiles()
      
      // 新增：自动选择新生成的文件（如果存在）
      if (processingResult.value.filePath) {
        const fileName = processingResult.value.filePath.split('/').pop()
        if (fileName) {
          const fullPath = `tests/generated/${fileName}`
          if (availableTestFiles.value.includes(fullPath)) {
            selectedTestFile.value = fullPath
          }
        }
      }
    } else {
      throw new Error('分析失败')
    }
  } catch (error) {
    console.error('分析失败:', error)
    alert('分析失败，请重试')
  } finally {
    isProcessing.value = false
  }
}

// 代码处理方法
const downloadCode = () => {
  const code = processingResult.value.completeCode || ''
  const blob = new Blob([code], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${activeTab.value === 'testcase' ? 'testcase' : pageName.value}-generated.ts`
  a.click()
  URL.revokeObjectURL(url)
}

const copyCode = async () => {
  const code = processingResult.value.completeCode || ''
  try {
    await navigator.clipboard.writeText(code)
    alert('代码已复制到剪贴板')
  } catch (error) {
    console.error('复制失败:', error)
    alert('复制失败')
  }
}

const executeGeneratedTest = async () => {
  if (!processingResult.value) {
    alert('没有可执行的测试代码')
    return
  }
  
  isExecuting.value = true
  executionStatus.value = '准备执行生成的测试...'
  executionProgress.value = 0
  
  try {
    const response = await fetch('http://localhost:3002/api/execute-generated-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        testCode: processingResult.value.completeCode,
        testName: processingResult.value.parsedTestCase?.testName || 'generated-test'
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      executionProgress.value = 100
      executionStatus.value = '执行完成'
      
      // 新增：执行完成后自动刷新文件列表
      await loadAvailableTestFiles()
      
      alert(`测试执行完成！\n状态: ${result.success ? '通过' : '失败'}\n耗时: ${result.duration}ms\n\n点击"查看详细报告"可查看完整的 Playwright 测试报告`)
    } else {
      throw new Error('执行失败')
    }
  } catch (error: any) {
    console.error('执行生成的测试失败:', error)
    alert('执行生成的测试失败: ' + (error.message || '未知错误'))
  } finally {
    isExecuting.value = false
  }
}

const viewTestReport = () => {
  // 跳转到测试报告页面
  router.push('/test-execution')
}

const viewPlaywrightReport = async () => {
  try {
    console.log('🔄 正在启动 Playwright 报告服务...')
    
    // 启动 Playwright 报告服务
    const response = await fetch('http://localhost:3002/api/start-playwright-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Playwright 报告服务启动成功:', result)
      
      // 检查是否是使用现有服务
      if (result.existingService) {
        console.log('ℹ️ 使用现有的报告服务')
        alert('检测到现有报告服务，正在打开报告...')
      } else {
        alert('Playwright 报告服务正在启动中，请稍等片刻后在新窗口中查看报告')
      }
      
      // 在新窗口中打开 Playwright 报告
      setTimeout(() => {
        window.open(result.reportUrl, '_blank')
      }, result.existingService ? 500 : 2000) // 现有服务等待时间短一些
      
    } else {
      console.warn('⚠️ 启动报告服务失败，尝试备用方案')
      
      // 如果服务启动失败，提供备用方案
      const fallbackResponse = await fetch('http://localhost:3002/api/playwright-report')
      if (fallbackResponse.ok) {
        const fallbackResult = await fallbackResponse.json()
        console.log('✅ 备用报告服务可用:', fallbackResult)
        window.open(fallbackResult.reportUrl, '_blank')
        alert('正在尝试打开 Playwright 报告，如果页面无法加载，请确保已执行过测试')
      } else {
        throw new Error('备用报告服务也不可用')
      }
    }
  } catch (error: any) {
    console.error('❌ 查看 Playwright 报告失败:', error)
    
    // 提供最后的备用方案
    try {
      console.log('🔄 尝试直接打开报告页面...')
      window.open('http://localhost:9323', '_blank')
      alert('正在尝试直接打开 Playwright 报告。如果页面无法加载，请先执行测试生成报告')
    } catch (fallbackError) {
      console.error('❌ 备用方案也失败:', fallbackError)
      alert('查看 Playwright 报告失败: ' + (error.message || '未知错误') + '\n\n请确保：\n1. 已执行过测试\n2. Playwright 已正确安装\n3. 端口 9323 未被占用')
    }
  }
}

// 加载可用的测试文件
const loadAvailableTestFiles = async () => {
  try {
    console.log('🔄 正在刷新测试文件列表...')
    const response = await fetch('http://localhost:3002/api/available-tests')
    if (response.ok) {
      const result = await response.json()
      const oldFiles = [...availableTestFiles.value]
      availableTestFiles.value = result.files || []
      
      console.log('📁 测试文件列表已更新:', {
        oldCount: oldFiles.length,
        newCount: availableTestFiles.value.length,
        newFiles: availableTestFiles.value
      })
      
      // 如果文件列表有变化，显示提示
      if (oldFiles.length !== availableTestFiles.value.length) {
        console.log('✅ 文件列表已自动刷新，新增文件:', 
          availableTestFiles.value.filter(file => !oldFiles.includes(file))
        )
      }
    } else {
      console.error('❌ 获取测试文件失败:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('❌ 加载测试文件失败:', error)
  }
}

// 执行选中的测试文件
const executeSelectedTest = async () => {
  if (!selectedTestFile.value) {
    alert('请先选择测试文件')
    return
  }
  
  isExecuting.value = true
  executionStatus.value = '准备执行测试...'
  executionProgress.value = 0
  
  try {
    const response = await fetch('http://localhost:3002/api/execute-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        testFile: selectedTestFile.value,
        options: executionOptions.value
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      executionProgress.value = 100
      executionStatus.value = '执行完成'
      
      // 新增：执行完成后自动刷新文件列表
      await loadAvailableTestFiles()
      
      alert(`测试执行完成！\n文件: ${selectedTestFile.value}\n状态: ${result.success ? '通过' : '失败'}\n耗时: ${result.duration}ms\n\n点击"查看详细报告"可查看完整的 Playwright 测试报告`)
    } else {
      throw new Error('执行失败')
    }
  } catch (error: any) {
    console.error('执行测试失败:', error)
    alert('执行测试失败: ' + (error.message || '未知错误'))
  } finally {
    isExecuting.value = false
  }
}

const executeAllTests = async () => {
  isExecuting.value = true
  executionStatus.value = '准备执行所有测试...'
  executionProgress.value = 0
  
  try {
    const response = await fetch('http://localhost:3002/api/execute-all-tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        options: executionOptions.value
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      executionProgress.value = 100
      executionStatus.value = '执行完成'
      
      // 新增：执行完成后自动刷新文件列表
      await loadAvailableTestFiles()
      
      alert(`所有测试执行完成！\n状态: ${result.success ? '通过' : '失败'}\n耗时: ${result.duration}ms\n\n点击"查看详细报告"可查看完整的 Playwright 测试报告`)
    } else {
      throw new Error('执行失败')
    }
  } catch (error: any) {
    console.error('执行所有测试失败:', error)
    alert('执行所有测试失败: ' + (error.message || '未知错误'))
  } finally {
    isExecuting.value = false
  }
}

const exportTestResults = () => {
  if (!processingResult.value) {
    alert('没有可导出的结果')
    return
  }
  
  const exportData = {
    timestamp: new Date().toISOString(),
    type: activeTab.value,
    result: processingResult.value
  }
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `test-result-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 页面加载时获取可用的测试文件
onMounted(() => {
  loadAvailableTestFiles()
  
  // 新增：定时刷新文件列表（每30秒刷新一次）
  const refreshInterval = setInterval(loadAvailableTestFiles, 30000)
  
  // 组件卸载时清理定时器
  onUnmounted(() => {
    clearInterval(refreshInterval)
  })
})
</script>

<style scoped>
.integrated-test {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 3rem;
}

.header h1 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.header p {
  color: #7f8c8d;
  font-size: 1.1rem;
}

.function-selector {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  overflow: hidden;
}

.selector-header {
  display: flex;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px 12px 0 0;
}

.selector-btn {
  flex: 1;
  padding: 1.5rem 2rem;
  background: none;
  border: none;
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
}

.selector-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.selector-btn.active {
  background-color: rgba(255, 255, 255, 0.2);
  font-weight: 600;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.content-container {
  margin-bottom: 2rem;
}

.content-panel {
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.input-section,
.action-section,
.screenshot-section,
.page-config-section,
.test-steps-section,
.analysis-section {
  margin-bottom: 2rem;
}

.input-method {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.method-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.upload-area {
  border: 2px dashed #3498db;
  border-radius: 8px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-area:hover {
  border-color: #2980b9;
  background-color: #f8f9fa;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.upload-icon {
  font-size: 3rem;
}

.upload-hint {
  color: #7f8c8d;
  font-size: 0.9rem;
}

.file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 6px;
  margin-top: 1rem;
}

.manual-input {
  margin-top: 1rem;
}

.manual-input textarea {
  width: 100%;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.4;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.form-group textarea {
  height: 100px;
  resize: vertical;
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.step-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: #f8f9fa;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.step-number {
  font-weight: 600;
  color: #2c3e50;
}

.remove-step-btn {
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.add-step-btn {
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 1rem;
}

.process-btn,
.analyze-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.process-btn:hover:not(:disabled),
.analyze-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.process-btn:disabled,
.analyze-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.execution-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #28a745;
}

.execution-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

/* 永久显示的测试执行区域样式 */
.permanent-actions-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin: 2rem 0;
  border-left: 4px solid #28a745;
}

.permanent-actions-section h2 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.permanent-actions-section p {
  color: #7f8c8d;
  margin-bottom: 1.5rem;
}

.permanent-execution-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.action-tips {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 1rem;
  border-left: 3px solid #17a2b8;
}

.action-tips p {
  margin-bottom: 0.5rem;
  color: #2c3e50;
  font-weight: 600;
}

.action-tips ul {
  margin: 0;
  padding-left: 1.5rem;
}

.action-tips li {
  color: #6c757d;
  margin-bottom: 0.25rem;
}

/* 执行控制面板样式 */
.execution-control-panel {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e9ecef;
}

.panel-header h3 {
  color: #2c3e50;
  margin-bottom: 1rem;
}

.control-group {
  margin-bottom: 1.5rem;
}

.control-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.test-file-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  background: white;
}

.file-select-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.refresh-btn {
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 1.1rem;
  transition: background 0.3s ease;
}

.refresh-btn:hover {
  background: #5a6268;
}

.execution-options {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
}

.option-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.report-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

/* 内联执行进度样式 */
.execution-progress-inline {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 1rem;
  border: 1px solid #e9ecef;
}

.progress-header-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.progress-status {
  color: #17a2b8;
  font-weight: 600;
  font-size: 0.9rem;
}

.progress-percentage {
  color: #28a745;
  font-weight: 700;
  font-size: 0.9rem;
}

.progress-bar-inline {
  width: 100%;
  height: 12px;
  background: #e9ecef;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill-inline {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  transition: width 0.3s ease;
}

.progress-stats-inline {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: #6c757d;
}

.progress-stats-inline span {
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

/* 生成进度样式 */
.generation-progress {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 1rem;
  border: 1px solid #e9ecef;
  border-left: 4px solid #28a745;
}

.progress-header-generation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.progress-status-generation {
  color: #28a745;
  font-weight: 600;
  font-size: 1rem;
}

.progress-percentage-generation {
  color: #28a745;
  font-weight: 700;
  font-size: 1.1rem;
}

.progress-bar-generation {
  width: 100%;
  height: 16px;
  background: #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill-generation {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  transition: width 0.5s ease;
}

.progress-steps-generation {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
}

.step-completed {
  color: #28a745;
  font-weight: 600;
  background: #d4edda;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.step-pending {
  color: #6c757d;
  font-weight: 500;
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.execute-btn,
.execute-current-btn,
.report-btn,
.playwright-report-btn,
.execute-all-btn,
.export-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.execute-btn {
  background: #28a745;
  color: white;
}

.execute-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.execute-current-btn {
  background: #007bff;
  color: white;
}

.execute-current-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.report-btn {
  background: #17a2b8;
  color: white;
}

.playwright-report-btn {
  background: #e83e8c;
  color: white;
}

.execute-all-btn {
  background: #fd7e14;
  color: white;
}

.export-btn {
  background: #6c757d;
  color: white;
}

.export-btn:disabled {
  background: #adb5bd;
  cursor: not-allowed;
}

.execute-btn:hover:not(:disabled),
.execute-current-btn:hover:not(:disabled),
.report-btn:hover,
.playwright-report-btn:hover,
.execute-all-btn:hover,
.export-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.screenshot-preview {
  position: relative;
  display: inline-block;
}

.screenshot-preview img {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
}

.remove-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.result-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-top: 2rem;
}

.result-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.info-item {
  display: flex;
  justify-content: space-between;
}

.elements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.element-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
}

.element-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.element-type {
  background: #3498db;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
}

.element-description {
  font-weight: 600;
  color: #2c3e50;
}

.element-selector {
  font-size: 0.9rem;
}

.element-selector code {
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.code-content {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 1rem;
  border-radius: 6px;
  max-height: 400px;
  overflow-y: auto;
}

.code-content pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.4;
}

.code-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.download-btn,
.copy-btn {
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
}

.copy-btn {
  background: #3498db;
}

.loading-section {
  text-align: center;
  padding: 3rem;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .integrated-test {
    padding: 1rem;
  }
  
  .selector-header {
    flex-direction: column;
  }
  
  .selector-btn {
    padding: 0.75rem 1rem;
  }
  
  .input-method {
    flex-direction: column;
    gap: 1rem;
  }
  
  .code-actions {
    flex-direction: column;
  }
  
  .result-info {
    grid-template-columns: 1fr;
  }
  
  .elements-grid {
    grid-template-columns: 1fr;
  }
}
.code-section {
  margin-top: 2rem;
}
.code-content.code-scrollable {
  background: #23272e;
  color: #f8f8f2;
  border-radius: 8px;
  padding: 1.2rem;
  font-size: 1.05rem;
  overflow-x: auto;
  max-height: 480px;
  margin-bottom: 1rem;
}
.code-actions.code-actions-row {
  display: flex;
  gap: 1rem;
}
.highlight-btn {
  font-weight: bold;
  font-size: 1.1rem;
  border-radius: 6px;
  padding: 0.5rem 1.2rem;
  background: #4f8cff;
  color: #fff;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}
.highlight-btn:hover {
  background: #2563eb;
}
.run-tip {
  color: #22c55e;
  font-size: 1rem;
  margin-left: 0.5rem;
}
</style> 