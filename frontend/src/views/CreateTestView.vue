<template>
  <div class="create-test-container">
    <div class="page-header">
      <h1>创建测试</h1>
      <p class="subtitle">智能创建测试</p>
    </div>

    <div class="main-content two-cols">
      <!-- 左侧主编辑区 -->
      <div class="test-generation-section">
        <h2>测试用例与页面信息</h2>
        
        <!-- 输入方式选择 -->
        <div class="input-method-selector">
          <label class="radio-group">
            <input type="radio" v-model="inputMethod" value="tapd" />
            <span>从 TAPD 导入</span>
          </label>
          <label class="radio-group">
            <input type="radio" v-model="inputMethod" value="manual" />
            <span>手动输入</span>
          </label>
          <label class="radio-group">
            <input type="radio" v-model="inputMethod" value="file" />
            <span>文件上传</span>
          </label>
        </div>

        <!-- 文件上传方式 -->
        <div v-if="inputMethod === 'file'" class="upload-section">
          <div class="upload-area">
            <h3>测试用例文件</h3>
            <div class="upload-box" @click="triggerFileUpload('testCase')">
              <i class="upload-icon">📁</i>
              <p>点击或拖拽上传测试用例文件</p>
              <p class="format-hint">支持 Markdown, TXT, DOC 格式</p>
            </div>
            <input
              ref="testCaseFileInput"
              type="file"
              accept=".md,.txt,.doc,.docx"
              @change="handleFileUpload('testCase', $event)"
              style="display: none"
            />
            <div v-if="uploadedFiles.testCase" class="file-info">
              <span>✅ {{ uploadedFiles.testCase.name }}</span>
              <button @click="removeFile('testCase')" class="remove-btn">删除</button>
            </div>
          </div>

          <div class="upload-area">
            <h3>页面截图</h3>
            <div class="upload-box" @click="triggerFileUpload('screenshot')">
              <i class="upload-icon">📷</i>
              <p>点击或拖拽上传截图</p>
              <p class="format-hint">支持 PNG, JPG, JPEG 格式</p>
            </div>
            <input
              ref="screenshotFileInput"
              type="file"
              accept=".png,.jpg,.jpeg"
              @change="handleFileUpload('screenshot', $event)"
              style="display: none"
            />
            <div v-if="uploadedFiles.screenshot" class="file-info">
              <span>✅ {{ uploadedFiles.screenshot.name }}</span>
              <button @click="removeFile('screenshot')" class="remove-btn">删除</button>
            </div>
          </div>
        </div>

        <!-- 手动输入方式 -->
        <div v-if="inputMethod === 'manual'" class="manual-input-section">
          <div class="form-group">
            <label>页面名称 *</label>
            <input 
              v-model="manualInput.pageName" 
              type="text" 
              placeholder="例如: 登录页面、用户管理页面"
            />
          </div>
          
          <div class="form-group">
            <label>页面URL *</label>
            <input 
              v-model="manualInput.pageUrl" 
              type="text" 
              placeholder="例如: login, users"
            />
          </div>
          
          <div class="form-group">
            <label>页面描述</label>
            <textarea 
              v-model="manualInput.pageDescription" 
              placeholder="描述该页面的主要功能和特点"
              rows="4"
            ></textarea>
          </div>

          <div class="form-group">
            <label>用例内容（可选，Markdown）</label>
            <textarea 
              v-model="manualInput.testCaseBody"
              class="md-area"
              placeholder="在此粘贴或编写测试用例步骤，例如：\n1. 打开登录页\n2. 输入用户名和密码\n3. 点击登录并断言成功"
              rows="8"
            ></textarea>
          </div>

          <!-- 手动输入下的页面截图上传（可选，用于辅助生成） -->
          <div class="upload-area">
            <h3>页面截图（可选，用于辅助生成）</h3>
            <div class="upload-box" @click="triggerFileUpload('screenshot')">
              <i class="upload-icon">📷</i>
              <p>点击或拖拽上传截图</p>
              <p class="format-hint">支持 PNG, JPG, JPEG 格式</p>
            </div>
            <input
              ref="screenshotFileInput"
              type="file"
              accept=".png,.jpg,.jpeg"
              @change="handleFileUpload('screenshot', $event)"
              style="display: none"
            />
            <div v-if="uploadedFiles.screenshot" class="file-info">
              <span>✅ {{ uploadedFiles.screenshot.name }}</span>
              <button @click="removeFile('screenshot')" class="remove-btn">删除</button>
            </div>
          </div>
        </div>

        <!-- TAPD 导入方式 -->
        <div v-if="inputMethod === 'tapd'" class="tapd-import-section">
          <div class="form-group">
            <div class="filter-row">
              <button @click="loadTapdTestCases" class="load-btn" :disabled="loadingTapd">
                {{ loadingTapd ? '加载中...' : '加载测试用例' }}
              </button>
            </div>
            <div v-if="filterOptions.mocked" class="mock-notice">
              <small>💡 当前显示模拟数据，配置 TAPD 后可获取真实筛选选项</small>
            </div>
          </div>

          <!-- TAPD 浏览布局：左侧目录树 + 右侧内容 -->
          <div class="tapd-browser">
            <aside class="module-tree-panel">
              <div class="tree-header">
                <span>用例目录</span>
                <button class="tree-reset" @click="selectModule('', '所有模块')">重置</button>
              </div>
              <div class="tree-scroll">
                <div class="tree-item" @click="selectModule('', '所有模块')">
                  <span class="tree-label" :class="{ selected: !tapdFilters.module }">所有模块</span>
                </div>
                <div v-for="module in rootModules" :key="module.id" class="tree-item">
                  <div 
                    class="tree-node" 
                    :class="{ expanded: expandedModules.has(module.id) }"
                    @click="toggleModule(module)"
                  >
                    <span v-if="module.children && module.children.length > 0" class="tree-toggle">
                      {{ expandedModules.has(module.id) ? '▼' : '▶' }}
                    </span>
                    <span 
                      class="tree-label" 
                      :class="{ selected: tapdFilters.module === module.id }"
                      @click.stop="selectModule(module.id, module.name)"
                    >
                      {{ module.name }}
                    </span>
                  </div>
                  <div v-if="module.children && module.children.length > 0 && expandedModules.has(module.id)" class="tree-children">
                    <div 
                      v-for="child in module.children" 
                      :key="child.id"
                      class="tree-item child"
                    >
                      <div 
                        class="tree-node" 
                        :class="{ expanded: expandedModules.has(child.id) }"
                        @click="toggleModule(child)"
                      >
                        <span v-if="child.children && child.children.length > 0" class="tree-toggle">
                          {{ expandedModules.has(child.id) ? '▼' : '▶' }}
                        </span>
                        <span 
                          class="tree-label" 
                          :class="{ selected: tapdFilters.module === child.id }"
                          @click.stop="selectModule(child.id, child.name)"
                        >
                          {{ child.name }}
                        </span>
                      </div>
                      <div v-if="child.children && child.children.length > 0 && expandedModules.has(child.id)" class="tree-children">
                        <div 
                          v-for="grandChild in child.children" 
                          :key="grandChild.id"
                          class="tree-item grandchild"
                        >
                          <span 
                            class="tree-label" 
                            :class="{ selected: tapdFilters.module === grandChild.id }"
                            @click="selectModule(grandChild.id, grandChild.name)"
                          >
                            {{ grandChild.name }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <section class="tapd-content">
              <div v-if="tapdTestCases.length > 0" class="testcase-list">
                <h3>选择测试用例 <small v-if="selectedTapdTestCases.length">（已选 {{ selectedTapdTestCases.length }} 项）</small></h3>
                <div class="list-toolbar">
                  <button class="btn sm" @click="selectAllVisible">全选当前页</button>
                  <button class="btn sm" @click="invertSelectionVisible">反选</button>
                  <button class="btn sm ghost" :disabled="selectedTapdTestCases.length===0" @click="clearSelected">清空已选</button>
                </div>
                <div class="testcase-grid">
                  <div 
                    v-for="testCase in tapdTestCases" 
                    :key="testCase.id"
                    class="testcase-card"
                    :class="{ selected: selectedTapdTestCase?.id === testCase.id, 'selected-multi': isSelected(testCase) }"
                    @click="selectTapdTestCase(testCase)"
                  >
                    <label class="select-checkbox" @click.stop>
                      <input type="checkbox" :checked="isSelected(testCase)" @change="toggleSelect(testCase)" />
                      <span></span>
                    </label>
                    <div class="testcase-header">
                      <h4>{{ testCase.title }}</h4>
                      <span class="priority-badge" :class="`priority-${testCase.priority}`">
                        {{ getPriorityText(testCase.priority) }}
                      </span>
                    </div>
                    <p class="testcase-desc">{{ testCase.description }}</p>
                    <div class="testcase-meta">
                      <span class="module">{{ testCase.module }}</span>
                      <span class="owner">{{ testCase.owner }}</span>
                      <span v-if="testCase.mocked" class="mock-badge">模拟数据</span>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="selectedTapdTestCase" class="selected-testcase">
                <h3>测试用例详情</h3>
                <div class="testcase-detail">
                  <div class="detail-header">
                    <h4>{{ selectedTapdTestCase.title }}</h4>
                    <a v-if="selectedTapdTestCase.url" :href="selectedTapdTestCase.url" target="_blank" class="tapd-link">
                      在 TAPD 中查看
                    </a>
                  </div>
                  <p class="detail-desc">{{ selectedTapdTestCase.description }}</p>
                  <div v-if="selectedTapdTestCase.steps.length > 0" class="test-steps">
                    <h5>测试步骤</h5>
                    <ol class="steps-list">
                      <li v-for="step in selectedTapdTestCase.steps" :key="step.step" class="step-item">
                        <div class="step-action">{{ step.action }}</div>
                        <div v-if="step.expected" class="step-expected">期望：{{ step.expected }}</div>
                      </li>
                    </ol>
                  </div>
                  <div v-if="selectedTapdTestCase.expectedResult" class="expected-section">
                    <h5>预期结果</h5>
                    <div class="expected-content">{{ selectedTapdTestCase.expectedResult }}</div>
                  </div>
                  <div class="page-info-section">
                    <h5>页面信息</h5>
                    <div class="form-group">
                      <label>页面名称 *</label>
                      <input 
                        v-model="tapdPageInfo.pageName" 
                        type="text" 
                        :placeholder="`例如: ${selectedTapdTestCase.module}页面`"
                      />
                    </div>
                    <div class="form-group">
                      <label>页面URL *</label>
                      <input 
                        v-model="tapdPageInfo.pageUrl" 
                        type="text" 
                        placeholder="例如: /finance/deposit"
                      />
                    </div>
                    <div class="form-group">
                      <label>页面描述</label>
                      <textarea 
                        v-model="tapdPageInfo.pageDescription" 
                        placeholder="描述该页面的主要功能和特点"
                        rows="3"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="!loadingTapd && tapdTestCases.length === 0" class="empty-state">
                <p>暂无测试用例，请检查 TAPD 配置或筛选条件</p>
              </div>
            </section>
          </div>
        </div>

        <!-- 生成按钮 -->
        <div class="action-section">
          <button 
            @click="generateTestCode" 
            class="generate-btn"
            :disabled="!canGenerate"
          >
            一键生成自动化代码
          </button>
        </div>
      </div>

      <!-- 生成结果展示（应产品需求：暂不展示） -->
      <div v-if="false && generatedCode" class="result-section left-col">
        <h3>生成的测试代码</h3>
        <div class="code-preview">
          <pre><code>{{ generatedCode }}</code></pre>
          <button @click="copyCode" class="copy-btn">复制代码</button>
        </div>
      </div>

      <!-- 右侧：AI步骤过程（含多页签） -->
      <aside class="ai-sidebar">
        <div class="ai-header">
          <span>🤖 AI步骤过程</span>
          <span v-if="isAnalyzing" class="badge running">分析中</span>
          <span v-else-if="stepsList.length > 0 || ruleSummary.steps.length > 0" class="badge done">已生成</span>
        </div>
        <div class="ai-tabs">
          <button :class="['tab', aiTab==='steps' && 'active']" @click="aiTab='steps'">步骤推演</button>
          <button :class="['tab', aiTab==='rules' && 'active']" @click="aiTab='rules'">命中规则</button>
        </div>
        <div class="ai-body">
          <template v-if="aiTab==='steps'">
            <ol class="step-list">
              <li v-for="(line, idx) in stepsList" :key="idx">{{ line }}</li>
            </ol>
            <div v-if="stepsList.length===0" class="empty">生成后这里展示分步骤的关键动作与断言。</div>
          </template>
          <template v-else>
            <div>
              <!-- 调试信息 -->
              <div style="background: #f0f0f0; padding: 8px; margin-bottom: 12px; font-size: 12px; color: #666;">
                <strong>调试信息:</strong><br>
                aiTab: {{ aiTab }}<br>
                stepsList.length: {{ stepsList.length }}<br>
                groupedRules.length: {{ groupedRules.length }}<br>
                ruleSummary.steps.length: {{ ruleSummary.steps?.length || 0 }}<br>
                ruleSummary.expects.length: {{ ruleSummary.expects?.length || 0 }}<br>
                <strong>提取的用例名称:</strong> {{ caseTitles.length ? caseTitles : stepsList.filter(s => s.match(/^\d+\.\s*(.+)$/)).map(s => s.match(/^\d+\.\s*(.+)$/)?.[1]).filter(Boolean) }}<br>
                <strong>分组标题:</strong> {{ groupedRules.map(g => g.title) }}<br>
                stepsList: {{ JSON.stringify(stepsList, null, 2) }}<br>
                groupedRules: {{ JSON.stringify(groupedRules, null, 2) }}
              </div>
              
              <!-- 按用例分组的规则显示 -->
              <div v-if="groupedRules.length > 0" class="grouped-rules">
                <div v-for="(group, groupIdx) in groupedRules" :key="'group-'+groupIdx" class="rule-group">
                  <div class="group-header">
                    <h4>{{ group.title }}</h4>
                    <div class="group-stats">
                      <span class="stat-item">
                        <span class="stat-number">{{ group.steps.filter(s => s.hit).length }}</span>
                        <span class="stat-label">步骤命中</span>
                      </span>
                      <span class="stat-item">
                        <span class="stat-number">{{ group.expects.filter(e => e.hit).length }}</span>
                        <span class="stat-label">预期命中</span>
                      </span>
                    </div>
                  </div>
                  
                  <div class="group-content">
                    <div v-if="group.steps.length > 0" class="rules-section">
                      <h5>步骤规则</h5>
                      <ul class="rule-list">
                        <li v-for="(r, idx) in group.steps" :key="'s-'+groupIdx+'-'+idx" :class="r.hit ? 'hit' : 'miss'">
                          <span class="badge" :class="r.hit ? 'done' : 'running'">{{ r.hit ? '命中' : '未命中' }}</span>
                          <span class="text">{{ r.text }}</span>
                          <span class="rule">{{ r.rule }}</span>
                        </li>
                      </ul>
                    </div>
                    
                    <div v-if="group.expects.length > 0" class="rules-section">
                      <h5>预期规则</h5>
                      <ul class="rule-list">
                        <li v-for="(r, idx) in group.expects" :key="'e-'+groupIdx+'-'+idx" :class="r.hit ? 'hit' : 'miss'">
                          <span class="badge" :class="r.hit ? 'done' : 'running'">{{ r.hit ? '命中' : '未命中' }}</span>
                          <span class="text">{{ r.text }}</span>
                          <span class="rule">{{ r.rule }}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 兜底显示：如果没有分组数据，显示原始格式 -->
              <div v-else class="fallback-rules">
                <h4>步骤规则</h4>
                <ul class="rule-list">
                  <li v-for="(r, idx) in ruleSummary.steps" :key="'s-'+idx" :class="r.hit ? 'hit' : 'miss'">
                    <span class="badge" :class="r.hit ? 'done' : 'running'">{{ r.hit ? '命中' : '未命中' }}</span>
                    <span class="text">{{ r.text }}</span>
                    <span class="rule">{{ r.rule }}</span>
                  </li>
                </ul>
                <h4 style="margin-top:12px;">预期规则</h4>
                <ul class="rule-list">
                  <li v-for="(r, idx) in ruleSummary.expects" :key="'e-'+idx" :class="r.hit ? 'hit' : 'miss'">
                    <span class="badge" :class="r.hit ? 'done' : 'running'">{{ r.hit ? '命中' : '未命中' }}</span>
                    <span class="text">{{ r.text }}</span>
                    <span class="rule">{{ r.rule }}</span>
                  </li>
                </ul>
              </div>
              
              <!-- 提Bug按钮 -->
              <div class="bug-report-section" v-if="ruleSummary.steps.length > 0 || ruleSummary.expects.length > 0">
                <button @click="openBugDialog" class="bug-report-btn">
                  🐛 基于此规则提 Bug
                </button>
              </div>
            </div>
          </template>
        </div>
        <div class="ai-footer">
          <button class="btn ghost" @click="clearAnalysis">清空</button>
          <button class="btn primary" @click="generateTestCode">重新生成</button>
        </div>
      </aside>
    </div>
    
    <!-- 提Bug弹窗 -->
    <div v-if="bugDialog.visible" class="bug-modal" @click="closeBugDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>提 Bug - 基于测试规则</h3>
          <button @click="closeBugDialog" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>标题</label>
            <input v-model="bugForm.title" />
          </div>
          <!-- 隐藏优先级和严重程度选择，使用默认值 -->
          <div class="form-row">
            <label>指派给</label>
            <input v-model="bugForm.owner" placeholder="TAPD 用户名（可选）" />
          </div>
          <div class="form-row">
            <label>Bug描述</label>
            <textarea v-model="bugForm.description" rows="12"></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn ghost" @click="closeBugDialog">取消</button>
            <button class="btn primary" @click="submitBug" :disabled="bugSubmitting">{{ bugSubmitting ? '提交中...' : '提交' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

interface UploadedFile {
  name: string
  size: number
  type: string
}

interface ManualInput {
  pageName: string
  pageUrl: string
  pageDescription: string
  testCaseBody?: string
}

const inputMethod = ref<'tapd' | 'manual' | 'file'>('tapd')
const uploadedFiles = ref<Record<string, UploadedFile>>({})
const manualInput = ref<ManualInput>({
  pageName: '',
  pageUrl: '',
  pageDescription: '',
  testCaseBody: ''
})
const generatedCode = ref('')
const isAnalyzing = ref(false)

// Bug提交相关
const bugDialog = ref<{ visible: boolean }>({ visible: false })
const bugSubmitting = ref(false)
const bugForm = ref<{ title: string; severity: number; priority: number; owner?: string; description: string }>({
  title: '',
  severity: 3, // 一般
  priority: 3, // 中
  owner: '',
  description: ''
})
const aiTab = ref<'steps'|'rules'>('steps')
const stepsList = ref<string[]>([])
// 存储从进度事件中提取的“用例标题”（例如："1. 基础押金创建流程"）
const caseTitles = ref<string[]>([])
const ruleSummary = ref<{ steps: any[]; expects: any[] }>({ steps: [], expects: [] })
// 已迁移为SSE流式推送，以下占位变量不再使用
// 保留声明避免潜在引用报错
let analyzingTimer: any = null; void analyzingTimer
let analyzingPhaseIndex = 0; void analyzingPhaseIndex

const testCaseFileInput = ref<HTMLInputElement>()
const screenshotFileInput = ref<HTMLInputElement>()

// TAPD 相关
interface TapdTestCase {
  id: string
  title: string
  description: string
  steps: Array<{ step: number; action: string; expected: string }>
  expectedResult: string
  priority: number
  status: string
  module: string
  owner: string
  created: string
  modified: string
  url: string
  mocked?: boolean
  raw?: any
}

interface TapdFilters {
  module: string
}

interface TapdPageInfo {
  pageName: string
  pageUrl: string
  pageDescription: string
}

const tapdTestCases = ref<TapdTestCase[]>([])
const selectedTapdTestCase = ref<TapdTestCase | null>(null)
const selectedTapdTestCases = ref<TapdTestCase[]>([])
const loadingTapd = ref(false)
const loadingFilters = ref(false)
const tapdFilters = ref<TapdFilters>({
  module: ''
})
const tapdPageInfo = ref<TapdPageInfo>({
  pageName: '',
  pageUrl: '',
  pageDescription: ''
})

// 筛选选项
interface FilterOption {
  id: string
  name: string
  parent_id?: string
  children?: FilterOption[]
}

interface FilterOptions {
  modules: FilterOption[]
  statuses: FilterOption[]
  owners: FilterOption[]
  mocked?: boolean
}

const filterOptions = ref<FilterOptions>({
  modules: [],
  statuses: [],
  owners: []
})

// 层级展示相关数据
const showModuleDropdown = ref(false)
const selectedModuleName = ref('')
const expandedModules = ref(new Set<string>())

// 计算根级模块：parent_id 为空或其 parent_id 不在模块 id 集合中
const rootModules = computed(() => {
  const modules = filterOptions.value.modules || []
  if (!modules.length) return []

  const idSet = new Set(modules.map(m => m.id))
  return modules.filter(m => !m.parent_id || !idSet.has(m.parent_id))
})



// 按用例分组的规则数据
const groupedRules = computed(() => {
  if (!ruleSummary.value.steps && !ruleSummary.value.expects) return []
  
  // 定义用例组类型
  interface CaseGroup {
    title: string
    steps: any[]
    expects: any[]
  }
  
  const allSteps = ruleSummary.value.steps || []
  const allExpects = ruleSummary.value.expects || []
  const caseGroups: CaseGroup[] = []
  let currentGroupIndex = -1
  
  // 辅助函数：从步骤推演中提取测试用例名称
  const extractTestCaseName = (): string[] => {
    const caseNames: string[] = []
    
    // 从步骤推演列表中查找用例名称
    stepsList.value.forEach((step) => {
      // 匹配格式：数字. 用例名称
      const caseMatch = step.match(/^(\d+)\.\s*(.+)$/)
      if (caseMatch) {
        const caseName = caseMatch[2].trim()
        if (caseName && !caseNames.includes(caseName)) {
          caseNames.push(caseName)
        }
      }
    })
    
    return caseNames
  }
  
  // 辅助函数：判断是否是新用例的开始
  const isNewCaseStart = (ruleText: string, currentTitle?: string): { isNew: boolean; title?: string } => {
    // 页面进入操作通常是新用例的开始
    if (ruleText.includes("进入") && ruleText.includes("页面")) {
      return { isNew: true, title: "基础押金创建流程" }
    }
    
    // 弹窗打开操作
    if (ruleText.includes("打开") && ruleText.includes("弹窗")) {
      return { isNew: true, title: "弹窗打开操作" }
    }
    
    // 字段输入测试
    if (ruleText.includes("输入") && ruleText.includes("字符")) {
      if (!currentTitle || !currentTitle.includes("字段输入")) {
        return { isNew: true, title: "字段输入测试" }
      }
    }
    
    // 清空字段操作
    if (ruleText.includes("清空")) {
      if (!currentTitle || !currentTitle.includes("字段操作")) {
        return { isNew: true, title: "字段操作测试" }
      }
    }
    
    // 选项切换操作
    if (ruleText.includes("按应付百分比") || ruleText.includes("按固定金额")) {
      if (!currentTitle || !currentTitle.includes("选项切换")) {
        return { isNew: true, title: "选项切换测试" }
      }
    }
    
    // 负面测试用例
    if (ruleText.includes("不填写任何内容")) {
      return { isNew: true, title: "负面测试 - 空值验证" }
    }
    
    // 正常流程测试
    if (ruleText.includes("填写完整信息")) {
      return { isNew: true, title: "正常流程测试" }
    }
    
    // 关闭操作测试
    if (ruleText.includes("取消") || ruleText.includes("关闭")) {
      if (!currentTitle || !currentTitle.includes("关闭操作")) {
        return { isNew: true, title: "关闭操作测试" }
      }
    }
    
    return { isNew: false }
  }
  
  // 首先使用实时抽取到的用例标题（优先级最高）；若没有则再从 stepsList 中提取
  const extractedCaseNames = (caseTitles.value && caseTitles.value.length)
    ? caseTitles.value
    : extractTestCaseName()
  
  if (extractedCaseNames.length > 0) {
    // 如果找到了用例名称，按用例名称分组
    extractedCaseNames.forEach((caseName, index) => {
      caseGroups[index] = {
        title: caseName,
        steps: [],
        expects: []
      }
    })
    
    // 将规则按用例数量平均分配
    const stepsPerCase = Math.ceil(allSteps.length / extractedCaseNames.length)
    const expectsPerCase = Math.ceil(allExpects.length / extractedCaseNames.length)
    
    caseGroups.forEach((group, groupIndex) => {
      const startStep = groupIndex * stepsPerCase
      const endStep = Math.min(startStep + stepsPerCase, allSteps.length)
      group.steps = allSteps.slice(startStep, endStep)
      
      const startExpect = groupIndex * expectsPerCase
      const endExpect = Math.min(startExpect + expectsPerCase, allExpects.length)
      group.expects = allExpects.slice(startExpect, endExpect)
    })
  } else {
    // 如果没有找到用例名称，使用智能分组
    allSteps.forEach((stepRule) => {
      const currentTitle = currentGroupIndex >= 0 ? caseGroups[currentGroupIndex]?.title : undefined
      const { isNew, title } = isNewCaseStart(stepRule.text, currentTitle)
      
      if (isNew && title) {
        // 创建新的用例组
        currentGroupIndex++
        caseGroups[currentGroupIndex] = {
          title,
          steps: [stepRule],
          expects: []
        }
      } else {
        // 添加到当前组，如果没有组则创建默认组
        if (currentGroupIndex < 0) {
          currentGroupIndex = 0
          caseGroups[currentGroupIndex] = {
            title: '基础功能测试',
            steps: [stepRule],
            expects: []
          }
        } else {
          caseGroups[currentGroupIndex].steps.push(stepRule)
        }
      }
    })
  }
  
  // 如果没有创建任何分组，创建默认分组
  if (caseGroups.length === 0) {
    caseGroups.push({
      title: '测试用例',
      steps: allSteps,
      expects: allExpects
    })
    return caseGroups
  }
  
  // 将预期规则分配到相关的用例组
  allExpects.forEach((expectRule) => {
    let assigned = false
    
    // 尝试根据文本内容匹配到相应的用例组
    for (let i = 0; i < caseGroups.length; i++) {
      const group = caseGroups[i]
      
      // 检查预期规则是否与该组的步骤规则相关
      const isRelated = group.steps.some(stepRule => {
        const stepText = stepRule.text.toLowerCase()
        const expectText = expectRule.text.toLowerCase()
        
        // 相同关键词匹配
        if (stepText.includes("弹窗") && expectText.includes("弹窗")) return true
        if (stepText.includes("输入") && expectText.includes("输入")) return true
        if (stepText.includes("字符") && expectText.includes("字符")) return true
        if (stepText.includes("选项") && expectText.includes("选项")) return true
        if (stepText.includes("取消") && expectText.includes("取消")) return true
        if (stepText.includes("确定") && expectText.includes("确定")) return true
        
        return false
      })
      
      if (isRelated) {
        group.expects.push(expectRule)
        assigned = true
        break
      }
    }
    
    // 如果没有匹配到相关组，添加到第一个组
    if (!assigned && caseGroups.length > 0) {
      caseGroups[0].expects.push(expectRule)
    }
  })
  
  return caseGroups.filter(group => group.steps.length > 0 || group.expects.length > 0)
})

function triggerFileUpload(type: string) {
  if (type === 'testCase') {
    testCaseFileInput.value?.click()
  } else if (type === 'screenshot') {
    screenshotFileInput.value?.click()
  }
}

function handleFileUpload(type: string, event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    uploadedFiles.value[type] = {
      name: file.name,
      size: file.size,
      type: file.type
    }
  }
}

function removeFile(type: string) {
  delete uploadedFiles.value[type]
}

function clearAnalysis() {
  stepsList.value = []
  ruleSummary.value = { steps: [], expects: [] }
  generatedCode.value = ''
}

async function generateTestCode() {
  try {
    isAnalyzing.value = true
    aiTab.value = 'steps'
    stepsList.value = []
    caseTitles.value = []
    ruleSummary.value = { steps: [], expects: [] } // 重置规则摘要

    // 使用流式接口，实时接收AI思考/步骤
    // 仅发送精简的 TAPD 用例字段，避免请求体过大
    const selectedList = selectedTapdTestCases.value.length > 0 
      ? selectedTapdTestCases.value 
      : (selectedTapdTestCase.value ? [selectedTapdTestCase.value] : [])
    const slimSelected = selectedList.map(tc => ({
      id: tc.id,
      title: tc.title,
      module: tc.module,
      expectedResult: tc.expectedResult,
      steps: (tc.steps || []).map(s => ({ step: s.step, action: s.action, expected: s.expected }))
    }))
    const selectedMeta = selectedList.map(tc => ({ id: tc.id, title: tc.title }))

    const response = await fetch('http://localhost:3002/api/generate-test-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputMethod: inputMethod.value,
        files: uploadedFiles.value,
        manualInput: manualInput.value,
        tapdPageInfo: tapdPageInfo.value,
        tapdSelected: slimSelected,
        tapdSelectedMeta: selectedMeta
      })
    })

    if (!response.ok || !response.body) throw new Error('生成失败')

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let eventCount = 0
    
    console.log('🚀 开始 SSE 流式读取...')
    
    while (true) {
      try {
        console.log('🔄 开始读取下一个数据块...');
        const { value, done } = await reader.read()
        if (done) {
          console.log('🔚 SSE 流结束，done = true');
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        
        console.log(`📦 接收到数据块，长度: ${chunk.length}, 当前缓冲区长度: ${buffer.length}`);
        
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        
        console.log(`🔍 分割出 ${parts.length} 个完整事件块`);
        
        for (const chunk of parts) {
          eventCount++;
          console.log(`📋 处理第 ${eventCount} 个事件块，长度: ${chunk.length}`);
          console.log(`🔍 事件块内容: ${chunk.substring(0, 100)}...`);
          
          const ev = /event:\s*(.*)/.exec(chunk)?.[1]?.trim() || 'message'
          const dataLine = /data:\s*(.*)/s.exec(chunk)?.[1] || '{}'
          let data: any = {}
          
          console.log(`🔍 解析事件类型: ${ev}`);
          console.log(`🔍 数据行长度: ${dataLine.length}`);
          
          // 检查是否有其他事件类型
          if (ev !== 'ping' && ev !== 'progress') {
            console.log(`🎯 发现非 ping/progress 事件: ${ev}`);
          }
          
          // 调试 SSE 解析
          if (ev === 'rules') {
            console.log('🔍 解析 rules 事件:');
            console.log('🔍 chunk:', chunk);
            console.log('🔍 ev:', ev);
            console.log('🔍 dataLine:', dataLine);
          }
          
          // 调试所有 SSE 事件
          console.log(`📥 收到 SSE 事件: ${ev} (第 ${eventCount} 个)`, data);
          
          try { 
            data = JSON.parse(dataLine) 
            if (ev === 'rules') {
              console.log('🔍 JSON 解析成功:', data);
            }
          } catch (e) {
            if (ev === 'rules') {
              console.log('🔍 JSON 解析失败:', e);
              console.log('🔍 原始 dataLine:', dataLine);
            }
          }
          
          // 实时进度：累加到步骤推演
          if (ev === 'progress' && data.message) {
            console.log(`📝 收到进度消息: ${data.message}`);
            stepsList.value = [...stepsList.value, data.message]
            // 提取“1. 用例名称”样式的标题
            const m = String(data.message).match(/^\s*(\d+)\.\s*(.+)$/)
            if (m && m[2]) {
              const title = m[2].trim()
              if (title && !caseTitles.value.includes(title)) {
                caseTitles.value = [...caseTitles.value, title]
                console.log('🧭 记录用例标题:', title)
              }
            }
            console.log(`📊 当前步骤列表长度: ${stepsList.value.length}`);
          }
          if (ev === 'note' && data.text) {
            // 笔记功能已移除，忽略此事件
          }
          if (ev === 'analysis' && data.summary) {
            // 分析功能已移除，忽略此事件
          }
          if (ev === 'rules' && data) {
            // 只要收到 rules 事件就更新，不管是否为空
            console.log('🎯 收到 rules 事件:', data);
            console.log('🎯 data 类型:', typeof data);
            console.log('🎯 data 是否为数组:', Array.isArray(data));
            console.log('🎯 data.steps:', data.steps);
            console.log('🎯 data.expects:', data.expects);
            
            // 确保数据结构正确
            if (data && typeof data === 'object') {
              ruleSummary.value = {
                steps: Array.isArray(data.steps) ? data.steps : [],
                expects: Array.isArray(data.expects) ? data.expects : []
              };
              console.log('🎯 设置后的 ruleSummary:', ruleSummary.value);
            }
            
            // 自动切换到规则页签
            aiTab.value = 'rules';
          }
          if (ev === 'result' && data.code) {
            console.log(`🎯 收到 result 事件，代码长度: ${data.code.length}`);
            generatedCode.value = data.code
            const maybeSteps = Array.isArray(data.steps) ? data.steps : []
            // 只有当服务端提供了结构化步骤时才覆盖；否则保留进度步骤
            if (maybeSteps.length) stepsList.value = maybeSteps
            if (data.file) {
              // 笔记功能已移除，忽略此事件
            }
            if (data.rules && ((data.rules.steps && data.rules.steps.length) || (data.rules.expects && data.rules.expects.length))) {
              ruleSummary.value = data.rules
            }
            console.log(`✅ result 事件处理完成`);
          }
        }
        
        // 强制等待一下，确保事件被处理
        await new Promise(r => setTimeout(r, 10));
        
      } catch (error) {
        console.error('SSE 读取错误:', error);
        break;
      }
    }
    
    console.log('🏁 SSE 流处理完成');
    
  } catch (error) {
    console.error('生成测试代码失败:', error)
    alert('生成失败，请重试')
  } finally {
    isAnalyzing.value = false
  }
}

