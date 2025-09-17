<template>
  <div class="test-execution">
    <!-- 脚本列表区 -->
    <div class="script-list-card">
      <div class="list-header">
        <h2>脚本管理</h2>
        <div class="list-actions">
          <button class="refresh-btn" @click="loadAvailableTestFiles">刷新</button>
          <button class="new-btn" @click="openEditorForNew">新建脚本</button>
        </div>
      </div>

      <div class="run-options">
        <label class="opt-item">
          <input type="checkbox" v-model="visualMode" /> 可视化执行
        </label>
        <label class="opt-item">
          慢速(ms)
          <input class="opt-num" type="number" min="0" step="50" v-model.number="slowMs" placeholder="0" />
        </label>
      </div>

      <!-- 顶部固定的执行进度条（更显眼的位置） -->
      <div v-if="isExecuting" class="exec-sticky">
        <div class="exec-row">
          <div class="spinner" aria-label="executing" />
          <div class="exec-text">
            正在执行：<strong>{{ executingFile?.split('/').pop() }}</strong>
          </div>
        </div>
        <div class="exec-bar"><div class="exec-bar-fill" /></div>
      </div>
      
      <div class="stats-row">
        <div class="kpi">
          <div class="kpi-label">总脚本</div>
          <div class="kpi-value">{{ filesWithMeta.length }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">执行中</div>
          <div class="kpi-value">{{ isExecuting ? 1 : 0 }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">已完成</div>
          <div class="kpi-value">{{ executedTests }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">报告</div>
          <div class="kpi-value">-</div>
        </div>
        </div>

      <div class="table-scroll" ref="tableScrollEl" :style="tableHeight > 0 ? { maxHeight: tableHeight + 'px' } : {}">
        <div class="script-table">
          <table>
          <thead>
            <tr>
              <th style="width: 36px;">#</th>
              <th>脚本信息</th>
              <th>脚本描述</th>
              <th style="width: 120px;">执行统计</th>
              <th style="width: 180px;">更新时间</th>
              <th style="width: 220px;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in pagedFiles" :key="item.path">
              <td>{{ startIndex + index + 1 }}</td>
              <td>
                <div class="script-info">
                  <span class="tag">playwright</span>
                  <div class="name">{{ item.path.split('/').pop() }}</div>
                  <div class="sub">{{ item.path }}</div>
                  <div v-if="isExecuting && executingFile === item.path" class="inline-running">
                    <span class="dot" /> 执行中...
                  </div>
                </div>
              </td>
              <td class="desc">{{ autoDesc(item.path) }}</td>
              <td>{{ runCounts[item.path] || 0 }}</td>
              <td>{{ formatTime(item.updatedAt) }}</td>
              <td>
                <div class="row-actions">
                  <button class="link" @click="runFile(item.path)">执行</button>
                  <button class="link" @click="openEditor(item.path)">编辑</button>
                  <button class="link" @click="openReport()">报告</button>
                  <button class="link danger" @click="deleteFile(item.path)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
          </table>
          </div>
        </div>

      <!-- 分页 -->
      <div class="pagination-bar" v-if="totalItems > 0">
        <div class="pagination-left">共 {{ totalItems }} 条</div>
        <div class="pagination-right">
          <label class="page-size">每页
            <select v-model.number="pageSize">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select> 条
          </label>
          <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">上一页</button>
          <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">下一页</button>
        </div>
      </div>
    </div>

    

    <!-- 执行进度 -->
    <div v-if="isExecuting" class="execution-progress">
      <div class="progress-header">
        <h3>执行进度</h3>
        <span class="progress-status">{{ executionStatus }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: executionProgress + '%' }"></div>
      </div>
      <div class="progress-details">
        <span>已执行: {{ executedTests }}/{{ totalTests }}</span>
        <span>通过: {{ passedTests }}</span>
        <span>失败: {{ failedTests }}</span>
      </div>
    </div>

    <!-- 执行结果 -->
    <div v-if="executionResults.length > 0" class="execution-results">
      <div class="results-header">
        <h2>执行结果</h2>
        <div class="results-summary">
          <span class="summary-item success">通过: {{ passedTests }}</span>
          <span class="summary-item error">失败: {{ failedTests }}</span>
          <span class="summary-item">总计: {{ totalTests }}</span>
          <span class="summary-item">成功率: {{ successRate }}%</span>
        </div>
      </div>

      <!-- 结果列表 -->
      <div class="results-list">
        <div 
          v-for="result in executionResults" 
          :key="result.testFile"
          class="result-item"
          :class="result.success ? 'success' : 'error'"
        >
          <div class="result-header">
            <h4>{{ result.testFile }}</h4>
            <span :class="['status-badge', result.success ? 'success' : 'error']">
              {{ result.success ? '通过' : '失败' }}
            </span>
          </div>
          <div class="result-details">
            <p><strong>执行时间：</strong>{{ result.duration }}ms</p>
            <p v-if="result.error"><strong>错误信息：</strong>{{ result.error }}</p>
            <p v-if="result.analysis"><strong>分析结果：</strong>{{ result.analysis }}</p>
          </div>
          <div class="result-actions">
            <button @click="viewTestDetails(result)" class="detail-btn">查看详情</button>
            <button @click="rerunTest(result)" class="rerun-btn">重新执行</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 测试报告 -->
    <div v-if="testReport" class="test-report">
      <div class="report-header">
        <h2>📊 测试报告</h2>
        <div class="report-actions">
          <button @click="generateReport" class="generate-report-btn">生成报告</button>
          <button @click="downloadReport" class="download-report-btn">下载报告</button>
          <button @click="shareReport" class="share-report-btn">分享报告</button>
        </div>
      </div>

      <!-- 报告内容 -->
      <div class="report-content">
        <!-- 概览统计 -->
        <div class="report-overview">
          <div class="overview-card">
            <h3>测试概览</h3>
            <div class="overview-stats">
              <div class="stat-item">
                <span class="stat-number">{{ testReport.totalTests }}</span>
                <span class="stat-label">总测试数</span>
              </div>
              <div class="stat-item">
                <span class="stat-number success">{{ testReport.passedTests }}</span>
                <span class="stat-label">通过测试</span>
              </div>
              <div class="stat-item">
                <span class="stat-number error">{{ testReport.failedTests }}</span>
                <span class="stat-label">失败测试</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">{{ testReport.successRate }}%</span>
                <span class="stat-label">成功率</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 详细结果 -->
        <div class="report-details">
          <h3>详细结果</h3>
          <div class="details-table">
            <table>
              <thead>
                <tr>
                  <th>测试文件</th>
                  <th>状态</th>
                  <th>执行时间</th>
                  <th>错误信息</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="result in testReport.results" :key="result.testFile">
                  <td>{{ result.testFile }}</td>
                  <td>
                    <span :class="['status-indicator', result.success ? 'success' : 'error']">
                      {{ result.success ? '通过' : '失败' }}
                    </span>
                  </td>
                  <td>{{ result.duration }}ms</td>
                  <td>{{ result.error || '-' }}</td>
                  <td>
                    <button @click="viewTestDetails(result)" class="action-btn">详情</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 改进建议 -->
        <div v-if="testReport.recommendations" class="report-recommendations">
          <h3>改进建议</h3>
          <div class="recommendations-list">
            <div v-for="(rec, index) in testReport.recommendations" :key="index" class="recommendation-item">
              <span class="rec-icon">💡</span>
              <span class="rec-text">{{ rec }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 测试详情模态框 -->
    <div v-if="showTestDetails" class="modal-overlay" @click="closeTestDetails">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>测试详情</h3>
          <button @click="closeTestDetails" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div v-if="selectedTestDetail" class="test-detail-content">
            <div class="detail-section">
              <h4>基本信息</h4>
              <p><strong>文件路径：</strong>{{ selectedTestDetail.testFile }}</p>
              <p><strong>执行状态：</strong>{{ selectedTestDetail.success ? '通过' : '失败' }}</p>
              <p><strong>执行时间：</strong>{{ selectedTestDetail.duration }}ms</p>
            </div>
            
            <div v-if="selectedTestDetail.error" class="detail-section">
              <h4>错误信息</h4>
              <pre class="error-message">{{ selectedTestDetail.error }}</pre>
            </div>
            
            <div v-if="selectedTestDetail.analysis" class="detail-section">
              <h4>分析结果</h4>
              <p>{{ selectedTestDetail.analysis }}</p>
            </div>
            
            <div v-if="selectedTestDetail.stdout" class="detail-section">
              <h4>标准输出</h4>
              <pre class="stdout-content">{{ selectedTestDetail.stdout }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 右侧：AI 思考摘要（固定悬浮） -->
  <div class="insight-panel">
    <div class="insight-header">
      <span>🧠 AI 思考摘要</span>
      <span v-if="isExecuting" class="insight-badge running">分析中</span>
      <span v-else-if="currentAnalysis" class="insight-badge done">已生成</span>
    </div>
    <div class="insight-body">
      <pre class="insight-pre">{{ currentAnalysis || '执行后这里会显示AI对执行输出与日志的摘要。' }}</pre>
    </div>
  </div>
  <!-- 编辑脚本模态框 -->
  <div v-if="showEditor" class="modal-overlay" @click="() => { showEditor = false; disposeMonaco() }">
    <div class="modal-content wide" @click.stop>
      <div class="modal-header">
        <h3>编辑脚本</h3>
        <button @click="() => { showEditor = false; disposeMonaco() }" class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>脚本名称 *</label>
            <input v-model="editorMeta.name" placeholder="请输入脚本名称" />
          </div>
          <div class="form-group">
            <label>分类 *</label>
            <input v-model="editorMeta.category" placeholder="功能测试/回归测试…" />
          </div>
          <div class="form-group">
            <label>优先级 *</label>
            <input v-model.number="editorMeta.priority" type="number" min="1" placeholder="1" />
          </div>
          <div class="form-group span-2">
            <label>标签</label>
            <input v-model="editorMeta.tags" placeholder="逗号分隔，如：登录,支付" />
          </div>
          <div class="form-group span-2">
            <label>脚本内容（TypeScript）</label>
            <div ref="monacoMountEl" class="code-area" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="page-btn" @click="showEditor = false">取消</button>
        <button class="new-btn" @click="saveScript">保存</button>
      </div>
    </div>
  </div>
 
 </template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
// @ts-ignore
import loader from '@monaco-editor/loader'
// 直接引入 monaco，避免 CDN 路径问题
// @ts-ignore
import * as monacoBundle from 'monaco-editor'

// 响应式数据
const selectedTestFile = ref('')
const isExecuting = ref(false)
const executionStatus = ref('')
const executionProgress = ref(0)
const executedTests = ref(0)
const totalTests = ref(0)
const passedTests = ref(0)
const failedTests = ref(0)
const executionResults = ref<any[]>([])
const testReport = ref<any>(null)
const showTestDetails = ref(false)
const selectedTestDetail = ref<any>(null)
const currentAnalysis = ref('')

// 可用测试文件
type FileItem = { path: string; updatedAt: number; runs?: number }
const filesWithMeta = ref<FileItem[]>([])
const runCounts = ref<Record<string, number>>({})

// 列表自适应高度（根据视窗与当前位置动态计算最大高度）
const tableScrollEl = ref<HTMLElement | null>(null)
const tableHeight = ref(0)
const GAP_BOTTOM = 24 // 底部保留空白
const computeTableHeight = () => {
  try {
    const top = tableScrollEl.value?.getBoundingClientRect().top || 0
    const h = window.innerHeight - top - GAP_BOTTOM
    tableHeight.value = h > 240 ? h : 240 // 保底高度
  } catch {}
}

// 分页
const currentPage = ref(1)
const pageSize = ref(10)
const totalItems = computed(() => filesWithMeta.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))
const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
const pagedFiles = computed(() => filesWithMeta.value.slice(startIndex.value, startIndex.value + pageSize.value))

const prevPage = () => { if (currentPage.value > 1) currentPage.value-- }
const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++ }

// 执行选项
const executionOptions = ref({
  headless: true,
  parallel: false,
  retry: true
})
const visualMode = ref(true)
const slowMs = ref(0)

// 计算属性
const canExecute = computed(() => {
  return !!selectedTestFile.value || filesWithMeta.value.length > 0
})

const successRate = computed(() => {
  if (totalTests.value === 0) return 0
  return Math.round((passedTests.value / totalTests.value) * 100)
})

// 方法
// 通用带超时的 fetch，避免请求异常导致前端一直处于执行中
const fetchWithTimeout = async (url: string, options: any = {}, timeoutMs = 180000) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal })
    return resp
  } finally {
    clearTimeout(id)
  }
}
const executeTest = async () => {
  if (!canExecute.value) return
  
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
      // 规范化：将 stdout/stderr 提升到顶层，便于前端展示
      const normalized = {
        ...result,
        stdout: result?.result?.stdout,
        stderr: result?.result?.stderr
      }
      executionResults.value = [normalized]
      currentAnalysis.value = result.analysis || ''
      updateExecutionStats()
    } else {
      throw new Error('执行失败')
    }
  } catch (error) {
    console.error('执行测试失败:', error)
    alert('执行失败，请重试')
  } finally {
    isExecuting.value = false
  }
}

