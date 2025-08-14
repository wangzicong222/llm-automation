<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1 class="dashboard-title">仪表板</h1>
      <div class="user-info">
        <span>欢迎，{{ username }}</span>
        <button @click="handleLogout" class="btn btn-secondary logout-btn">
          退出登录
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <h3>总测试数</h3>
          <p class="stat-number">{{ stats.totalTests }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <h3>通过测试</h3>
          <p class="stat-number success">{{ stats.passedTests }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">❌</div>
        <div class="stat-content">
          <h3>失败测试</h3>
          <p class="stat-number error">{{ stats.failedTests }}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-content">
          <h3>执行时间</h3>
          <p class="stat-number">{{ stats.executionTime }}s</p>
        </div>
      </div>
    </div>

    <div class="dashboard-content">
      <div class="content-grid">
        <div class="content-card">
          <h2>最近测试</h2>
          <div class="test-list">
            <div
              v-for="test in recentTests"
              :key="test.id"
              class="test-item"
              :class="test.status"
            >
              <div class="test-info">
                <h4>{{ test.name }}</h4>
                <p>{{ test.description }}</p>
              </div>
              <div class="test-status">
                <span :class="['status-badge', test.status]">
                  {{ test.status === 'passed' ? '通过' : '失败' }}
                </span>
                <span class="test-time">{{ test.time }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="content-card">
          <h2>快速操作</h2>
          <div class="action-buttons">
            <button @click="runAllTests" class="btn btn-primary action-btn">
              运行所有测试
            </button>
            <button @click="generateTests" class="btn btn-secondary action-btn">
              生成新测试
            </button>
            <button @click="uploadTestCases" class="btn btn-secondary action-btn">
              📝 测试用例上传
            </button>
            <button @click="executeTests" class="btn btn-secondary action-btn">
              🧪 执行测试
            </button>
            <button @click="openSettings" class="btn btn-secondary action-btn">
              设置
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-section">
      <div class="content-card">
        <h2>测试覆盖率</h2>
        <div class="coverage-chart">
          <div class="coverage-item">
            <span class="coverage-label">UI 组件</span>
            <div class="coverage-bar">
              <div class="coverage-fill" :style="{ width: coverage.ui + '%' }"></div>
            </div>
            <span class="coverage-percentage">{{ coverage.ui }}%</span>
          </div>
          <div class="coverage-item">
            <span class="coverage-label">用户交互</span>
            <div class="coverage-bar">
              <div class="coverage-fill" :style="{ width: coverage.interaction + '%' }"></div>
            </div>
            <span class="coverage-percentage">{{ coverage.interaction }}%</span>
          </div>
          <div class="coverage-item">
            <span class="coverage-label">表单验证</span>
            <div class="coverage-bar">
              <div class="coverage-fill" :style="{ width: coverage.validation + '%' }"></div>
            </div>
            <span class="coverage-percentage">{{ coverage.validation }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const username = ref('')
const stats = ref({
  totalTests: 156,
  passedTests: 142,
  failedTests: 14,
  executionTime: 45
})

const recentTests = ref([
  {
    id: 1,
    name: '用户登录测试',
    description: '验证用户登录功能',
    status: 'passed',
    time: '2.3s'
  },
  {
    id: 2,
    name: '表单提交测试',
    description: '验证表单数据提交',
    status: 'passed',
    time: '1.8s'
  },
  {
    id: 3,
    name: '数据验证测试',
    description: '验证输入数据验证',
    status: 'failed',
    time: '3.1s'
  },
  {
    id: 4,
    name: '响应式布局测试',
    description: '验证移动端适配',
    status: 'passed',
    time: '4.2s'
  }
])

const coverage = ref({
  ui: 85,
  interaction: 92,
  validation: 78
})

onMounted(() => {
  const storedUsername = localStorage.getItem('username')
  if (storedUsername) {
    username.value = storedUsername
  } else {
    router.push('/login')
  }
})

const handleLogout = () => {
  localStorage.removeItem('isLoggedIn')
  localStorage.removeItem('userRole')
  localStorage.removeItem('username')
  router.push('/login')
}

const runAllTests = () => {
  // 模拟运行测试
  console.log('运行所有测试...')
}

const generateTests = () => {
  // 模拟生成测试
  console.log('生成新测试...')
}

const uploadTestCases = () => {
  // 跳转到测试用例上传页面
  router.push('/testcase-upload')
}

const viewReports = () => {
  // 查看报告
  console.log('查看报告...')
}

const openSettings = () => {
  // 打开设置
  console.log('打开设置...')
}

const executeTests = () => {
  // 跳转到测试执行页面
  router.push('/test-execution')
}
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e9ecef;
}

.dashboard-title {
  font-size: 2.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logout-btn {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-content h3 {
  font-size: 1rem;
  color: #6c757d;
  margin-bottom: 0.5rem;
}

.stat-number {
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

.dashboard-content {
  margin-bottom: 2rem;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.content-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.content-card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: #2c3e50;
}

.test-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.test-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-radius: 8px;
  background-color: #f8f9fa;
  border-left: 4px solid #dee2e6;
}

.test-item.passed {
  border-left-color: #28a745;
  background-color: #d4edda;
}

.test-item.failed {
  border-left-color: #dc3545;
  background-color: #f8d7da;
}

.test-info h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #2c3e50;
}

.test-info p {
  font-size: 0.9rem;
  color: #6c757d;
  margin: 0;
}

.test-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-badge.passed {
  background-color: #28a745;
  color: white;
}

.status-badge.failed {
  background-color: #dc3545;
  color: white;
}

.test-time {
  font-size: 0.8rem;
  color: #6c757d;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-btn {
  width: 100%;
  padding: 1rem;
}

.chart-section {
  margin-bottom: 2rem;
}

.coverage-chart {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.coverage-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.coverage-label {
  min-width: 100px;
  font-weight: 500;
  color: #495057;
}

.coverage-bar {
  flex: 1;
  height: 12px;
  background-color: #e9ecef;
  border-radius: 6px;
  overflow: hidden;
}

.coverage-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.coverage-percentage {
  min-width: 50px;
  font-weight: 600;
  color: #2c3e50;
  text-align: right;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .dashboard-title {
    font-size: 2rem;
  }
  
  .content-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .test-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .test-status {
    align-items: flex-start;
  }
}
</style> 