// 监听步骤列表变化，用于调试
watch(stepsList, (steps) => {
  console.log('步骤列表更新:', steps.length, '个步骤')
})

// Bug提交相关方法
function openBugDialog() {
  bugDialog.value.visible = true
  
  // 构建详细的Bug描述
  const matchedSteps = ruleSummary.value.steps.filter(s => s.hit)
  const unmatchedSteps = ruleSummary.value.steps.filter(s => !s.hit)
  const matchedExpects = ruleSummary.value.expects.filter(e => e.hit)
  const unmatchedExpects = ruleSummary.value.expects.filter(e => !e.hit)
  
  const description = [
    '【测试场景】',
    `- 页面: ${manualInput.value.pageName || manualInput.value.pageUrl || '未指定'}`,
    `- 描述: ${manualInput.value.pageDescription || '无'}`,
    '',
    '【复现步骤】',
    ...stepsList.value.map((step, i) => `${i + 1}. ${step}`),
    '',
    '【期望结果】',
    ...matchedExpects.map(e => `✅ ${e.text} (${e.rule})`),
    ...unmatchedExpects.map(e => `❌ ${e.text} (${e.rule})`),
    '',
    '【实际结果】',
    ...unmatchedSteps.map(s => `❌ ${s.text} - 规则未命中: ${s.rule}`),
    ...unmatchedExpects.map(e => `❌ ${e.text} - 预期未满足: ${e.rule}`),
    '',
    '【规则命中详情】',
    `- 步骤规则命中: ${matchedSteps.length}/${ruleSummary.value.steps.length}`,
    `- 预期规则命中: ${matchedExpects.length}/${ruleSummary.value.expects.length}`,
    '',
    '【生成的测试用例】',
    caseTitles.value.length > 0 ? caseTitles.value.map((title, i) => `${i + 1}. ${title}`).join('\n') : '无',
  ].join('\n')
  
  bugForm.value.title = `[UI自动化] ${manualInput.value.pageName || '页面测试'} - 规则命中问题`
  bugForm.value.description = description
}

