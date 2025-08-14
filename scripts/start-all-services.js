#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// 获取并打印Node.js版本信息
const nodeVersion = process.version;
const nodePlatform = process.platform;
const nodeArch = process.arch;

console.log('🚀 启动LLM自动化测试系统...');
console.log(`📋 系统信息:`);
console.log(`   Node.js版本: ${nodeVersion}`);
console.log(`   平台: ${nodePlatform}`);
console.log(`   架构: ${nodeArch}`);
console.log('');

// 服务配置
const services = [
  {
    name: '前端开发服务器',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: process.cwd(),
    color: '\x1b[36m' // 青色
  },
  {
    name: '集成API服务器',
    command: 'node',
    args: ['scripts/integrated-api-server.js'],
    cwd: process.cwd(),
    color: '\x1b[32m' // 绿色
  },
  {
    name: '测试执行API服务器',
    command: 'node',
    args: ['scripts/test-execution-api.js'],
    cwd: process.cwd(),
    color: '\x1b[35m' // 紫色
  }
];

// 启动所有服务
const processes = services.map(service => {
  console.log(`${service.color}启动 ${service.name}...\x1b[0m`);
  
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    stdio: 'pipe',
    shell: true,
    env: {
      ...process.env,
      PATH: `/Users/wangzicong/.nvm/versions/node/v18.20.8/bin:${process.env.PATH}`
    }
  });

  // 输出处理
  child.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`${service.color}[${service.name}]\x1b[0m ${output}`);
    }
  });

  child.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`${service.color}[${service.name} ERROR]\x1b[0m ${output}`);
    }
  });

  child.on('close', (code) => {
    console.log(`${service.color}${service.name} 已停止 (退出码: ${code})\x1b[0m`);
  });

  child.on('error', (error) => {
    console.error(`${service.color}${service.name} 启动失败:\x1b[0m`, error.message);
  });

  return child;
});

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭所有服务...');
  processes.forEach(child => {
    child.kill('SIGINT');
  });
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭所有服务...');
  processes.forEach(child => {
    child.kill('SIGTERM');
  });
  process.exit(0);
});

// 显示服务状态
setTimeout(() => {
  console.log('\n📊 服务状态:');
  console.log('✅ 前端开发服务器: http://localhost:5173');
  console.log('✅ 集成API服务器: http://localhost:3001');
  console.log('✅ 测试执行API服务器: http://localhost:3002');
  console.log('\n🎯 功能演示流程:');
  console.log('1. 访问 http://localhost:5173');
  console.log('2. 登录系统');
  console.log('3. 进入"智能测试生成器"');
  console.log('4. 上传截图并分析');
  console.log('5. 在第3步后点击"执行测试"');
  console.log('6. 查看测试报告和结果');
  console.log('\n按 Ctrl+C 停止所有服务\n');
}, 3000); 