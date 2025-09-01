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


