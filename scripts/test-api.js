const DeepSeekClient = require('./deepseek-client');
require('dotenv').config();

async function testDeepSeekAPI() {
  console.log('🔍 测试 DeepSeek API 连接...\n');
  
  // 检查 API 密钥是否配置
  if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    console.error('❌ 错误：请在 .env 文件中配置有效的 DeepSeek API 密钥');
    console.log('📝 请将 .env 文件中的 DEEPSEEK_API_KEY 设置为你的实际 API 密钥');
    return;
  }
  
  try {
    const deepseek = new DeepSeekClient();
    
    console.log('✅ API 密钥已配置');
    console.log(`📋 使用的模型: ${process.env.DEEPSEEK_MODEL || 'deepseek-chat'}`);
    console.log(`🔢 最大令牌数: ${process.env.DEEPSEEK_MAX_TOKENS || 2000}`);
    console.log(`🌐 API 地址: ${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'}`);
    console.log('');
    
    // 发送一个简单的测试请求
    console.log('🚀 发送测试请求...');
    const result = await deepseek.testConnection();
    
    if (result.success) {
      console.log('✅ API 连接成功！');
      console.log(`📤 响应: ${result.response}`);
      console.log('');
      console.log('🎉 DeepSeek API 配置正确，可以开始使用 LLM 功能了！');
    } else {
      console.error('❌ API 连接失败:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('📊 错误详情:', error.response.data);
    }
    console.log('');
    console.log('💡 请检查以下内容：');
    console.log('   1. API 密钥是否正确');
    console.log('   2. 网络连接是否正常');
    console.log('   3. DeepSeek 账户是否有足够的余额');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  testDeepSeekAPI().catch(console.error);
}

module.exports = { testDeepSeekAPI }; 