<template>
  <div class="test-dashboard">
    <!-- 统计卡片区 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <h3>总测试数</h3>
          <p class="stat-number">{{ stats.total }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <h3>通过测试</h3>
          <p class="stat-number success">{{ stats.passed }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">❌</div>
        <div class="stat-content">
          <h3>失败测试</h3>
          <p class="stat-number error">{{ stats.failed }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-content">
          <h3>成功率</h3>
          <p class="stat-number">{{ stats.successRate }}%</p>
        </div>
      </div>
    </div>

    <!-- 测试操作区 -->
    <div class="actions-row">
      <button class="btn btn-primary" @click="runAllTests">运行所有测试</button>
      <button class="btn btn-secondary" @click="runLoginTests">登录测试</button>
      <button class="btn btn-secondary" @click="runWaybillTests">运单测试</button>
      <button class="btn btn-secondary" @click="runFinanceTests">财务测试</button>
      <button class="btn btn-success" @click="showAIGenerator = true">AI 生成测试</button>
      <button class="btn btn-secondary" @click="exportReport">导出报告</button>
      <button class="btn btn-secondary" @click="openSettings">系统设置</button>
    </div>

    <!-- AI 生成器区 -->
    <div v-if="showAIGenerator" class="ai-generator-card">
      <h3>🤖 AI 测试生成器</h3>
      <form @submit.prevent="generateTest">
        <div class="form-group">
          <label>功能名称</label>
          <input v-model="aiForm.feature" placeholder="如：运单管理" required />
        </div>
        <div class="form-group">
          <label>功能描述</label>
          <textarea v-model="aiForm.description" placeholder="详细描述要测试的功能" required></textarea>
        </div>
        <div class="form-group">
          <label>页面元素（可选，逗号分隔）</label>
          <input v-model="aiForm.elements" placeholder="如：按钮ID, 输入框class" />
        </div>
        <div class="form-group">
          <button class="btn btn-primary" type="submit">生成测试用例</button>
          <button class="btn btn-secondary" type="button" @click="showAIGenerator = false">取消</button>
        </div>
      </form>
      <div v-if="aiResult" class="ai-result">
        <h4>生成结果：</h4>
        <pre>{{ aiResult }}</pre>
      </div>
    </div>

    <!-- 测试结果区 -->
    <div class="results-card">
      <h3>📋 最近测试结果</h3>
      <table class="results-table">
        <thead>
          <tr>
            <th>测试名称</th>
            <th>状态</th>
            <th>耗时</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="result in testResults" :key="result.id">
            <td>{{ result.name }}</td>
            <td>
              <span :class="['status-badge', result.status]">
                {{ result.status === 'passed' ? '通过' : result.status === 'failed' ? '失败' : '运行中' }}
              </span>
            </td>
            <td>{{ result.duration }}</td>
            <td>{{ result.timestamp }}</td>
            <td>
              <button class="btn btn-link" @click="viewLogs(result)">日志</button>
              <button class="btn btn-link" @click="viewScreenshot(result)">截图</button>
              <button class="btn btn-link" @click="rerunTest(result)">重跑</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 日志弹窗 -->
    <div v-if="showLogs" class="modal">
      <div class="modal-content">
        <h4>测试日志</h4>
        <pre>{{ currentLogs }}</pre>
        <button class="btn btn-secondary" @click="showLogs = false">关闭</button>
      </div>
    </div>
    <!-- 截图弹窗 -->
    <div v-if="showScreenshot" class="modal">
      <div class="modal-content">
        <h4>测试截图</h4>
        <img :src="currentScreenshot" alt="测试截图" style="max-width:100%" />
        <button class="btn btn-secondary" @click="showScreenshot = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const stats = reactive({
  total: 15,
  passed: 12,
  failed: 3,
  successRate: 80
})

const testResults = ref([
  { id: 1, name: '登录功能测试', status: 'passed', duration: '2.3s', timestamp: '2024-07-29 16:30:45' },
  { id: 2, name: '运单查询测试', status: 'failed', duration: '1.8s', timestamp: '2024-07-29 16:28:12' },
  { id: 3, name: '财务流水测试', status: 'running', duration: '--', timestamp: '2024-07-29 16:25:00' }
])

const showAIGenerator = ref(false)
const aiForm = reactive({ feature: '', description: '', elements: '' })
const aiResult = ref('')

const showLogs = ref(false)
const currentLogs = ref('')
const showScreenshot = ref(false)
const currentScreenshot = ref('')

function runAllTests() {
  alert('模拟：运行所有测试')
}
function runLoginTests() {
  alert('模拟：运行登录测试')
}
function runWaybillTests() {
  alert('模拟：运行运单测试')
}
function runFinanceTests() {
  alert('模拟：运行财务测试')
}
function exportReport() {
  alert('模拟：导出报告')
}
function openSettings() {
  alert('模拟：打开系统设置')
}
function generateTest() {
  aiResult.value = `// 这里会展示AI生成的Playwright测试代码\n功能: ${aiForm.feature}\n描述: ${aiForm.description}\n页面元素: ${aiForm.elements}`
}
function viewLogs(result: any) {
  currentLogs.value = `测试名称: ${result.name}\n执行时间: ${result.timestamp}\n状态: ${result.status}\n\n详细日志信息...`
  showLogs.value = true
}
function viewScreenshot(result: any) {
  currentScreenshot.value = '/screenshots/demo.png'
  showScreenshot.value = true
}
function rerunTest(result: any) {
  alert(`模拟：重新运行测试 ${result.name}`)
}
</script>

<style scoped>
.test-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 0;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}
.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  gap: 1rem;
}
.stat-icon {
  font-size: 2.5rem;
}
.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #2c3e50;
}
.stat-number.success { color: #28a745; }
.stat-number.error { color: #dc3545; }
.actions-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}
.btn { padding: 0.5rem 1.2rem; border-radius: 6px; border: none; cursor: pointer; }
.btn-primary { background: #409eff; color: #fff; }
.btn-secondary { background: #f0f0f0; color: #333; }
.btn-success { background: #67c23a; color: #fff; }
.btn-link { background: none; color: #409eff; text-decoration: underline; cursor: pointer; border: none; padding: 0; }
.results-card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-top: 2rem; }
.results-table { width: 100%; border-collapse: collapse; }
.results-table th, .results-table td { padding: 0.7rem 1rem; border-bottom: 1px solid #eee; text-align: left; }
.status-badge { padding: 0.2em 0.8em; border-radius: 1em; font-size: 0.95em; }
.status-badge.passed { background: #e6f9f0; color: #1abc9c; }
.status-badge.failed { background: #fdecea; color: #e74c3c; }
.status-badge.running { background: #fffbe6; color: #e6a23c; }
.ai-generator-card { background: #f9f9f9; border: 1px solid #eee; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.3rem; color: #666; }
.form-group input, .form-group textarea { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
.ai-result { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 6px; padding: 1rem; margin-top: 1rem; }
.modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background: white; padding: 2rem; border-radius: 10px; min-width: 350px; max-width: 90vw; }
</style> 