function closeBugDialog() {
  bugDialog.value.visible = false
}

async function submitBug() {
  try {
    bugSubmitting.value = true
    
    const matchedSteps = ruleSummary.value.steps.filter(s => s.hit)
    const unmatchedSteps = ruleSummary.value.steps.filter(s => !s.hit)
    const matchedExpects = ruleSummary.value.expects.filter(e => e.hit)
    const unmatchedExpects = ruleSummary.value.expects.filter(e => !e.hit)
    
    const resp = await fetch('http://localhost:3002/api/bugs/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testName: bugForm.value.title,
        pageUrl: manualInput.value.pageUrl,
        env: 'test',
        browser: 'chromium',
        steps: stepsList.value.map(step => ({ text: step, hit: true })),
        expects: matchedExpects,
        unmatchedRules: [...unmatchedSteps, ...unmatchedExpects],
        matchedRules: [...matchedSteps, ...matchedExpects],
        logs: `规则命中情况：步骤 ${matchedSteps.length}/${ruleSummary.value.steps.length}，预期 ${matchedExpects.length}/${ruleSummary.value.expects.length}`,
        attachments: Object.values(uploadedFiles.value || {}).map((f: UploadedFile) => ({
          name: f.name,
          type: f.type,
          size: f.size
        })),
        tapd: { 
          severity: bugForm.value.severity, 
          priority: bugForm.value.priority, 
          owner: bugForm.value.owner 
        },
        executionTime: new Date().toISOString(),
      })
    })
    
    const data = await resp.json()
    if (data?.success && data?.bug) {
      let message = `已创建 Bug：${data.bug.id}`
      if (data.bug.mocked) {
        message += '\n(当前为模拟模式，如需对接真实TAPD，请配置环境变量)'
      }
      alert(message)
      closeBugDialog()
    } else {
      alert(`创建失败：${data?.message || '未知错误'}`)
    }
  } catch (e: any) {
    alert(`创建失败：${e.message}`)
  } finally {
    bugSubmitting.value = false
  }
}

