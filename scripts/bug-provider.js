const fs = require('fs').promises;
const path = require('path');

class TapdProvider {
  constructor(env = process.env) {
    this.base = env.TAPD_API_BASE || '';
    this.workspaceId = env.TAPD_WORKSPACE_ID || '';
    this.username = env.TAPD_USERNAME || '';
    this.token = env.TAPD_API_TOKEN || '';
    this.defaultOwner = env.TAPD_DEFAULT_OWNER || '';
    this.displayName = env.TAPD_DISPLAY_NAME || this.username;
    this.attachUpload = String(env.TAPD_ATTACH_UPLOAD || 'false') === 'true';
  }

  async createBug(payload) {
    // 如果未配置 TAPD，则降级为本地模拟，便于前端流程联调
    if (!this.base || !this.workspaceId || !this.username || !this.token) {
      const id = `BUG-${Date.now()}`;
      const url = `mock://tapd/${id}`;
      await this.#saveLocal(id, { id, url, payload, status: 'new' });
      return { id, url, status: 'new', mocked: true };
    }

    try {
      // 处理附件（暂时仅记录信息，不实际上传）
      const attachmentIds = [];
      if (payload.attachments && payload.attachments.length > 0) {
        console.log(`发现 ${payload.attachments.length} 个附件，将在描述中记录`);
        for (const attachment of payload.attachments) {
          try {
            // 暂时禁用实际上传，避免422错误影响Bug创建
            // const attachId = await this.#uploadAttachment(attachment);
            // if (attachId) attachmentIds.push(attachId);
            console.log(`记录附件: ${attachment.name} (${attachment.type || 'unknown'})`);
          } catch (e) {
            console.warn('附件处理失败:', attachment.name, e.message);
          }
        }
      }

      const endpoint = `${this.base.replace(/\/$/, '')}/bugs`; // 实际路径按企业网关可能不同
      const auth = Buffer.from(`${this.username}:${this.token}`).toString('base64');

      // TAPD 多数接口使用 application/x-www-form-urlencoded 或 JSON，
      // 这里用 JSON，若企业网关不同可在此调整。
      const body = {
        workspace_id: this.workspaceId,
        title: payload.title,
        description: payload.description,
        priority: this.#mapPriority(payload.priority ?? 3), // 默认：中
        severity: this.#mapSeverity(payload.severity ?? 3), // 默认：一般
        owner: payload.owner || this.defaultOwner,
        module_id: payload.module_id,
        attachment_ids: attachmentIds.length > 0 ? attachmentIds.join(',') : undefined,
      };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`TAPD 接口返回 ${resp.status} ${text}`);
      }
      const data = await resp.json().catch(() => ({}));
      const id = data?.data?.id || data?.id || `BUG-${Date.now()}`;
      const url = data?.data?.url || data?.url || `${this.base.replace(/\/$/, '')}/bugs/view/${id}`;
      await this.#saveLocal(id, { id, url, payload, status: data?.data?.status || 'new', attachmentIds });
      return { id, url, status: data?.data?.status || 'new', attachmentIds };
    } catch (e) {
      // 出错则回落为本地模拟，保障流程不中断
      const id = `BUG-${Date.now()}`;
      const url = `mock://tapd/${id}`;
      await this.#saveLocal(id, { id, url, payload, status: 'new', error: e.message });
      return { id, url, status: 'new', mocked: true, error: e.message };
    }
  }

  async #uploadAttachment(attachment) {
    if (!attachment || !attachment.path) return null;
    
    try {
      const fs = require('fs').promises;
      
      // 检查文件是否存在
      const stats = await fs.stat(attachment.path);
      if (!stats.isFile()) {
        console.warn('附件不是有效文件:', attachment.path);
        return null;
      }

      // 限制文件大小（10MB）
      if (stats.size > 10 * 1024 * 1024) {
        console.warn('附件过大，跳过上传:', attachment.name, `${Math.round(stats.size/1024/1024)}MB`);
        return null;
      }

      console.log('尝试上传附件:', attachment.name, `${Math.round(stats.size/1024)}KB`);
      
      // 暂时禁用附件上传，仅在描述中记录
      // TAPD API的附件上传可能需要特殊的endpoint或参数
      // 先记录附件信息，避免影响Bug创建
      console.log('附件上传功能暂时禁用，仅在描述中记录附件信息');
      return null;
      
    } catch (e) {
      console.error('附件处理异常:', attachment.name, e.message);
      return null;
    }
  }

  // 映射优先级：前端数字 -> TAPD文本
  #mapPriority(priority) {
    const map = {
      1: '紧急', // P1
      2: '高',   // P2  
      3: '中',   // P3 (默认)
      4: '低'    // P4
    };
    return map[priority] || '中';
  }

  // 映射严重程度：前端数字 -> TAPD文本
  #mapSeverity(severity) {
    const map = {
      1: '致命',
      2: '严重', 
      3: '一般', // 默认
      4: '轻微'
    };
    return map[severity] || '一般';
  }

  // 获取测试用例列表
  async getTestCases(options = {}) {
    // 如果未配置 TAPD，则返回模拟数据
    if (!this.base || !this.workspaceId || !this.username || !this.token) {
      return this.#getMockTestCases(options);
    }

    try {
      const endpoint = `${this.base.replace(/\/$/, '')}/tcases`;
      const auth = Buffer.from(`${this.username}:${this.token}`).toString('base64');
      
      // 构建查询参数 - TAPD API 可能需要不同的参数格式
      const params = new URLSearchParams({
        workspace_id: this.workspaceId,
        limit: options.limit || 50
      });

      // 如果有模块筛选，添加分类ID参数（TAPD: category_id）。
      // 兼容旧实现：同时带上 module，但以 category_id 为准。
      if (options.module) {
        const mod = decodeURIComponent(options.module);
        params.append('category_id', mod);
        params.append('module', mod);
      }

      // 只保留模块筛选，移除状态和负责人筛选

      const resp = await fetch(`${endpoint}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`TAPD 测试用例接口返回 ${resp.status} ${text}`);
      }

      const data = await resp.json();
      const rawTestCases = data?.data || [];
      
      // 确保 rawTestCases 是数组
      if (!Array.isArray(rawTestCases)) {
        console.warn('TAPD 测试用例 API 返回格式异常，使用模拟数据');
        return this.#getMockTestCases(options);
      }
      
      // 提取嵌套的 Tcase 对象
      const testCases = rawTestCases
        .filter(item => item && item.Tcase)
        .map(item => item.Tcase);
      
      // 若传入了模块ID，额外做一次客户端过滤，避免服务端返回邻近分类数据
      let filtered = testCases;
      if (options.module) {
        const mod = decodeURIComponent(options.module);
        filtered = testCases.filter(tc => String(tc.category_id) === String(mod));
      }
      // 转换 TAPD 测试用例格式为平台格式
      return filtered.map(tc => this.#convertTestCase(tc));
      
    } catch (e) {
      console.error('获取 TAPD 测试用例失败:', e.message);
      // 出错时返回模拟数据
      return this.#getMockTestCases(options);
    }
  }

  // 获取单个测试用例详情
  async getTestCaseDetail(testCaseId) {
    // 如果未配置 TAPD，则返回模拟数据
    if (!this.base || !this.workspaceId || !this.username || !this.token) {
      return this.#getMockTestCaseDetail(testCaseId);
    }

    try {
      const endpoint = `${this.base.replace(/\/$/, '')}/testcases/${testCaseId}`;
      const auth = Buffer.from(`${this.username}:${this.token}`).toString('base64');

      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`TAPD 测试用例详情接口返回 ${resp.status} ${text}`);
      }

      const data = await resp.json();
      const testCase = data?.data;
      
      if (!testCase) {
        throw new Error('测试用例不存在');
      }

      return this.#convertTestCase(testCase);
      
    } catch (e) {
      console.error('获取 TAPD 测试用例详情失败:', e.message);
      // 出错时返回模拟数据
      return this.#getMockTestCaseDetail(testCaseId);
    }
  }

  // 转换 TAPD 测试用例格式为平台格式
  #convertTestCase(tapdTestCase) {
    return {
      id: tapdTestCase.id,
      title: tapdTestCase.name || '未命名测试用例',
      description: tapdTestCase.precondition || '',
      steps: this.#parseTestCaseSteps(tapdTestCase),
      expectedResult: tapdTestCase.expectation || '',
      priority: this.#mapTapdPriority(tapdTestCase.priority),
      status: tapdTestCase.status || 'normal',
      module: tapdTestCase.category_id || '未分类', // 使用 category_id 作为模块标识
      owner: tapdTestCase.creator || '未知',
      created: tapdTestCase.created || new Date().toISOString(),
      modified: tapdTestCase.modified || new Date().toISOString(),
      url: `https://www.tapd.cn/${this.workspaceId}/sparrow/tcase/tcase_list?category_id=${tapdTestCase.category_id}`,
      mocked: false,
      // 原始 TAPD 数据
      raw: tapdTestCase
    };
  }

  // 解析测试用例步骤
  #parseTestCaseSteps(tapdTestCase) {
    const steps = [];
    
    // 尝试从不同字段解析步骤
    const stepText = tapdTestCase.steps || tapdTestCase.test_steps || tapdTestCase.description || '';
    
    if (stepText) {
      // 处理 HTML 格式的步骤（TAPD 通常返回 HTML）
      let cleanText = stepText;
      if (stepText.includes('<ol>') || stepText.includes('<li>')) {
        // 简单的 HTML 解析
        cleanText = stepText
          .replace(/<ol[^>]*>/g, '')
          .replace(/<\/ol>/g, '')
          .replace(/<li[^>]*>/g, '')
          .replace(/<\/li>/g, '\n')
          .replace(/<[^>]*>/g, '') // 移除其他 HTML 标签
          .trim();
      }
      
      // 按行分割并清理
      const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line);
      
      lines.forEach((line, index) => {
        // 识别步骤格式：数字. 或 - 或 * 开头
        if (/^(\d+\.|\-|\*)\s/.test(line) || index === 0) {
          steps.push({
            step: index + 1,
            action: line.replace(/^(\d+\.|\-|\*)\s*/, '').trim(),
            expected: '' // TAPD 中期望结果通常在单独字段
          });
        }
      });
    }

    // 如果没有解析到步骤，使用描述作为单个步骤
    if (steps.length === 0 && tapdTestCase.description) {
      steps.push({
        step: 1,
        action: tapdTestCase.description,
        expected: tapdTestCase.expected_result || ''
      });
    }

    return steps;
  }

  // 映射 TAPD 优先级到平台格式
  #mapTapdPriority(tapdPriority) {
    const map = {
      '1': 1, // 紧急
      '2': 2, // 高
      '3': 3, // 中
      '4': 4, // 低
      '紧急': 1,
      '高': 2,
      '中': 3,
      '低': 4
    };
    return map[tapdPriority] || 3;
  }

  // 模拟测试用例数据（基于您的真实 TAPD 用例）
  #getMockTestCases(options = {}) {
    const allCases = [
      {
        id: '1029284',
        title: '【线下付款】通过易快报给车队一个运单的全额运费线下付款,检查企业运力运单金额',
        description: '验证线下付款功能，检查企业运力运单金额是否正确',
        steps: [
          { step: 1, action: '登录财务系统', expected: '登录成功' },
          { step: 2, action: '选择车队运单', expected: '运单列表正常显示' },
          { step: 3, action: '点击线下付款', expected: '付款页面正常打开' },
          { step: 4, action: '输入付款金额', expected: '金额输入正常' },
          { step: 5, action: '提交付款', expected: '付款成功，运单金额更新' }
        ],
        expectedResult: '企业运力运单金额正确更新',
        priority: 1,
        status: 'normal',
        module: '智运多',
        owner: '财务测试',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        url: 'mock://tapd/testcases/1029284',
        mocked: true
      },
      {
        id: '1029285',
        title: '【线下付款】通过易快报给车队一个运单的全额运费线下付款,检查是否进入结算批',
        description: '验证线下付款后是否进入结算批',
        steps: [
          { step: 1, action: '完成线下付款', expected: '付款成功' },
          { step: 2, action: '查看结算批列表', expected: '结算批列表正常显示' },
          { step: 3, action: '检查运单状态', expected: '运单状态为已结算' }
        ],
        expectedResult: '运单成功进入结算批',
        priority: 2,
        status: 'normal',
        module: '智运多',
        owner: '财务测试',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        url: 'mock://tapd/testcases/1029285',
        mocked: true
      },
      {
        id: '1029292',
        title: '【核心用例】车队结算批提款',
        description: '验证车队结算批提款功能',
        steps: [
          { step: 1, action: '登录车队系统', expected: '登录成功' },
          { step: 2, action: '查看结算批', expected: '结算批列表正常显示' },
          { step: 3, action: '选择提款', expected: '提款页面正常打开' },
          { step: 4, action: '确认提款', expected: '提款成功' }
        ],
        expectedResult: '车队成功提款',
        priority: 1,
        status: 'normal',
        module: '智运多',
        owner: '财务测试',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        url: 'mock://tapd/testcases/1029292',
        mocked: true
      },
      {
        id: '1029293',
        title: '【审核驳回】检查审核驳回按钮展示逻辑',
        description: '验证审核驳回按钮的展示逻辑',
        steps: [
          { step: 1, action: '登录审核系统', expected: '登录成功' },
          { step: 2, action: '查看待审核项目', expected: '待审核列表正常显示' },
          { step: 3, action: '检查驳回按钮', expected: '驳回按钮正常显示' }
        ],
        expectedResult: '审核驳回按钮按逻辑正确展示',
        priority: 2,
        status: 'normal',
        module: '审批系统',
        owner: '审批测试',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        url: 'mock://tapd/testcases/1029293',
        mocked: true
      },
      {
        id: '1029310',
        title: '【运单详情】增加列字段:是否标记不付,修改运单可付校验其准确性',
        description: '验证运单详情中标记不付字段的准确性',
        steps: [
          { step: 1, action: '打开运单详情', expected: '运单详情正常显示' },
          { step: 2, action: '查看标记不付字段', expected: '字段正常显示' },
          { step: 3, action: '修改运单状态', expected: '状态修改成功' },
          { step: 4, action: '验证可付状态', expected: '可付状态正确更新' }
        ],
        expectedResult: '标记不付字段校验准确',
        priority: 2,
        status: 'normal',
        module: '跟单侠',
        owner: '运单测试',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        url: 'mock://tapd/testcases/1029310',
        mocked: true
      }
    ];

    // 根据模块筛选
    if (options.module) {
      const moduleName = decodeURIComponent(options.module);
      const filteredCases = allCases.filter(tc => tc.module === moduleName);
      console.log(`筛选模块 "${moduleName}" 的测试用例:`, filteredCases.length, '个');
      return filteredCases;
    }

    return allCases;
  }

  // 模拟测试用例详情
  #getMockTestCaseDetail(testCaseId) {
    const mockCases = this.#getMockTestCases();
    return mockCases.find(tc => tc.id === testCaseId) || mockCases[0];
  }

  // 获取筛选选项
  async getFilterOptions() {
    // 如果未配置 TAPD，则返回模拟数据
    if (!this.base || !this.workspaceId || !this.username || !this.token) {
      return this.#getMockFilterOptions();
    }

    try {
      // 获取模块列表 - 尝试从测试用例中获取模块信息
      const auth = Buffer.from(`${this.username}:${this.token}`).toString('base64');
      let modules = [];
      
      try {
        // 方法1: 尝试从测试用例中获取模块信息
        const testcasesEndpoint = `${this.base.replace(/\/$/, '')}/tcases`;
        const testcasesResp = await fetch(`${testcasesEndpoint}?workspace_id=${this.workspaceId}&limit=200`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (testcasesResp.ok) {
          const testcasesData = await testcasesResp.json();
          console.log('测试用例 API 响应结构:', JSON.stringify(testcasesData, null, 2));
          
          // 从测试用例中提取模块信息 - TAPD API 返回的数据结构是嵌套的 Tcase 对象
          if (testcasesData?.data && Array.isArray(testcasesData.data)) {
            const moduleMap = new Map();
            testcasesData.data.forEach(item => {
              if (item && item.Tcase && item.Tcase.category_id) {
                // 这里我们需要通过 category_id 来关联模块信息
                // 暂时跳过，因为需要先获取模块列表
              }
            });
            // 暂时返回空数组，让后续的模块 API 处理
            modules = [];
            console.log('从测试用例提取的模块:', modules);
          }
        }
      } catch (e) {
        console.log('从测试用例获取模块失败:', e.message);
      }
      
      // 方法2: 如果从测试用例获取失败，尝试测试用例模块（目录）API
      if (modules.length === 0) {
        const categoriesEndpoint = `${this.base.replace(/\/$/, '')}/tcase_categories`;
        const categoriesResp = await fetch(`${categoriesEndpoint}?workspace_id=${this.workspaceId}&limit=200`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        if (categoriesResp.ok) {
          const categoriesData = await categoriesResp.json();
          console.log('测试用例模块 API 响应:', JSON.stringify(categoriesData, null, 2));
          const rawCategories = categoriesData?.data || [];
          
          // 处理测试用例模块数据 - TAPD API 返回的数据结构是嵌套的 TcaseCategory 对象
          // 构建层级结构
          const moduleMap = new Map();
          const rootModules = [];
          
          rawCategories
            .filter(item => item && item.TcaseCategory)
            .forEach(item => {
              const category = item.TcaseCategory;
              const module = {
                id: category.id,
                name: category.name,
                parent_id: category.parent_id,
                children: []
              };
              moduleMap.set(category.id, module);
            });
          
          // 构建层级关系
          // 首先收集所有存在的 parent_id
          const existingParentIds = new Set();
          moduleMap.forEach(module => {
            if (module.parent_id) {
              existingParentIds.add(module.parent_id);
            }
          });
          
          // 然后构建层级关系
          moduleMap.forEach(module => {
            if (module.parent_id && moduleMap.has(module.parent_id)) {
              // 这是一个子模块，添加到父模块的 children 中
              moduleMap.get(module.parent_id).children.push(module);
            }
          });
          
          // 返回所有模块，包括根级模块和有子模块的父级模块
          // 这样前端可以显示完整的层级结构
          modules = Array.from(moduleMap.values());
          
          // 按名称排序，确保显示顺序一致
          modules.sort((a, b) => a.name.localeCompare(b.name));
          
          // 对每个模块的子模块也进行排序
          modules.forEach(module => {
            if (module.children && module.children.length > 0) {
              module.children.sort((a, b) => a.name.localeCompare(b.name));
            }
          });
          
          console.log('从测试用例模块 API 获取的模块:', modules);
        } else {
          console.log('TAPD 测试用例模块 API 请求失败:', categoriesResp.status, categoriesResp.statusText);
        }
      }
      
      // 方法3: 如果还是失败，尝试传统的模块 API
      if (modules.length === 0) {
        const modulesEndpoint = `${this.base.replace(/\/$/, '')}/modules`;
        const modulesResp = await fetch(`${modulesEndpoint}?workspace_id=${this.workspaceId}&limit=200`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        if (modulesResp.ok) {
          const modulesData = await modulesResp.json();
          const rawModules = modulesData?.data || [];
          
          // TAPD API 返回的数据结构是嵌套的，需要提取 Module 对象
          modules = rawModules
            .filter(item => item && item.Module)
            .map(item => ({
              id: item.Module.id,
              name: item.Module.name
            }));
          
          console.log('从传统模块 API 获取的模块:', modules);
        } else {
          console.log('TAPD 传统模块 API 请求失败:', modulesResp.status, modulesResp.statusText);
        }
      }

      // 移除状态和负责人选项，只保留模块筛选
      return {
        modules,
        statuses: [],
        owners: [],
        mocked: false
      };
      
    } catch (e) {
      console.error('获取 TAPD 筛选选项失败:', e.message);
      // 出错时返回模拟数据
      return this.#getMockFilterOptions();
    }
  }

  // 模拟筛选选项数据（基于您的真实 TAPD 模块）
  #getMockFilterOptions() {
    return {
      modules: [
        { id: '1165494327001000181', name: '智运多' },
        { id: '1165494327001000177', name: '招标管理' },
        { id: '1165494327001000176', name: 'AI' },
        { id: '1165494327001000174', name: '三方' },
        { id: '1165494327001000173', name: '档案系统' },
        { id: '1165494327001000172', name: '福佑知识库' },
        { id: '1165494327001000170', name: '招投标系统' },
        { id: '1165494327001000162', name: '跟单侠' },
        { id: '1165494327001000161', name: '审批系统' },
        { id: '1165494327001000160', name: '移动工作台' },
        { id: '1165494327001000159', name: '工作台' },
        { id: '1165494327001000157', name: '前端专项' },
        { id: '1165494327001000156', name: '移动端专项' },
        { id: '1165494327001000153', name: '柚柚加油' },
        { id: '1165494327001000152', name: '包车系统' },
        { id: '1165494327001000151', name: '后端专项' },
        { id: '1165494327001000150', name: '运维' },
        { id: '1165494327001000149', name: '油卡系统' },
        { id: '1165494327001000148', name: '能源系统' },
        { id: '1165494327001000147', name: '司机代表' },
        { id: '1165494327001000146', name: '用户中心' },
        { id: '1165494327001000145', name: '配置系统' },
        { id: '1165494327001000144', name: '用户管理' },
        { id: '1165494327001000141', name: '监控系统' },
        { id: '1165494327001000140', name: '消息中心' },
        { id: '1165494327001000139', name: '任务系统' },
        { id: '1165494327001000138', name: '运营系统' },
        { id: '1165494327001000137', name: 'QA专项' },
        { id: '1165494327001000136', name: '大数据' }
      ],
      statuses: [],
      owners: [],
      mocked: true
    };
  }

  async #saveLocal(id, data) {
    try {
      const dir = path.join(__dirname, '../test-results');
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, 'bug-mappings.json');
      let json = {};
      try { json = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
      json[id] = data;
      await fs.writeFile(file, JSON.stringify(json, null, 2), 'utf8');
    } catch {}
  }
}

module.exports = { TapdProvider };


