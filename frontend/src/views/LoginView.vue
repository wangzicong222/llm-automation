<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">用户登录</h1>
      
      <div v-if="message" :class="['alert', messageType]">
        {{ message }}
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username" class="form-label">用户名</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            class="form-input"
            placeholder="请输入用户名"
            required
            data-testid="username-input"
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">密码</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            class="form-input"
            placeholder="请输入密码"
            required
            data-testid="password-input"
          />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="form.rememberMe"
              type="checkbox"
              data-testid="remember-me-checkbox"
            />
            <span>记住我</span>
          </label>
        </div>

        <button
          type="submit"
          class="btn btn-primary login-btn"
          :disabled="loading"
          data-testid="login-button"
        >
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <div class="login-footer">
        <p>演示账号：</p>
        <ul class="demo-accounts">
          <li><strong>管理员：</strong> admin / admin123</li>
          <li><strong>普通用户：</strong> user / user123</li>
          <li><strong>测试用户：</strong> test / test123</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const form = reactive({
  username: '',
  password: '',
  rememberMe: false
})

const loading = ref(false)
const message = ref('')
const messageType = ref('')

const handleLogin = async () => {
  loading.value = true
  message.value = ''
  
  try {
    // 模拟登录验证
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const validCredentials = [
      { username: 'admin', password: 'admin123', role: 'admin' },
      { username: 'user', password: 'user123', role: 'user' },
      { username: 'test', password: 'test123', role: 'test' }
    ]
    
    const credential = validCredentials.find(
      cred => cred.username === form.username && cred.password === form.password
    )
    
    if (credential) {
      message.value = `登录成功！欢迎 ${credential.username}`
      messageType.value = 'alert-success'
      
      // 存储登录状态
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('userRole', credential.role)
      localStorage.setItem('username', credential.username)
      
      // 跳转到仪表板
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } else {
      message.value = '用户名或密码错误'
      messageType.value = 'alert-error'
    }
  } catch (error) {
    message.value = '登录失败，请重试'
    messageType.value = 'alert-error'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 2rem;
}

.login-card {
  background: white;
  padding: 3rem;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.login-title {
  text-align: center;
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 2rem;
  color: #2c3e50;
}

.login-form {
  margin-bottom: 2rem;
}

.login-btn {
  width: 100%;
  padding: 1rem;
  font-size: 1.1rem;
  margin-top: 1rem;
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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

.login-footer {
  border-top: 1px solid #e9ecef;
  padding-top: 1.5rem;
  text-align: center;
}

.login-footer p {
  margin-bottom: 1rem;
  font-weight: 500;
  color: #495057;
}

.demo-accounts {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.9rem;
  color: #6c757d;
}

.demo-accounts li {
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.demo-accounts strong {
  color: #495057;
}

@media (max-width: 480px) {
  .login-card {
    padding: 2rem;
  }
  
  .login-title {
    font-size: 1.5rem;
  }
}
</style> 