async function mountMonaco() {
  try {
    if (!monacoMountEl.value) return
    // 绑定到本地打包的 monaco，避免资源加载不到
    loader.config({ monaco: monacoBundle })
    const monaco = await loader.init()
    monacoEditor = monaco.editor.create(monacoMountEl.value, {
      value: editorContent.value,
      language: 'typescript',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      scrollBeyondLastLine: false,
    })
    // 若已有内容，确保同步到编辑器（双保险）
    if (editorContent.value) {
      monacoEditor.setValue(editorContent.value)
    }
  } catch (e) {
    console.error('初始化 Monaco 失败:', e)
  }
}

function disposeMonaco() {
  try {
    if (monacoEditor && typeof monacoEditor.dispose === 'function') {
      monacoEditor.dispose()
    }
    monacoEditor = null
  } catch {}
}

// 运行指定文件的便捷方法
const runFile = async (file: string) => {
  selectedTestFile.value = file
  executingFile.value = file
  // 调用后端以 headed 模式执行
  try {
    isExecuting.value = true
    const resp = await fetchWithTimeout('http://localhost:3002/api/execute-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testFile: file, options: { headed: visualMode.value } })
    }, 300000) // 最长 5 分钟
    if (!resp.ok) throw new Error('后端执行失败')
    // 读取一次结果，确保请求完整结束
    await resp.json().catch(() => ({}))
    // 本地计数+1（简单统计）
    const key = file
    runCounts.value[key] = (runCounts.value[key] || 0) + 1
  } catch (e) {
    console.error('可视化执行失败:', e)
  } finally {
    isExecuting.value = false
    executingFile.value = null
    // 刷新一次计数与文件元信息，避免进度条卡住
    fetchRunCounts()
    loadAvailableTestFiles()
    // 双保险：下一个事件循环再次复位
    setTimeout(() => { isExecuting.value = false; executingFile.value = null }, 0)
  }
}