function copyCode() {
  navigator.clipboard.writeText(generatedCode.value)
  alert('代码已复制到剪贴板')
}

// TAPD 相关方法
async function loadFilterOptions() {
  try {
    loadingFilters.value = true
    const response = await fetch('http://localhost:3002/api/tapd/filter-options')
    const data = await response.json()
    
    if (data.success) {
      filterOptions.value = data.data
      console.log('加载的筛选选项:', filterOptions.value)
    } else {
      console.error('加载筛选选项失败:', data.error)
    }
  } catch (error) {
    console.error('加载筛选选项失败:', error)
  } finally {
    loadingFilters.value = false
  }
}

async function loadTapdTestCases() {
  try {
    loadingTapd.value = true
    const params = new URLSearchParams()
    
    if (tapdFilters.value.module) params.append('module', tapdFilters.value.module)
    
    const response = await fetch(`http://localhost:3002/api/tapd/testcases?${params}`)
    const data = await response.json()
    
    if (data.success) {
      tapdTestCases.value = data.data
      console.log('加载的测试用例:', tapdTestCases.value)
    } else {
      alert(`加载失败: ${data.error}`)
    }
  } catch (error) {
    console.error('加载 TAPD 测试用例失败:', error)
    alert('加载失败，请检查网络连接')
  } finally {
    loadingTapd.value = false
  }
}

