<template>
  <div class="test-report-container">
    <div class="page-header">
      <h1>测试报告</h1>
      <p class="subtitle">智能查看测试报告</p>
    </div>

    <div class="main-content">
      <!-- 报告概览 -->
      <div class="report-overview">
        <h2>报告概览</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">{{ reportStats.totalTests }}</div>
            <div class="stat-label">总测试数</div>
          </div>
          <div class="stat-card success">
            <div class="stat-number">{{ reportStats.passedTests }}</div>
            <div class="stat-label">通过</div>
          </div>
          <div class="stat-card failure">
            <div class="stat-number">{{ reportStats.failedTests }}</div>
            <div class="stat-label">失败</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ reportStats.successRate }}%</div>
            <div class="stat-label">成功率</div>
          </div>
        </div>
      </div>

      <!-- 报告列表 -->
      <div class="report-list-section">
        <h2>测试报告列表</h2>
        
        <!-- 筛选和搜索 -->
        <div class="filter-bar">
          <div class="search-box">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="搜索报告名称..."
              @input="filterReports"
            />
            <i class="search-icon">🔍</i>
          </div>
          
          <div class="filter-options">
            <select v-model="statusFilter" @change="filterReports">
              <option value="">全部状态</option>
              <option value="success">成功</option>
              <option value="failure">失败</option>
              <option value="running">执行中</option>
            </select>
            
            <select v-model="dateFilter" @change="filterReports">
              <option value="">全部时间</option>
              <option value="today">今天</option>
              <option value="week">本周</option>
              <option value="month">本月</option>
            </select>
          </div>
        </div>

        <!-- 报告表格 -->
        <div class="report-table">
          <table>
            <thead>
              <tr>
                <th>报告名称</th>
                <th>测试套件</th>
                <th>执行时间</th>
                <th>状态</th>
                <th>成功率</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="report in filteredReports" :key="report.id" :class="report.status">
                <td>
                  <div class="report-name">
                    <strong>{{ report.name }}</strong>
                    <span class="report-id">#{{ report.id }}</span>
                  </div>
                </td>
                <td>{{ report.testSuite }}</td>
                <td>{{ formatDate(report.executionTime) }}</td>
                <td>
                  <span class="status-badge" :class="report.status">
                    {{ getStatusText(report.status) }}
                  </span>
                </td>
                <td>
                  <div class="success-rate">
                    <div class="rate-bar">
                      <div 
                        class="rate-fill" 
                        :style="{ width: report.successRate + '%' }"
                      ></div>
                    </div>
                    <span>{{ report.successRate }}%</span>
                  </div>
                </td>
                <td>
                  <div class="action-buttons">
                    <button @click="viewReport(report)" class="btn-view">查看</button>
                    <button @click="viewPlaywrightReport(report)" class="btn-playwright">详细报告</button>
                    <button @click="exportReport(report)" class="btn-export">导出</button>
                    <button @click="deleteReport(report)" class="btn-delete">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        <div class="pagination">
          <button 
            @click="prevPage" 
            :disabled="currentPage === 1"
            class="page-btn"
          >
            上一页
          </button>
          <span class="page-info">
            第 {{ currentPage }} 页，共 {{ totalPages }} 页
          </span>
          <button 
            @click="nextPage" 
            :disabled="currentPage === totalPages"
            class="page-btn"
          >
            下一页
          </button>
        </div>
      </div>

      <!-- 详细报告弹窗 -->
      <div v-if="selectedReport" class="report-modal" @click="closeModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>测试报告详情 - {{ selectedReport.name }}</h3>
            <button @click="closeModal" class="close-btn">×</button>
          </div>
          
          <div class="modal-body">
            <div class="report-details">
              <div class="detail-row">
                <span class="label">执行时间:</span>
                <span>{{ formatDate(selectedReport.executionTime) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">测试套件:</span>
                <span>{{ selectedReport.testSuite }}</span>
              </div>
              <div class="detail-row">
                <span class="label">总测试数:</span>
                <span>{{ selectedReport.totalTests }}</span>
              </div>
              <div class="detail-row">
                <span class="label">通过:</span>
                <span class="success">{{ selectedReport.passedTests }}</span>
              </div>
              <div class="detail-row">
                <span class="label">失败:</span>
                <span class="failure">{{ selectedReport.failedTests }}</span>
              </div>
            </div>
            
            <div class="test-results">
              <h4>测试结果详情</h4>
              <div class="result-list">
                <div 
                  v-for="test in selectedReport.tests" 
                  :key="test.id"
                  class="test-item"
                  :class="test.status"
                >
                  <div class="test-info">
                    <span class="test-name">{{ test.name }}</span>
                    <span class="test-duration">{{ test.duration }}ms</span>
                  </div>
                  <span class="test-status">{{ getStatusText(test.status) }}</span>
                  <div v-if="test.error" class="test-error">
                    {{ test.error }}
                  </div>
                  <div class="bug-actions" v-if="test.status==='failure'">
                    <button class="btn-view" @click="openBugDialog(test)">提 Bug</button>
                    <a v-if="test.tapdUrl" :href="test.tapdUrl" target="_blank" class="bug-link">查看 TAPD</a>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 提 Bug 弹窗 -->
            <div v-if="bugDialog.visible" class="report-modal" @click="closeBugDialog">
              <div class="modal-content" @click.stop>
                <div class="modal-header">
                  <h3>提 Bug - {{ bugDialog.test?.name }}</h3>
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
                    <label>复现步骤/期望/实际</label>
                    <textarea v-model="bugForm.description" rows="8"></textarea>
                  </div>
                  <div class="modal-footer">
                    <button class="btn-view" @click="submitBug" :disabled="bugSubmitting">{{ bugSubmitting ? '提交中...' : '提交' }}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface TestResult {
  id: string
  name: string
  status: 'success' | 'failure' | 'running'
  duration: number
  error?: string
  tapdUrl?: string
}

interface TestReport {
  id: string
  name: string
  testSuite: string
  executionTime: Date
  status: 'success' | 'failure' | 'running'
  totalTests: number
  passedTests: number
  failedTests: number
  successRate: number
  tests: TestResult[]
}

const searchQuery = ref('')
const statusFilter = ref('')
const dateFilter = ref('')
const currentPage = ref(1)
const selectedReport = ref<TestReport | null>(null)
const bugDialog = ref<{ visible: boolean; test: TestResult | null }>({ visible: false, test: null })
const bugSubmitting = ref(false)
const bugForm = ref<{ title: string; severity: number; priority: number; owner?: string; description: string }>({
  title: '',
  severity: 3, // 一般
  priority: 3, // 中
  owner: '',
  description: ''
})

const reports = ref<TestReport[]>([])

const reportStats = computed(() => {
  const totalTests = reports.value.reduce((sum, r) => sum + (r.totalTests || 0), 0)
  const passedTests = reports.value.reduce((sum, r) => sum + (r.passedTests || 0), 0)
  const failedTests = reports.value.reduce((sum, r) => sum + (r.failedTests || 0), 0)
  const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0

  return {
    totalTests,
    passedTests,
    failedTests,
    successRate
  }
})

const filteredReports = computed(() => {
  let filtered = reports.value

  if (searchQuery.value) {
    filtered = filtered.filter(r => 
      r.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      r.testSuite.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  if (statusFilter.value) {
    filtered = filtered.filter(r => r.status === statusFilter.value)
  }

  if (dateFilter.value) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())

    filtered = filtered.filter(r => {
      switch (dateFilter.value) {
        case 'today':
          return r.executionTime >= today
        case 'week':
          return r.executionTime >= weekAgo
        case 'month':
          return r.executionTime >= monthAgo
        default:
          return true
      }
    })
  }

  return filtered
})

const totalPages = computed(() => Math.ceil(filteredReports.value.length / 10))

function filterReports() {
  currentPage.value = 1
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function viewReport(report: TestReport) {
  selectedReport.value = report
}

function closeModal() {
  selectedReport.value = null
}

function openBugDialog(test: TestResult) {
  bugDialog.value = { visible: true, test }
  bugForm.value.title = `[UI自动化] ${test.name}`
  
  // 构建更详细的描述
  const report = selectedReport.value
  const description = [
    '【测试场景】',
    `- 测试用例: ${test.name}`,
    `- 报告: ${report?.name || '未知报告'}`,
    `- 执行时间: ${report?.executionTime ? formatDate(report.executionTime) : '未知'}`,
    `- 执行耗时: ${test.duration}ms`,
    '',
    '【复现步骤】',
    '(请从"创建测试"页面的步骤推演中复制相关步骤)',
    '',
    '【期望结果】',
    '(请从"创建测试"页面的命中规则中复制期望结果)',
    '',
    '【实际结果】',
    test.error || '测试执行失败',
    '',
    '【附件信息】',
    '系统将自动查找并附加相关的截图、视频和trace文件'
  ].join('\n')
  
  bugForm.value.description = description
}

function closeBugDialog() {
  bugDialog.value.visible = false
}

async function submitBug() {
  if (!bugDialog.value.test) return
  try {
    bugSubmitting.value = true
    const test = bugDialog.value.test
    const report = selectedReport.value
    
    const resp = await fetch('http://localhost:3002/api/bugs/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testName: test.name,
        pageUrl: report?.testSuite || '',
        env: 'test',
        browser: 'chromium',
        steps: [],
        expects: [],
        unmatchedRules: [test.error || '测试执行失败'],
        matchedRules: [],
        logs: test.error || '',
        attachments: [],
        tapd: { 
          severity: bugForm.value.severity, 
          priority: bugForm.value.priority, 
          owner: bugForm.value.owner 
        },
        executionTime: report?.executionTime,
        duration: test.duration,
        reportId: report?.id
      })
    })
    const data = await resp.json()
    if (data?.success && data?.bug) {
      // 更新测试结果，添加TAPD链接
      test.tapdUrl = data.bug.url
      
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

function exportReport(report: TestReport) {
  // 实现导出功能
  console.log('导出报告:', report.name)
  alert(`正在导出报告: ${report.name}`)
}

async function deleteReport(report: TestReport) {
  if (!confirm(`确定要删除报告 "${report.name}" 吗？`)) return
  try {
    const resp = await fetch(`http://localhost:3002/api/report/${encodeURIComponent(report.id)}`, { method: 'DELETE' })
    if (!resp.ok) throw new Error('服务端删除失败')
    const index = reports.value.findIndex(r => r.id === report.id)
    if (index > -1) reports.value.splice(index, 1)
  } catch (e:any) {
    alert(`删除失败：${e.message}`)
  }
}

async function viewPlaywrightReport(report: TestReport) {
  try {
    console.log('🔄 正在打开 Playwright 详细报告...')
    
    // 尝试启动 Playwright 报告服务
    const response = await fetch('http://localhost:3002/api/start-playwright-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('✅ Playwright 报告服务启动成功:', result)
      
      // 在新窗口中打开 Playwright 报告
      setTimeout(() => {
        window.open(result.reportUrl, '_blank')
      }, 1000)
      
    } else {
      console.warn('⚠️ 启动报告服务失败，尝试备用方案')
      
      // 备用方案：直接打开默认端口
      const fallbackUrl = 'http://localhost:9323'
      window.open(fallbackUrl, '_blank')
      alert('正在尝试打开 Playwright 详细报告，如果页面无法加载，请确保已执行过测试')
    }
  } catch (error: any) {
    console.error('❌ 打开 Playwright 报告失败:', error)
    alert('无法打开详细报告，请确保 Playwright 报告服务正在运行')
  }
}

function formatDate(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    success: '成功',
    failure: '失败',
    running: '执行中'
  }
  return statusMap[status] || status
}

onMounted(async () => {
  try {
    const resp = await fetch('http://localhost:3002/api/reports')
    if (resp.ok) {
      const data = await resp.json()
      const list = (data.reports || []).map((r: any, idx: number) => ({
        id: r.id || String(idx + 1),
        name: r.name || '未命名报告',
        testSuite: r.testSuite || '-',
        executionTime: r.executionTime ? new Date(r.executionTime) : new Date(),
        status: r.status || 'success',
        totalTests: r.totalTests || 0,
        passedTests: r.passedTests || 0,
        failedTests: r.failedTests || 0,
        successRate: r.successRate || 0,
        tests: (r.tests || []).map((t: any, i: number) => ({
          id: t.id || String(i + 1),
          name: t.name || '-',
          status: t.status || 'success',
          duration: t.duration || 0,
          error: t.error
        }))
      }))
      reports.value = list
    }
  } catch (e) {
    console.error('加载报告失败', e)
  }
})
</script>

<style scoped>
.test-report-container {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 1.1rem;
}

.main-content {
  display: grid;
  gap: 32px;
}

.report-overview {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.report-overview h2 {
  margin-bottom: 24px;
  color: #333;
  font-size: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.stat-card {
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
  padding: 24px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid #e2e8f0;
}

.stat-card.success {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border-color: #bbf7d0;
}

.stat-card.failure {
  background: linear-gradient(135deg, #fef2f2, #fee2e2);
  border-color: #fecaca;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 8px;
}

.stat-label {
  color: #64748b;
  font-size: 1rem;
}

.report-list-section {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.report-list-section h2 {
  margin-bottom: 24px;
  color: #333;
  font-size: 1.5rem;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-box input {
  width: 100%;
  padding: 12px 40px 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
}

.search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
}

.filter-options {
  display: flex;
  gap: 16px;
}

.filter-options select {
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  font-size: 1rem;
}

.report-table {
  overflow-x: auto;
}

.report-table table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
}

.report-table th,
.report-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.report-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #374151;
}

.report-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.report-id {
  font-size: 0.875rem;
  color: #6b7280;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge.success {
  background: #dcfce7;
  color: #166534;
}

.status-badge.failure {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.running {
  background: #fef3c7;
  color: #92400e;
}

.success-rate {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rate-bar {
  width: 60px;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.rate-fill {
  height: 100%;
  background: #10b981;
  transition: width 0.3s ease;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-view,
.btn-playwright,
.btn-export,
.btn-delete {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-view {
  background: #3b82f6;
  color: white;
}

.btn-playwright {
  background: #8b5cf6;
  color: white;
}

.btn-export {
  background: #f59e0b;
  color: white;
}

.btn-delete {
  background: #ef4444;
  color: white;
}

.btn-view:hover,
.btn-playwright:hover,
.btn-export:hover,
.btn-delete:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #8b5cf6;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #666;
  font-size: 0.875rem;
}

/* 弹窗样式 */
.report-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
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

.close-btn:hover {
  background: #f1f5f9;
}

.modal-body {
  padding: 24px;
}

.report-details {
  margin-bottom: 32px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.detail-row .label {
  font-weight: 500;
  color: #374151;
}

.detail-row .success {
  color: #059669;
}

.detail-row .failure {
  color: #dc2626;
}

.test-results h4 {
  margin-bottom: 16px;
  color: #333;
}

.result-list {
  display: grid;
  gap: 12px;
}

.test-item {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.test-item.success {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.test-item.failure {
  background: #fef2f2;
  border-color: #fecaca;
}

.test-item.running {
  background: #fef3c7;
  border-color: #fed7aa;
}

.test-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.test-name {
  font-weight: 500;
  color: #374151;
}

.test-duration {
  font-size: 0.875rem;
  color: #6b7280;
}

.test-status {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 8px;
}

.test-item.success .test-status {
  color: #059669;
}

.test-item.failure .test-status {
  color: #dc2626;
}

.test-item.running .test-status {
  color: #d97706;
}

.test-error {
  background: #fee2e2;
  color: #991b1b;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  margin-top: 8px;
}

.bug-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.bug-link {
  color: #2563eb;
  text-decoration: underline;
  font-size: 0.875rem;
}

/* 简易表单样式 */
.form-row { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
.form-row.two { flex-direction: row; gap: 12px; }
.form-row.two > div { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.form-row input, .form-row select, .form-row textarea { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
.modal-footer { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
