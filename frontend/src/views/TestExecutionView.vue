<template>
  <div class="test-execution">
    <div class="header">
      <h1>🧪 测试执行与报告</h1>
      <p>执行生成的测试用例并查看详细的测试报告</p>
    </div>

    <!-- 测试执行控制面板 -->
    <div class="execution-panel">
      <div class="panel-header">
        <h2>测试执行控制</h2>
      </div>
      
      <div class="execution-controls">
        <!-- 测试文件选择 -->
        <div class="control-group">
          <label>选择测试文件：</label>
          <select v-model="selectedTestFile" class="test-file-select">
            <option value="">请选择测试文件</option>
            <option v-for="file in availableTestFiles" :key="file" :value="file">
              {{ file }}
            </option>
          </select>
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
          <button @click="executeTest" :disabled="!canExecute" class="execute-btn">
            ▶️ 执行测试
          </button>
          <button @click="executeAllTests" class="execute-all-btn">
            🚀 执行所有测试
          </button>
          <button @click="stopExecution" :disabled="!isExecuting" class="stop-btn">
            ⏹️ 停止执行
          </button>
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

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

// 可用测试文件
const availableTestFiles = ref([
  'tests/generated/login-test.spec.ts',
  'tests/generated/user-management-test.spec.ts',
  'tests/generated/waybill-test.spec.ts',
  'tests/generated/finance-test.spec.ts'
])

// 执行选项
const executionOptions = ref({
  headless: true,
  parallel: false,
  retry: true
})

// 计算属性
const canExecute = computed(() => {
  return selectedTestFile.value || availableTestFiles.value.length > 0
})

const successRate = computed(() => {
  if (totalTests.value === 0) return 0
  return Math.round((passedTests.value / totalTests.value) * 100)
})

// 方法
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
      executionResults.value = [result]
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

const executeAllTests = async () => {
  isExecuting.value = true
  executionStatus.value = '开始执行所有测试...'
  executionProgress.value = 0
  executedTests.value = 0
  passedTests.value = 0
  failedTests.value = 0
  
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
      const results = await response.json()
      executionResults.value = results.results || []
      updateExecutionStats()
      generateTestReport()
    } else {
      throw new Error('执行失败')
    }
  } catch (error) {
    console.error('执行所有测试失败:', error)
    alert('执行失败，请重试')
  } finally {
    isExecuting.value = false
  }
}

const stopExecution = () => {
  isExecuting.value = false
  executionStatus.value = '执行已停止'
}

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

onMounted(() => {
  // 初始化时加载可用的测试文件
  loadAvailableTestFiles()
})

const loadAvailableTestFiles = async () => {
  try {
    const response = await fetch('http://localhost:3002/api/available-tests')
    if (response.ok) {
      const data = await response.json()
      availableTestFiles.value = data.files || []
    }
  } catch (error) {
    console.error('加载测试文件失败:', error)
  }
}
</script>

<style scoped>
.test-execution {
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

.execution-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  overflow: hidden;
}

.panel-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem 2rem;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.execution-controls {
  padding: 2rem;
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
}

.execution-options {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.execution-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.execute-btn,
.execute-all-btn,
.stop-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.execute-btn {
  background: #27ae60;
  color: white;
}

.execute-all-btn {
  background: #3498db;
  color: white;
}

.stop-btn {
  background: #e74c3c;
  color: white;
}

.execute-btn:hover:not(:disabled),
.execute-all-btn:hover,
.stop-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.execute-btn:disabled,
.stop-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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
  overflow-y: auto;
  margin: 2rem;
}

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
}

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

@media (max-width: 768px) {
  .test-execution {
    padding: 1rem;
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