function selectTapdTestCase(testCase: TapdTestCase) {
  selectedTapdTestCase.value = testCase
  
  // 自动填充页面信息
  tapdPageInfo.value.pageName = `${testCase.module}页面` || '测试页面'
  tapdPageInfo.value.pageUrl = `/${testCase.module.toLowerCase()}` || '/test'
  tapdPageInfo.value.pageDescription = testCase.description || ''
}

function isSelected(testCase: TapdTestCase) {
  return selectedTapdTestCases.value.some(t => t.id === testCase.id)
}

function toggleSelect(testCase: TapdTestCase) {
  const idx = selectedTapdTestCases.value.findIndex(t => t.id === testCase.id)
  if (idx >= 0) {
    selectedTapdTestCases.value.splice(idx, 1)
  } else {
    selectedTapdTestCases.value.push(testCase)
    // 若是首次多选或页面信息为空，自动填充
    if (!selectedTapdTestCase.value) {
      selectedTapdTestCase.value = testCase
    }
    if (!tapdPageInfo.value.pageName) {
      tapdPageInfo.value.pageName = `${testCase.module}页面`
    }
    if (!tapdPageInfo.value.pageUrl) {
      tapdPageInfo.value.pageUrl = `/${testCase.module.toLowerCase()}`
    }
  }
}

