const axios = require('axios');
require('dotenv').config();

class DeepSeekClient {
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxTokens = parseInt(process.env.DEEPSEEK_MAX_TOKENS) || 2000;
    this.baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async chatCompletion(messages, options = {}) {
    try {
      const response = await this.client.post('/v1/chat/completions', {
        model: this.model,
        messages: messages,
        max_tokens: options.max_tokens || this.maxTokens,
        temperature: options.temperature || 0.3,
        ...options
      });

      return response.data;
    } catch (error) {
      console.error('DeepSeek API 调用失败:', error.response?.data || error.message);
      throw error;
    }
  }

  async generateText(prompt, options = {}) {
    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const completion = await this.chatCompletion(messages, options);
    return completion.choices[0].message.content;
  }

  // 检查API连接
  async testConnection() {
    try {
      const response = await this.generateText('请回复 "API 连接成功！"', { max_tokens: 50 });
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = DeepSeekClient; 