// 已移除批量执行与停止逻辑（当需要时可恢复）

const updateExecutionStats = () => {
  totalTests.value = executionResults.value.length
  passedTests.value = executionResults.value.filter(r => r.success).length
  failedTests.value = executionResults.value.filter(r => !r.success).length
  executedTests.value = totalTests.value
  executionProgress.value = 100
}

const generateTestReport = () => {
  testReport.value = {
    totalTests: totalTests.value,
    passedTests: passedTests.value,
    failedTests: failedTests.value,
    successRate: successRate.value,
    results: executionResults.value,
    recommendations: generateRecommendations()
  }
}

const generateRecommendations = () => {
  const recommendations = []
  
  if (failedTests.value > 0) {
    recommendations.push('建议检查失败测试的页面元素选择器是否正确')
    recommendations.push('考虑增加等待时间或重试机制')
  }
  
  if (successRate.value < 80) {
    recommendations.push('测试成功率较低，建议优化测试用例')
  }
  
  if (executionResults.value.some(r => r.duration > 10000)) {
    recommendations.push('部分测试执行时间较长，建议优化测试性能')
  }
  
  return recommendations
}

const viewTestDetails = (result: any) => {
  selectedTestDetail.value = result
  showTestDetails.value = true
}

const closeTestDetails = () => {
  showTestDetails.value = false
  selectedTestDetail.value = null
}