function selectAllVisible() {
  const idSet = new Set(selectedTapdTestCases.value.map(t => t.id))
  tapdTestCases.value.forEach(tc => {
    if (!idSet.has(tc.id)) selectedTapdTestCases.value.push(tc)
  })
  // 自动选中第一个并填充页面信息，确保生成按钮可用
  if (!selectedTapdTestCase.value && tapdTestCases.value.length) {
    selectedTapdTestCase.value = tapdTestCases.value[0]
  }
  if (!tapdPageInfo.value.pageName && tapdTestCases.value.length) {
    const tc = tapdTestCases.value[0]
    tapdPageInfo.value.pageName = `${tc.module}页面`
    tapdPageInfo.value.pageUrl = `/${tc.module.toLowerCase()}`
    tapdPageInfo.value.pageDescription = tc.description || ''
  }
}

function invertSelectionVisible() {
  const currentIds = new Set(selectedTapdTestCases.value.map(t => t.id))
  const nextSelected: TapdTestCase[] = []
  tapdTestCases.value.forEach(tc => {
    if (!currentIds.has(tc.id)) nextSelected.push(tc)
  })
  selectedTapdTestCases.value = nextSelected
  // 重置选中详情为第一条，保持页面可生成
  if (nextSelected.length > 0) {
    const tc = nextSelected[0]
    selectedTapdTestCase.value = tc
    tapdPageInfo.value.pageName ||= `${tc.module}页面`
    tapdPageInfo.value.pageUrl ||= `/${tc.module.toLowerCase()}`
    tapdPageInfo.value.pageDescription ||= tc.description || ''
  }
}

