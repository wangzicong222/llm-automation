<template>
  <div class="forms">
    <h1 class="forms-title">表单测试页面</h1>
    
    <div class="forms-grid">
      <!-- 用户注册表单 -->
      <div class="form-card">
        <h2>用户注册</h2>
        <form @submit.prevent="handleRegister" class="form">
          <div class="form-group">
            <label for="reg-username" class="form-label">用户名</label>
            <input
              id="reg-username"
              v-model="registerForm.username"
              type="text"
              class="form-input"
              placeholder="请输入用户名"
              required
              data-testid="register-username"
            />
          </div>

          <div class="form-group">
            <label for="reg-email" class="form-label">邮箱</label>
            <input
              id="reg-email"
              v-model="registerForm.email"
              type="email"
              class="form-input"
              placeholder="请输入邮箱"
              required
              data-testid="register-email"
            />
          </div>

          <div class="form-group">
            <label for="reg-password" class="form-label">密码</label>
            <input
              id="reg-password"
              v-model="registerForm.password"
              type="password"
              class="form-input"
              placeholder="请输入密码"
              required
              data-testid="register-password"
            />
          </div>

          <div class="form-group">
            <label for="reg-confirm-password" class="form-label">确认密码</label>
            <input
              id="reg-confirm-password"
              v-model="registerForm.confirmPassword"
              type="password"
              class="form-input"
              placeholder="请再次输入密码"
              required
              data-testid="register-confirm-password"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input
                v-model="registerForm.agreeTerms"
                type="checkbox"
                required
                data-testid="register-agree-terms"
              />
              <span>我同意服务条款和隐私政策</span>
            </label>
          </div>

          <button type="submit" class="btn btn-primary" data-testid="register-submit">
            注册
          </button>
        </form>
      </div>

      <!-- 联系表单 -->
      <div class="form-card">
        <h2>联系我们</h2>
        <form @submit.prevent="handleContact" class="form">
          <div class="form-group">
            <label for="contact-name" class="form-label">姓名</label>
            <input
              id="contact-name"
              v-model="contactForm.name"
              type="text"
              class="form-input"
              placeholder="请输入您的姓名"
              required
              data-testid="contact-name"
            />
          </div>

          <div class="form-group">
            <label for="contact-email" class="form-label">邮箱</label>
            <input
              id="contact-email"
              v-model="contactForm.email"
              type="email"
              class="form-input"
              placeholder="请输入您的邮箱"
              required
              data-testid="contact-email"
            />
          </div>

          <div class="form-group">
            <label for="contact-subject" class="form-label">主题</label>
            <select
              id="contact-subject"
              v-model="contactForm.subject"
              class="form-input"
              required
              data-testid="contact-subject"
            >
              <option value="">请选择主题</option>
              <option value="general">一般咨询</option>
              <option value="support">技术支持</option>
              <option value="bug">问题反馈</option>
              <option value="feature">功能建议</option>
            </select>
          </div>

          <div class="form-group">
            <label for="contact-message" class="form-label">消息</label>
            <textarea
              id="contact-message"
              v-model="contactForm.message"
              class="form-input"
              rows="4"
              placeholder="请输入您的消息"
              required
              data-testid="contact-message"
            ></textarea>
          </div>

          <button type="submit" class="btn btn-primary" data-testid="contact-submit">
            发送消息
          </button>
        </form>
      </div>

      <!-- 搜索表单 -->
      <div class="form-card">
        <h2>搜索功能</h2>
        <form @submit.prevent="handleSearch" class="form">
          <div class="form-group">
            <label for="search-query" class="form-label">搜索关键词</label>
            <input
              id="search-query"
              v-model="searchForm.query"
              type="text"
              class="form-input"
              placeholder="请输入搜索关键词"
              required
              data-testid="search-query"
            />
          </div>

          <div class="form-group">
            <label for="search-category" class="form-label">搜索分类</label>
            <select
              id="search-category"
              v-model="searchForm.category"
              class="form-input"
              data-testid="search-category"
            >
              <option value="">所有分类</option>
              <option value="articles">文章</option>
              <option value="products">产品</option>
              <option value="users">用户</option>
              <option value="tags">标签</option>
            </select>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input
                v-model="searchForm.advanced"
                type="checkbox"
                data-testid="search-advanced"
              />
              <span>高级搜索</span>
            </label>
          </div>

          <button type="submit" class="btn btn-primary" data-testid="search-submit">
            搜索
          </button>
        </form>
      </div>
    </div>

    <!-- 表单提交结果 -->
    <div v-if="submitResult" class="submit-result">
      <div :class="['alert', submitResult.type]">
        {{ submitResult.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const registerForm = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreeTerms: false
})

const contactForm = reactive({
  name: '',
  email: '',
  subject: '',
  message: ''
})

const searchForm = reactive({
  query: '',
  category: '',
  advanced: false
})

const submitResult = ref<{ type: string; message: string } | null>(null)

const handleRegister = () => {
  if (registerForm.password !== registerForm.confirmPassword) {
    submitResult.value = {
      type: 'alert-error',
      message: '密码和确认密码不匹配'
    }
    return
  }

  // 模拟注册处理
  submitResult.value = {
    type: 'alert-success',
    message: `用户 ${registerForm.username} 注册成功！`
  }

  // 重置表单
  Object.assign(registerForm, {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  })
}

const handleContact = () => {
  // 模拟联系表单处理
  submitResult.value = {
    type: 'alert-success',
    message: `感谢 ${contactForm.name} 的消息，我们会尽快回复您！`
  }

  // 重置表单
  Object.assign(contactForm, {
    name: '',
    email: '',
    subject: '',
    message: ''
  })
}

const handleSearch = () => {
  // 模拟搜索处理
  const categoryText = searchForm.category ? `在 ${searchForm.category} 分类中` : ''
  const advancedText = searchForm.advanced ? '（高级搜索）' : ''
  
  submitResult.value = {
    type: 'alert-success',
    message: `搜索 "${searchForm.query}" ${categoryText}${advancedText} 完成`
  }

  // 重置表单
  Object.assign(searchForm, {
    query: '',
    category: '',
    advanced: false
  })
}
</script>

<style scoped>
.forms {
  max-width: 1200px;
  margin: 0 auto;
}

.forms-title {
  font-size: 2.5rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 3rem;
  color: #2c3e50;
}

.forms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.form-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.form-card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: #2c3e50;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #6c757d;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

textarea.form-input {
  resize: vertical;
  min-height: 100px;
}

.submit-result {
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .forms-title {
    font-size: 2rem;
  }
  
  .forms-grid {
    grid-template-columns: 1fr;
  }
  
  .form-card {
    padding: 1.5rem;
  }
}
</style> 