<template>
  <div class="create-test-container">
    <div class="page-header">
      <h1>创建测试</h1>
      <p class="subtitle">智能创建测试</p>
    </div>

    <div class="main-content">
      <div class="test-generation-section">
        <h2>测试用例与页面信息</h2>
        
        <!-- 输入方式选择 -->
        <div class="input-method-selector">
          <label class="radio-group">
            <input type="radio" v-model="inputMethod" value="file" />
            <span>文件上传</span>
          </label>
          <label class="radio-group">
            <input type="radio" v-model="inputMethod" value="manual" />
            <span>手动输入</span>
          </label>
        </div>

        <!-- 文件上传方式 -->
        <div v-if="inputMethod === 'file'" class="upload-section">
          <div class="upload-area">
            <h3>测试用例文件</h3>
            <div class="upload-box" @click="triggerFileUpload('testCase')">
              <i class="upload-icon">📁</i>
              <p>点击或拖拽上传测试用例文件</p>
              <p class="format-hint">支持 Markdown, TXT, DOC 格式</p>
            </div>
            <input
              ref="testCaseFileInput"
              type="file"
              accept=".md,.txt,.doc,.docx"
              @change="handleFileUpload('testCase', $event)"
              style="display: none"
            />
            <div v-if="uploadedFiles.testCase" class="file-info">
              <span>✅ {{ uploadedFiles.testCase.name }}</span>
              <button @click="removeFile('testCase')" class="remove-btn">删除</button>
            </div>
          </div>

          <div class="upload-area">
            <h3>页面截图</h3>
            <div class="upload-box" @click="triggerFileUpload('screenshot')">
              <i class="upload-icon">📷</i>
              <p>点击或拖拽上传截图</p>
              <p class="format-hint">支持 PNG, JPG, JPEG 格式</p>
            </div>
            <input
              ref="screenshotFileInput"
              type="file"
              accept=".png,.jpg,.jpeg"
              @change="handleFileUpload('screenshot', $event)"
              style="display: none"
            />
            <div v-if="uploadedFiles.screenshot" class="file-info">
              <span>✅ {{ uploadedFiles.screenshot.name }}</span>
              <button @click="removeFile('screenshot')" class="remove-btn">删除</button>
            </div>
          </div>
        </div>

        <!-- 手动输入方式 -->
        <div v-if="inputMethod === 'manual'" class="manual-input-section">
          <div class="form-group">
            <label>页面名称 *</label>
            <input 
              v-model="manualInput.pageName" 
              type="text" 
              placeholder="例如: 登录页面、用户管理页面"
            />
          </div>
          
          <div class="form-group">
            <label>页面URL *</label>
            <input 
              v-model="manualInput.pageUrl" 
              type="text" 
              placeholder="例如: login, users"
            />
          </div>
          
          <div class="form-group">
            <label>页面描述</label>
            <textarea 
              v-model="manualInput.pageDescription" 
              placeholder="描述该页面的主要功能和特点"
              rows="4"
            ></textarea>
          </div>

          <div class="form-group">
            <label>用例内容（可选，Markdown）</label>
            <textarea 
              v-model="manualInput.testCaseBody"
              class="md-area"
              placeholder="在此粘贴或编写测试用例步骤，例如：\n1. 打开登录页\n2. 输入用户名和密码\n3. 点击登录并断言成功"
              rows="8"
            ></textarea>
          </div>
        </div>

        <!-- 生成按钮 -->
        <div class="action-section">
          <button 
            @click="generateTestCode" 
            class="generate-btn"
            :disabled="!canGenerate"
          >
            一键生成自动化代码
          </button>
        </div>
      </div>

      <!-- 生成结果展示 -->
      <div v-if="generatedCode" class="result-section">
        <h3>生成的测试代码</h3>
        <div class="code-preview">
          <pre><code>{{ generatedCode }}</code></pre>
          <button @click="copyCode" class="copy-btn">复制代码</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface UploadedFile {
  name: string
  size: number
  type: string
}

interface ManualInput {
  pageName: string
  pageUrl: string
  pageDescription: string
  testCaseBody?: string
}

const inputMethod = ref<'file' | 'manual'>('file')
const uploadedFiles = ref<Record<string, UploadedFile>>({})
const manualInput = ref<ManualInput>({
  pageName: '',
  pageUrl: '',
  pageDescription: '',
  testCaseBody: ''
})
const generatedCode = ref('')

const testCaseFileInput = ref<HTMLInputElement>()
const screenshotFileInput = ref<HTMLInputElement>()

const canGenerate = computed(() => {
  if (inputMethod.value === 'file') {
    return uploadedFiles.value.testCase && uploadedFiles.value.screenshot
  } else {
    return manualInput.value.pageName && manualInput.value.pageUrl
  }
})

function triggerFileUpload(type: string) {
  if (type === 'testCase') {
    testCaseFileInput.value?.click()
  } else if (type === 'screenshot') {
    screenshotFileInput.value?.click()
  }
}

function handleFileUpload(type: string, event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    uploadedFiles.value[type] = {
      name: file.name,
      size: file.size,
      type: file.type
    }
  }
}

function removeFile(type: string) {
  delete uploadedFiles.value[type]
}

async function generateTestCode() {
  try {
    // 这里调用后端API生成测试代码
    const response = await fetch('/api/generate-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputMethod: inputMethod.value,
        files: uploadedFiles.value,
        manualInput: manualInput.value
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      generatedCode.value = result.code
    } else {
      throw new Error('生成失败')
    }
  } catch (error) {
    console.error('生成测试代码失败:', error)
    alert('生成失败，请重试')
  }
}

function copyCode() {
  navigator.clipboard.writeText(generatedCode.value)
  alert('代码已复制到剪贴板')
}
</script>

<style scoped>
.create-test-container {
  max-width: 1200px;
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

.test-generation-section {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.test-generation-section h2 {
  margin-bottom: 24px;
  color: #333;
  font-size: 1.5rem;
}

.input-method-selector {
  margin-bottom: 24px;
}

.radio-group {
  display: inline-flex;
  align-items: center;
  margin-right: 24px;
  cursor: pointer;
}

.radio-group input {
  margin-right: 8px;
}

.upload-section {
  display: grid;
  gap: 24px;
}

.upload-area h3 {
  margin-bottom: 16px;
  color: #555;
}

.upload-box {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-box:hover {
  border-color: #8b5cf6;
  background-color: #f8f7ff;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  display: block;
}

.format-hint {
  color: #888;
  font-size: 0.9rem;
  margin-top: 8px;
}

.file-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f0f9ff;
  padding: 12px 16px;
  border-radius: 6px;
  margin-top: 16px;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.manual-input-section {
  display: grid;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
}

.form-group input,
.form-group textarea {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.md-area {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  line-height: 1.5;
  background: #0b1220;
  color: #e5e7eb;
}

.action-section {
  margin-top: 32px;
  text-align: center;
}

.generate-btn {
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(139, 92, 246, 0.3);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-section {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.result-section h3 {
  margin-bottom: 20px;
  color: #333;
}

.code-preview {
  position: relative;
}

.code-preview pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}

.copy-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #3b82f6;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
