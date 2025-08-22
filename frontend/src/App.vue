<template>
  <div id="app">
    <!-- 左侧导航栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="app-title">UI智能测试平台</h1>
        <button class="quick-start-btn">+ 快速开始</button>
      </div>
      
      <nav class="sidebar-nav">
        <router-link to="/test-dashboard" class="nav-item">
          <span class="nav-icon">🏠</span>
          <span class="nav-text">仪表板</span>
        </router-link>
        
        <router-link to="/create-test" class="nav-item">
          <span class="nav-icon">📝</span>
          <span class="nav-text">创建测试</span>
        </router-link>
        
        <router-link to="/test-execution" class="nav-item">
          <span class="nav-icon">▶️</span>
          <span class="nav-text">测试执行</span>
        </router-link>
        
        <router-link to="/test-report" class="nav-item">
          <span class="nav-icon">📊</span>
          <span class="nav-text">测试报告</span>
        </router-link>
      </nav>
      
      <div class="sidebar-footer">
        <div class="today-overview">
          <h3>今日概览</h3>
          <div class="overview-stats">
            <div class="stat-item">
              <span class="stat-number">156</span>
              <span class="stat-label">测试执行</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">94%</span>
              <span class="stat-label">成功率</span>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content">
      <header class="content-header">
        <div class="header-left">
          <h2 class="page-title">{{ getPageTitle() }}</h2>
        </div>
        <div class="header-right">
          <button class="header-btn" title="切换主题">🌙</button>
          <button class="header-btn" title="全屏">⛶</button>
          <button class="header-btn" title="用户信息">👤</button>
          <button class="header-btn" title="但问智能">🤖</button>
        </div>
      </header>
      
      <div class="content-body">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const getPageTitle = () => {
  const routeNames: Record<string, string> = {
    '/test-dashboard': '仪表板',
    '/create-test': '创建测试',
    '/test-execution': '测试执行',
    '/test-report': '测试报告'
  }
  return routeNames[route.path] || 'UI智能测试平台'
}
</script>

<style scoped>
#app {
  display: flex;
  min-height: 100vh;
}

/* 左侧导航栏 */
.sidebar {
  width: 280px;
  background: #1e293b;
  color: white;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid #334155;
}

.app-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 16px;
  color: #f8fafc;
}

.quick-start-btn {
  width: 100%;
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  color: white;
  border: none;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.quick-start-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.sidebar-nav {
  flex: 1;
  padding: 16px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  color: #cbd5e1;
  text-decoration: none;
  transition: all 0.3s ease;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: #334155;
  color: #f8fafc;
}

.nav-item.router-link-active {
  background: #334155;
  color: #f8fafc;
  border-left-color: #8b5cf6;
}

.nav-icon {
  font-size: 1.25rem;
  width: 24px;
  text-align: center;
}

.nav-text {
  font-weight: 500;
}

.sidebar-footer {
  padding: 24px;
  border-top: 1px solid #334155;
}

.today-overview h3 {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.overview-stats {
  display: grid;
  gap: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-number {
  font-size: 1.125rem;
  font-weight: 600;
  color: #f8fafc;
}

.stat-label {
  font-size: 0.875rem;
  color: #94a3b8;
}

/* 主内容区域 */
.main-content {
  flex: 1;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
}

.content-header {
  background: white;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.header-right {
  display: flex;
  gap: 8px;
}

.header-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: #f1f5f9;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  transition: all 0.2s ease;
}

.header-btn:hover {
  background: #e2e8f0;
  transform: translateY(-1px);
}

.content-body {
  flex: 1;
  padding: 0; /* 让子页面可以自行控制边距，实现满宽布局 */
  overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .sidebar.open {
    transform: translateX(0);
  }
  
  .main-content {
    margin-left: 0;
  }
}
</style> 