function clearSelected() {
  selectedTapdTestCases.value = []
}

function getPriorityText(priority: number): string {
  const map: Record<number, string> = {
    1: '紧急',
    2: '高',
    3: '中',
    4: '低'
  }
  return map[priority] || '中'
}

// 更新 canGenerate 计算属性以支持 TAPD（若多选则也允许生成）
const canGenerate = computed(() => {
  if (inputMethod.value === 'file') {
    return uploadedFiles.value.testCase && uploadedFiles.value.screenshot
  } else if (inputMethod.value === 'tapd') {
    return (selectedTapdTestCase.value || selectedTapdTestCases.value.length > 0) && tapdPageInfo.value.pageName && tapdPageInfo.value.pageUrl
  } else {
    return manualInput.value.pageName && manualInput.value.pageUrl
  }
})

// 层级展示相关方法
function toggleModuleDropdown() {
  showModuleDropdown.value = !showModuleDropdown.value
}

function selectModule(moduleName: string, displayName: string) {
  tapdFilters.value.module = moduleName
  selectedModuleName.value = displayName
  showModuleDropdown.value = false
}

function toggleModule(module: any) {
  if (module.children && module.children.length > 0) {
    if (expandedModules.value.has(module.id)) {
      expandedModules.value.delete(module.id)
    } else {
      expandedModules.value.add(module.id)
    }
  }
}

// 点击外部关闭下拉框
function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement
  if (!target.closest('.module-selector')) {
    showModuleDropdown.value = false
  }
}

// 监听输入方式变化，自动加载筛选选项
watch(inputMethod, (newMethod) => {
  if (newMethod === 'tapd' && filterOptions.value.modules.length === 0) {
    loadFilterOptions()
  }
}, { immediate: true })

// 添加点击外部关闭下拉框的事件监听器
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.create-test-container { max-width: 100%; width: 100%; margin: 0; padding: 0 24px 24px; }