const rerunTest = async (result: any) => {
  selectedTestFile.value = result.testFile
  await executeTest()
}

const generateReport = () => {
  generateTestReport()
}

const downloadReport = () => {
  if (!testReport.value) return
  
  const reportData = {
    timestamp: new Date().toISOString(),
    ...testReport.value
  }
  
  const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `test-report-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const shareReport = () => {
  if (!testReport.value) return
  
  const reportText = `
测试报告
总测试数: ${testReport.value.totalTests}
通过测试: ${testReport.value.passedTests}
失败测试: ${testReport.value.failedTests}
成功率: ${testReport.value.successRate}%
  `.trim()
  
  if (navigator.share) {
    navigator.share({
      title: '测试执行报告',
      text: reportText
    })
  } else {
    navigator.clipboard.writeText(reportText)
    alert('报告已复制到剪贴板')
  }
}

// 打开「报告」占位
const openReport = () => {
  window.open('http://localhost:9323', '_blank')
}

// 简易编辑器逻辑
const showEditor = ref(false)
const editorFile = ref('')
const editorContent = ref('')
const executingFile = ref<string | null>(null)
const editorMeta = ref<{ name?: string; category?: string; priority?: number; tags?: string }>({})
// Monaco
const monacoMountEl = ref<HTMLElement | null>(null)
let monacoEditor: any = null

const openEditor = async (file: string) => {
  try {
    const resp = await fetch(`http://localhost:3002/api/script?file=${encodeURIComponent(file)}`)
    const data = await resp.json()
    if (resp.ok && data.success) {
      editorFile.value = file
      editorContent.value = data.content
      editorMeta.value = data.meta || {}
      showEditor.value = true
      await nextTick()
      await mountMonaco()
    } else {
      console.error('读取脚本失败:', data)
      alert(data.message || data.error || '读取脚本失败')
    }
  } catch (e) {
    console.error('脚本读取异常:', e)
    alert('读取脚本失败')
  }
}

