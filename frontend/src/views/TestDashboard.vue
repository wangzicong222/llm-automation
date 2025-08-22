<template>
  <div class="test-dashboard">
    <div class="page-header">
      <p class="subtitle">智能创建、执行和查看测试报告</p>
    </div>

    <div class="modules-grid">
      <!-- 创建测试模块 -->
      <div class="module-card create-test">
        <div class="module-icon">📝</div>
        <h2>创建测试</h2>
        <p>智能创建测试用例，支持文件上传和手动输入</p>
        <div class="module-features">
          <span class="feature">文件上传</span>
          <span class="feature">手动输入</span>
          <span class="feature">智能生成</span>
        </div>
        <router-link to="/create-test" class="module-action">
          开始创建
        </router-link>
      </div>

      <!-- 测试执行模块 -->
      <div class="module-card test-execution">
        <div class="module-icon">▶️</div>
        <h2>测试执行</h2>
        <p>执行生成的测试用例，支持多种执行模式</p>
        <div class="module-features">
          <span class="feature">无头模式</span>
          <span class="feature">并行执行</span>
          <span class="feature">失败重试</span>
        </div>
        <router-link to="/test-execution" class="module-action">
          开始执行
        </router-link>
      </div>

      <!-- 测试报告模块 -->
      <div class="module-card test-report">
        <div class="module-icon">📊</div>
        <h2>测试报告</h2>
        <p>查看详细的测试执行报告和结果分析</p>
        <div class="module-features">
          <span class="feature">结果统计</span>
          <span class="feature">详细分析</span>
          <span class="feature">报告导出</span>
        </div>
        <router-link to="/test-report" class="module-action">
          查看报告
        </router-link>
      </div>
    </div>

    <!-- 快速统计 -->
    <div class="quick-stats">
      <h2>今日概览</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-number">{{ todayStats.totalTests }}</div>
          <div class="stat-label">测试执行</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">{{ todayStats.successRate }}%</div>
          <div class="stat-label">成功率</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">{{ todayStats.generatedTests }}</div>
          <div class="stat-label">生成测试</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">{{ todayStats.reports }}</div>
          <div class="stat-label">测试报告</div>
        </div>
      </div>
    </div>

    <!-- 最近活动 -->
    <div class="recent-activity">
      <h2>最近活动</h2>
      <div class="activity-list">
        <div 
          v-for="activity in recentActivities" 
          :key="activity.id"
          class="activity-item"
        >
          <div class="activity-icon" :class="activity.type">
            {{ getActivityIcon(activity.type) }}
          </div>
          <div class="activity-content">
            <div class="activity-title">{{ activity.title }}</div>
            <div class="activity-time">{{ formatTime(activity.time) }}</div>
          </div>
          <div class="activity-status" :class="activity.status">
            {{ getStatusText(activity.status) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface TodayStats {
  totalTests: number
  successRate: number
  generatedTests: number
  reports: number
}

interface RecentActivity {
  id: string
  type: 'create' | 'execute' | 'report'
  title: string
  time: Date
  status: 'success' | 'running' | 'failed'
}

const todayStats = ref<TodayStats>({
  totalTests: 156,
  successRate: 94,
  generatedTests: 23,
  reports: 45
})

const recentActivities = ref<RecentActivity[]>([
  {
    id: '1',
    type: 'create',
    title: '生成了登录功能测试用例',
    time: new Date(Date.now() - 30 * 60 * 1000), // 30分钟前
    status: 'success'
  },
  {
    id: '2',
    type: 'execute',
    title: '执行订单管理测试套件',
    time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2小时前
    status: 'success'
  },
  {
    id: '3',
    type: 'report',
    title: '生成了用户管理测试报告',
    time: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4小时前
    status: 'success'
  },
  {
    id: '4',
    type: 'execute',
    title: '执行支付功能测试',
    time: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6小时前
    status: 'failed'
  }
])

function getActivityIcon(type: string): string {
  const icons = {
    create: '📝',
    execute: '▶️',
    report: '📊'
  }
  return icons[type as keyof typeof icons] || '📋'
}

function getStatusText(status: string): string {
  const statusMap = {
    success: '成功',
    running: '执行中',
    failed: '失败'
  }
  return statusMap[status as keyof typeof statusMap] || status
}

function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else {
    return `${days}天前`
  }
}

onMounted(() => {
  // 可以在这里加载真实的数据
  console.log('测试仪表板已加载')
})
</script>

<style scoped>
.test-dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 48px;
}

.page-header h1 {
  font-size: 3rem;
  color: #1e293b;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #64748b;
  font-size: 1.25rem;
  font-weight: 500;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 32px;
  margin-bottom: 48px;
}

.module-card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;
}

.module-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.module-icon {
  font-size: 3rem;
  margin-bottom: 20px;
  display: block;
}

.module-card h2 {
  color: #1e293b;
  font-size: 1.5rem;
  margin-bottom: 16px;
}

.module-card p {
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 24px;
}

.module-features {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.feature {
  background: #f1f5f9;
  color: #475569;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.module-action {
  display: inline-block;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.module-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.quick-stats {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  margin-bottom: 48px;
}

.quick-stats h2 {
  color: #1e293b;
  font-size: 1.5rem;
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.stat-item {
  text-align: center;
  padding: 24px;
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
  border-radius: 12px;
  border: 1px solid #e2e8f0;
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
  font-weight: 500;
}

.recent-activity {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.recent-activity h2 {
  color: #1e293b;
  font-size: 1.5rem;
  margin-bottom: 24px;
}

.activity-list {
  display: grid;
  gap: 16px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.activity-item:hover {
  background: #f1f5f9;
  transform: translateX(4px);
}

.activity-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  background: #e2e8f0;
}

.activity-icon.create {
  background: #dbeafe;
  color: #1d4ed8;
}

.activity-icon.execute {
  background: #dcfce7;
  color: #059669;
}

.activity-icon.report {
  background: #fef3c7;
  color: #d97706;
}

.activity-content {
  flex: 1;
}

.activity-title {
  color: #1e293b;
  font-weight: 500;
  margin-bottom: 4px;
}

.activity-time {
  color: #64748b;
  font-size: 0.875rem;
}

.activity-status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.activity-status.success {
  background: #dcfce7;
  color: #059669;
}

.activity-status.running {
  background: #fef3c7;
  color: #d97706;
}

.activity-status.failed {
  background: #fee2e2;
  color: #dc2626;
}

@media (max-width: 768px) {
  .modules-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .page-header h1 {
    font-size: 2rem;
  }
}
</style> 