.page-header { display: flex; align-items: baseline; gap: 12px; padding: 20px 8px; }
.page-header h1 { font-size: 28px; color: #111827; margin: 0; font-weight: 700; }
.subtitle { color: #6b7280; font-size: 14px; }

.main-content { display: grid; gap: 16px; }

.two-cols { grid-template-columns: 1.2fr 420px; align-items: start; }

.left-col { display: none; }

.test-generation-section { background: #ffffff; border-radius: 12px; padding: 16px 16px 8px; border: 1px solid #eef2f7; }

.test-generation-section h2 { margin: 4px 0 12px 4px; color: #111827; font-size: 16px; }

.input-method-selector {
  margin-bottom: 24px;
}

.radio-group {
  display: inline-flex;
  align-items: center;
  margin-right: 24px;
  cursor: pointer;
}

.radio-group input {
  margin-right: 8px;
}

.upload-section {
  display: grid;
  gap: 24px;
}

.upload-area h3 {
  margin-bottom: 16px;
  color: #555;
}

.upload-box { border: 1.5px dashed #e5e7eb; border-radius: 10px; padding: 28px 16px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafafa; }
.upload-box:hover { border-color: #60a5fa; background-color: #f8fafc; }

.upload-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  display: block;
}

.format-hint {
  color: #888;
  font-size: 0.9rem;
  margin-top: 8px;
}

.file-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f0f9ff;
  padding: 12px 16px;
  border-radius: 6px;
  margin-top: 16px;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.manual-input-section {
  display: grid;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
}

.form-group input,
.form-group textarea {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.md-area {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  line-height: 1.5;
  background: #0b1220;
  color: #e5e7eb;
  min-height: clamp(180px, 32vh, 420px);
}

.action-section { margin-top: 12px; text-align: left; }
.generate-btn { background: #2563eb; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.generate-btn:hover:not(:disabled) { filter: brightness(0.95); }

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-section { background: white; border-radius: 12px; padding: 20px; border: 1px solid #eef2f7; }

.result-section h3 {
  margin-bottom: 20px;
  color: #333;
}

.code-preview {
  position: relative;
}

.code-preview pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}

.copy-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

/* 自适应优化 */
@media (max-width: 1024px) {
  .test-generation-section {
    padding: 20px;
  }
  .upload-box {
    padding: 28px 16px;
  }
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2rem;
  }
  .subtitle {
    font-size: 1rem;
  }
  .create-test-container {
    padding: 0 12px;
  }
  .test-generation-section h2 {
    font-size: 1.25rem;
  }
  .form-group input,
  .form-group textarea {
    font-size: 0.95rem;
    padding: 10px;
  }
  .generate-btn {
    width: 100%;
    padding: 14px 18px;
  }
}

/* 右侧 AI 思考摘要面板样式 */
.ai-sidebar { position: sticky; top: 12px; height: fit-content; background: #ffffff; border: 1px solid #eef2f7; border-radius: 12px; box-shadow: 0 4px 14px rgba(16,24,40,0.06); display: flex; flex-direction: column; overflow: hidden; }
.ai-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; font-weight: 600; color: #111827; background: #f8fafc; border-bottom: 1px solid #eef2f7; }
.badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.badge.running { background: #e0f2fe; color: #0369a1; }
.badge.done { background: #dcfce7; color: #166534; }
.ai-tabs { display: flex; gap: 6px; padding: 8px 8px 0; background: #f8fafc; }
.tab { flex: 1; background: #f3f4f6; border: 0; padding: 8px; border-radius: 8px 8px 0 0; cursor: pointer; color: #374151; }
.tab.active { background: #ffffff; color: #111827; border: 1px solid #eef2f7; border-bottom-color: transparent; }
.ai-body { padding: 12px; border-top: 1px solid #eef2f7; max-height: 60vh; overflow: auto; }
.pre { white-space: pre-wrap; word-break: break-word; font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; font-size: 13px; line-height: 1.5; color: #374151; }
.step-list { margin: 0; padding-left: 18px; }
.empty { color: #6b7280; font-size: 13px; }
.ai-footer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eef2f7; justify-content: flex-end; }
.btn { border: 0; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
.btn.ghost { background: #f3f4f6; color: #374151; }
.btn.primary { background: #3b82f6; color: white; }
.btn.sm { font-size: 12px; padding: 6px 10px; border: 1px solid #e5e7eb; background: #fff; }
.btn.sm.ghost { background: #f9fafb; }
.rule-list { list-style: none; padding: 0; margin: 0; }
.rule-list li { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px dashed #eef2f7; }
.rule-list li .text { flex: 1; color: #374151; }
.rule-list li .rule { color: #9ca3af; font-size: 12px; }
.rule-list li.hit { background: #f0fdf4; }
.rule-list li.miss { background: #fff7ed; }

/* 分组规则样式 */
.grouped-rules { margin-top: 8px; }
.rule-group { 
  margin-bottom: 16px; 
  border: 1px solid #eef2f7; 
  border-radius: 8px; 
  overflow: hidden; 
  background: #ffffff;
}
.group-header { 
  background: #f8fafc; 
  padding: 12px 16px; 
  border-bottom: 1px solid #eef2f7; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
}
.group-header h4 { 
  margin: 0; 
  font-size: 14px; 
  font-weight: 600; 
  color: #111827; 
}
.group-stats { 
  display: flex; 
  gap: 16px; 
}
.stat-item { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  gap: 2px; 
}
.stat-number { 
  font-size: 16px; 
  font-weight: 600; 
  color: #059669; 
}
.stat-label { 
  font-size: 11px; 
  color: #6b7280; 
}
.group-content { 
  padding: 12px 16px; 
}
.rules-section { 
  margin-bottom: 12px; 
}
.rules-section:last-child { 
  margin-bottom: 0; 
}
.rules-section h5 { 
  margin: 0 0 8px 0; 
  font-size: 12px; 
  font-weight: 500; 
  color: #374151; 
  text-transform: uppercase; 
  letter-spacing: 0.05em; 
}
.fallback-rules { 
  margin-top: 8px; 
}

/* Bug提交样式 */
.bug-report-section {
  margin-top: 16px;
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.bug-report-btn {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
}

.bug-report-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

.bug-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.bug-modal .modal-content {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.bug-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
}

.bug-modal .modal-header h3 {
  margin: 0;
  color: #333;
}

.bug-modal .close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.bug-modal .close-btn:hover {
  background: #f1f5f9;
}

.bug-modal .modal-body {
  padding: 24px;
}

.bug-modal .modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

/* 表单样式 */
.form-row {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row.two {
  flex-direction: row;
  gap: 16px;
}

.form-row.two > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row label {
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.form-row input,
.form-row select,
.form-row textarea {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-row input:focus,
.form-row select:focus,
.form-row textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-row textarea {
  resize: vertical;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.4;
}

/* TAPD 导入相关样式 */
.tapd-import-section {
  display: grid;
  gap: 24px;
}

.tapd-browser { display: grid; grid-template-columns: 320px 1fr; gap: 16px; }

.module-tree-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
  font-weight: 600;
  color: #111827;
}

.tree-reset {
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.tree-scroll { height: calc(100vh - 340px); overflow: auto; }

.tapd-content { min-height: calc(100vh - 340px); }

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  min-width: 120px;
}

/* 层级模块选择器样式 */
.module-selector {
  position: relative;
  min-width: 200px;
}

.module-dropdown {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  font-size: 0.875rem;
}

.module-dropdown:hover {
  border-color: #3b82f6;
}

.module-dropdown.open {
  border-color: #3b82f6;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.selected-module {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-arrow {
  margin-left: 8px;
  transition: transform 0.2s;
  font-size: 12px;
  color: #6b7280;
}

.module-dropdown.open .dropdown-arrow {
  transform: rotate(180deg);
}

.module-tree {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #3b82f6;
  border-top: none;
  border-radius: 0 0 6px 6px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.tree-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.875rem;
}

.tree-item:last-child {
  border-bottom: none;
}

.tree-item:hover { background: #f5faff; }

.tree-item.child { padding-left: 28px; background: transparent; }

.tree-item.grandchild { padding-left: 44px; background: transparent; }

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.tree-toggle {
  width: 16px;
  text-align: center;
  font-size: 12px;
  color: #6b7280;
  user-select: none;
}

.tree-label {
  flex: 1;
  padding: 4px 6px;
  border-radius: 6px;
}

.tree-label.selected {
  color: #1d4ed8;
  font-weight: 600;
  background: #e8f0ff;
}

.tree-children {
  background: transparent;
  border-left: 2px solid #f1f5f9;
  margin-left: 8px;
}

.load-btn {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.load-btn:hover:not(:disabled) {
  background: #2563eb;
}

.load-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.testcase-list {
  margin-top: 16px;
}

.list-toolbar { display: flex; gap: 8px; margin: 8px 0 0 0; }

.testcase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.testcase-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  position: relative;
}

.testcase-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.testcase-card.selected {
  border-color: #3b82f6;
  background: #f8fafc;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.testcase-card.selected-multi {
  outline: 2px solid #3b82f6;
}

.testcase-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.testcase-header h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  flex: 1;
  margin-right: 8px;
}

.priority-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.select-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.select-checkbox input {
  width: 16px;
  height: 16px;
}

.priority-1 { background: #fef2f2; color: #dc2626; }
.priority-2 { background: #fef3c7; color: #d97706; }
.priority-3 { background: #dbeafe; color: #2563eb; }
.priority-4 { background: #f3f4f6; color: #6b7280; }

.testcase-desc {
  margin: 8px 0;
  font-size: 0.8rem;
  color: #6b7280;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.testcase-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 0.75rem;
  color: #9ca3af;
}

.testcase-meta span {
  padding: 2px 6px;
  background: #f3f4f6;
  border-radius: 4px;
}

.mock-badge {
  background: #fef3c7 !important;
  color: #d97706 !important;
}

.selected-testcase {
  margin-top: 24px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.detail-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  flex: 1;
}

.tapd-link {
  color: #3b82f6;
  text-decoration: none;
  font-size: 0.875rem;
  padding: 4px 8px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  transition: all 0.2s;
}

.tapd-link:hover {
  background: #3b82f6;
  color: white;
}

.detail-desc {
  margin: 12px 0;
  color: #6b7280;
  line-height: 1.5;
}

.test-steps {
  margin: 16px 0;
}

.test-steps h5 {
  margin: 0 0 12px 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.steps-list {
  margin: 0;
  padding-left: 20px;
}

.step-item {
  margin-bottom: 8px;
  line-height: 1.4;
}

.step-action {
  font-size: 0.875rem;
  color: #111827;
}

.step-expected {
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 2px;
  font-style: italic;
}

.expected-section { margin: 16px 0; }
.expected-section h5 { margin: 0 0 12px 0; font-size: 0.875rem; font-weight: 600; color: #374151; }
.expected-content { padding: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; color: #374151; }

.page-info-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.page-info-section h5 {
  margin: 0 0 16px 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
  font-size: 0.875rem;
}

.mock-notice {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 6px;
  color: #92400e;
  font-size: 0.8rem;
}
</style>