const openEditorForNew = () => {
  editorFile.value = 'tests/generated/new-test.spec.ts'
  editorContent.value = `import { test, expect } from '@playwright/test';\n\n test('示例', async ({ page }) => {\n   await page.goto('/');\n   await expect(page).toBeTruthy();\n });\n`
  editorMeta.value = { name: '新脚本', category: '功能测试', priority: 1, tags: '' }
  showEditor.value = true
  nextTick().then(mountMonaco)
}

// 编辑器保存逻辑暂未接入界面，因此移除避免未使用告警

const deleteFile = async (file: string) => {
  if (!confirm(`确定删除脚本 ${file} 吗？`)) return
  try {
    const resp = await fetch(`http://localhost:3002/api/script?file=${encodeURIComponent(file)}`, { method: 'DELETE' })
    const data = await resp.json()
    if (data.success) {
      await loadAvailableTestFiles()
    } else {
      alert(data.message || '删除失败')
    }
  } catch (e) {
    alert('删除失败')
  }
}

// 保存脚本
const saveScript = async () => {
  try {
    const resp = await fetch('http://localhost:3002/api/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: editorFile.value, content: monacoEditor ? monacoEditor.getValue() : editorContent.value, meta: editorMeta.value })
    })
    const data = await resp.json()
    if (data.success) {
      showEditor.value = false
      disposeMonaco()
      await loadAvailableTestFiles()
    } else {
      alert(data.message || '保存失败')
    }
  } catch (e) {
    alert('保存失败')
  }
}

// 自动描述
const autoDesc = (file: string): string => {
  if (!file) return ''
  const base = file.split('/').pop() || file
  if (base.includes('login')) return '测试登录业务: 输入用户名和密码，验证登录成功'
  if (base.includes('waybill')) return '运单相关测试用例'
  if (base.includes('finance')) return '财务相关测试用例'
  return '自动化测试脚本'
}

const formatTime = (ts: number): string => {
  if (!ts) return '-'
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(() => {
  // 初始化时加载可用的测试文件
  loadAvailableTestFiles()
  fetchRunCounts()
  computeTableHeight()
  window.addEventListener('resize', computeTableHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', computeTableHeight)
})

const loadAvailableTestFiles = async () => {
  try {
    const response = await fetch('http://localhost:3002/api/available-tests')
    if (response.ok) {
      const data = await response.json()
      filesWithMeta.value = (data.files || [])
        .map((x: any) => ({ path: x.path || x, updatedAt: x.updatedAt || Date.now(), runs: x.runs || 0 }))
        // 按更新时间倒序（最新在前）
        .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))
      // 合并到本地 runCounts
      for (const item of filesWithMeta.value) {
        runCounts.value[item.path] = item.runs || 0
      }
    }
  } catch (error) {
    console.error('加载测试文件失败:', error)
  }
}

// 拉取运行统计文件，保障刷新后仍能显示历史执行次数
const fetchRunCounts = async () => {
  try {
    const resp = await fetch('http://localhost:3002/api/run-counts')
    if (resp.ok) {
      const data = await resp.json()
      const counts = data.counts || {}
      runCounts.value = { ...runCounts.value, ...counts }
    }
  } catch (e) {
    // 忽略错误，不影响页面
  }
}
</script>

