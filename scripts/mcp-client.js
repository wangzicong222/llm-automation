const fetch = require('node-fetch');

async function callMcpSuggest({ endpoint, apiKey, model, stepText, html, url, lastError, screenshotDataUrl }) {
  if (!endpoint) return { actions: [] };
  const body = {
    model: model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: '你是前端页面自动化助手。根据页面快照与自然语言步骤，返回一组稳健的可执行指令。指令包含 verb(click/fill/select/check) 与 一个健壮的 CSS/XPath 选择器和可选的 value。尽量使用 role/name 或 label/placeholder 等语义定位；在对话框内操作时，优先限定在 .ant-modal-content 内。返回 JSON 数组。' },
      { role: 'user', content: JSON.stringify({ stepText, url, lastError, htmlSnippet: html?.slice(0, 120000), screenshot: screenshotDataUrl }) }
    ],
    temperature: 0.1,
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(body)
  }).catch(() => null);
  if (!res || !res.ok) return { actions: [] };
  const data = await res.json().catch(() => ({}));
  // 兼容 OpenAI/chatCompletions 或自定义服务，尝试多路径取文本
  const text = data?.choices?.[0]?.message?.content || data?.content || '';
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { actions: parsed };
    if (Array.isArray(parsed?.actions)) return { actions: parsed.actions };
  } catch {}
  return { actions: [] };
}

module.exports = { callMcpSuggest };


