<template>
  <div class="home">
    <div class="hero-section">
      <h1 class="hero-title">🚀 LLM Automation Demo</h1>
      <p class="hero-subtitle">
        基于 Playwright + LLM 的智能 Web UI 自动化测试平台
      </p>
      <div class="hero-buttons">
        <router-link to="/login" class="btn btn-primary">开始体验</router-link>
        <router-link to="/dashboard" class="btn btn-secondary">查看演示</router-link>
      </div>
    </div>

    <div class="features-section">
      <h2 class="section-title">核心功能</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <h3>智能测试生成</h3>
          <p>使用 LLM 自动生成测试用例，支持自然语言描述</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>快速执行</h3>
          <p>Playwright 驱动的快速 UI 自动化测试执行</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>详细报告</h3>
          <p>生成详细的测试报告和覆盖率分析</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔧</div>
          <h3>灵活配置</h3>
          <p>支持多种浏览器和移动设备测试</p>
        </div>
      </div>
    </div>

    <div class="demo-section">
      <h2 class="section-title">演示功能</h2>
      <div class="demo-grid">
        <div class="demo-card">
          <h3>用户登录</h3>
          <p>演示用户登录流程的自动化测试</p>
          <router-link to="/login" class="btn btn-primary">查看登录</router-link>
        </div>
        <div class="demo-card">
          <h3>仪表板</h3>
          <p>展示数据可视化和交互功能</p>
          <router-link to="/dashboard" class="btn btn-primary">查看仪表板</router-link>
        </div>
        <div class="demo-card">
          <h3>表单处理</h3>
          <p>演示复杂表单的自动化测试</p>
          <router-link to="/forms" class="btn btn-primary">查看表单</router-link>
        </div>
        <div class="demo-card featured">
          <h3>📝 测试用例上传</h3>
          <p>上传您的测试用例，自动生成UI自动化代码并执行测试</p>
          <router-link to="/testcase-upload" class="btn btn-primary">开始使用</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 首页组件逻辑
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
}

.hero-section {
  text-align: center;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 20px;
  margin-bottom: 4rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: #6c757d;
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.hero-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 3rem;
  color: #2c3e50;
}

.features-section {
  margin-bottom: 4rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition: transform 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.feature-card p {
  color: #6c757d;
  line-height: 1.6;
}

.demo-section {
  margin-bottom: 4rem;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.demo-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  text-align: center;
  transition: transform 0.3s ease;
}

.demo-card:hover {
  transform: translateY(-5px);
}

.demo-card.featured {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: 3px solid #4a90e2;
}

.demo-card.featured h3 {
  color: white;
}

.demo-card.featured p {
  color: rgba(255, 255, 255, 0.9);
}

.demo-card h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.demo-card p {
  color: #6c757d;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }
  
  .hero-subtitle {
    font-size: 1rem;
  }
  
  .hero-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .features-grid,
  .demo-grid {
    grid-template-columns: 1fr;
  }
}
</style> 