<style scoped>
.test-execution {
  width: 100%;
  margin: 0;
}

.script-list-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem 1.5rem 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.06);
  margin-bottom: 1.5rem;
}

.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.list-header h2 { margin: 0; font-size: 1.2rem; }
.list-actions { display: flex; gap: .5rem; }
.refresh-btn, .new-btn { border: none; background: #f1f5f9; padding: .5rem .8rem; border-radius: 6px; cursor: pointer; }
.new-btn { background: #3b82f6; color: white; }

.run-options { display: flex; align-items: center; gap: 1rem; margin: .5rem 0 1rem; }
.opt-item { display: inline-flex; align-items: center; gap: .5rem; color: #475569; }
.opt-num { width: 90px; padding: .35rem .5rem; border: 1px solid #e5e7eb; border-radius: 6px; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; margin-bottom: 1rem; }
.kpi { background: #f8fafc; border: 1px solid #eef2f7; border-radius: 8px; padding: .75rem; }
.kpi-label { color: #64748b; font-size: .85rem; }
.kpi-value { font-weight: 700; color: #111827; font-size: 1.25rem; }

.table-scroll { max-height: 55vh; overflow: auto; border: 1px solid #eef2f7; border-radius: 8px; }
.script-table { overflow-x: auto; }
.script-table table { width: 100%; border-collapse: collapse; }
.script-table th, .script-table td { padding: .75rem; border-bottom: 1px solid #eef2f7; text-align: left; }
.tag { display: inline-block; background: #eef2ff; color: #4f46e5; padding: 2px 8px; border-radius: 12px; font-size: .75rem; margin-right: .5rem; }
.script-info .name { font-weight: 600; color: #111827; }
.script-info .sub { color: #64748b; font-size: .85rem; }
.desc { color: #6b7280; }
.row-actions { display: flex; gap: .5rem; }
.row-actions .link { background: none; border: none; color: #2563eb; cursor: pointer; padding: 0; }
.row-actions .danger { color: #dc2626; }

.exec-sticky { position: sticky; top: 0; z-index: 5; background: #f8fafc; padding: .75rem 0; border-bottom: 1px solid #e5e7eb; margin-bottom: .5rem; }
.exec-row { display: flex; align-items: center; gap: .5rem; margin-bottom: .5rem; }
.spinner { width: 14px; height: 14px; border: 2px solid #93c5fd; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
.exec-text { color: #374151; font-size: .9rem; }
.exec-bar { width: 100%; height: 6px; background: #e5e7eb; border-radius: 6px; overflow: hidden; }
.exec-bar-fill { width: 40%; height: 100%; background: linear-gradient(90deg,#60a5fa,#3b82f6); animation: progress 1.4s ease-in-out infinite; }
@keyframes progress { 0% { transform: translateX(-40%);} 50% { transform: translateX(20%);} 100% { transform: translateX(100%);} }
@keyframes spin { to { transform: rotate(360deg);} }

.inline-running { display: inline-flex; align-items: center; gap: 6px; color: #2563eb; font-size: .85rem; margin-top: .25rem; }
.inline-running .dot { width: 6px; height: 6px; background: #2563eb; border-radius: 50%; animation: blink 1s ease-in-out infinite; }
@keyframes blink { 0%,100% { opacity: .2 } 50% { opacity: 1 } }

.pagination-bar { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; }
.pagination-right { display: flex; align-items: center; gap: .75rem; }
.page-btn { border: 1px solid #e5e7eb; background: #fff; padding: .35rem .8rem; border-radius: 6px; cursor: pointer; }
.page-btn:disabled { opacity: .5; cursor: not-allowed; }
.page-size select { margin: 0 .25rem; }



.execution-progress {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.progress-status {
  color: #3498db;
  font-weight: 600;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #45a049);
  transition: width 0.3s ease;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  color: #666;
  font-size: 0.9rem;
}

.execution-results {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.results-summary {
  display: flex;
  gap: 1rem;
}

.summary-item {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9rem;
}

.summary-item.success {
  background: #d4edda;
  color: #155724;
}

.summary-item.error {
  background: #f8d7da;
  color: #721c24;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.result-item.success {
  border-left: 4px solid #28a745;
  background: #f8fff9;
}

.result-item.error {
  border-left: 4px solid #dc3545;
  background: #fff8f8;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.result-header h4 {
  margin: 0;
  color: #2c3e50;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-badge.success {
  background: #28a745;
  color: white;
}

.status-badge.error {
  background: #dc3545;
  color: white;
}

.result-details {
  margin-bottom: 1rem;
}

.result-details p {
  margin: 0.5rem 0;
  color: #666;
}

.result-actions {
  display: flex;
  gap: 0.5rem;
}

.detail-btn,
.rerun-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.detail-btn {
  background: #3498db;
  color: white;
}

.rerun-btn {
  background: #f39c12;
  color: white;
}

.test-report {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.report-actions {
  display: flex;
  gap: 1rem;
}

.generate-report-btn,
.download-report-btn,
.share-report-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.generate-report-btn {
  background: #27ae60;
  color: white;
}

.download-report-btn {
  background: #3498db;
  color: white;
}

.share-report-btn {
  background: #9b59b6;
  color: white;
}

.report-overview {
  margin-bottom: 2rem;
}

.overview-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
}

.overview-card h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.overview-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: #2c3e50;
}

.stat-number.success {
  color: #28a745;
}

.stat-number.error {
  color: #dc3545;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
}

.report-details {
  margin-bottom: 2rem;
}

.report-details h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.details-table {
  overflow-x: auto;
}

.details-table table {
  width: 100%;
  border-collapse: collapse;
}

.details-table th,
.details-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.details-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.status-indicator {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-indicator.success {
  background: #d4edda;
  color: #155724;
}

.status-indicator.error {
  background: #f8d7da;
  color: #721c24;
}

.action-btn {
  padding: 0.25rem 0.5rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.report-recommendations {
  margin-top: 2rem;
}

.report-recommendations h3 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recommendation-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fff3cd;
  border-radius: 6px;
  border-left: 4px solid #ffc107;
}

.rec-icon {
  font-size: 1.2rem;
}

.rec-text {
  color: #856404;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  max-height: 80vh;
  /* 让 body 来滚动，header/footer 固定 */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 2rem;
}

.modal-content.wide { max-width: 1000px; width: 90%; }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #ddd;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 2rem;
  flex: 1;
  overflow: auto;
  min-height: 0; /* 关键：允许子滚动容器在 flex 中正确计算高度 */
}

.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem 1.5rem; }
.form-group { display: flex; flex-direction: column; }
.form-group label { margin-bottom: .4rem; color: #374151; font-weight: 600; }
.form-group input { padding: .6rem .75rem; border: 1px solid #e5e7eb; border-radius: 6px; font-size: .95rem; }
.form-group.span-2 { grid-column: span 2; }
.code-area { width: 100%; min-height: 360px; font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; background: #0b1220; color: #e5e7eb; border-radius: 8px; padding: 12px; border: 1px solid #1f2937; }
.modal-footer { display: flex; justify-content: flex-end; gap: .75rem; padding: 0 2rem 1.5rem; }

.detail-section {
  margin-bottom: 2rem;
}

.detail-section h4 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.detail-section p {
  margin: 0.5rem 0;
  color: #666;
}

.error-message,
.stdout-content {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
  overflow-x: auto;
}

.error-message {
  color: #dc3545;
  border-left: 4px solid #dc3545;
}

/* 右侧 AI 思考摘要面板样式 */
.insight-panel {
  position: fixed;
  right: 16px;
  top: 88px;
  width: 360px;
  max-height: calc(100vh - 120px);
  background: #ffffff;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(16,24,40,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 20;
}

.insight-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  font-weight: 600;
  color: #111827;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
}

.insight-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}

.insight-badge.running { background: #e0f2fe; color: #0369a1; }
.insight-badge.done { background: #dcfce7; color: #166534; }

.insight-body {
  padding: 12px;
  overflow: auto;
}

.insight-pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #374151;
}

@media (max-width: 1200px) {
  .insight-panel { display: none; }
}

@media (max-width: 768px) {
  .test-execution {
    padding: 0.5rem;
  }
  
  .execution-actions {
    flex-direction: column;
  }
  
  .report-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .report-actions {
    flex-direction: column;
  }
  
  .overview-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .details-table {
    font-size: 0.9rem;
  }
}
</style> 