import path from 'path';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  port: process.env.PORT || 8080,
  password: process.env.PASSWORD || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '2'),
  cacheMaxAge: process.env.CACHE_MAX_AGE || '1d',
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  debug: process.env.DEBUG === 'true'
};

const log = (...args) => {
  if (config.debug) {
    console.log('[DEBUG]', ...args);
  }
};

const app = express();

app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

function sha256Hash(input) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    hash.update(input);
    resolve(hash.digest('hex'));
  });
}

async function renderPage(filePath, password) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (password !== '') {
    const sha256 = await sha256Hash(password);
    content = content.replace('{{PASSWORD}}', sha256);
  } else {
    content = content.replace('{{PASSWORD}}', '');
  }
  return content;
}

app.get(['/', '/index.html', '/player.html'], async (req, res) => {
  try {
    let filePath;
    switch (req.path) {
      case '/player.html':
        filePath = path.join(__dirname, 'player.html');
        break;
      default: // '/' 和 '/index.html'
        filePath = path.join(__dirname, 'index.html');
        break;
    }
    
    const content = await renderPage(filePath, config.password);
    res.send(content);
  } catch (error) {
    console.error('页面渲染错误:', error);
    res.status(500).send('读取静态页面失败');
  }
});

app.get('/s=:keyword', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'index.html');
    const content = await renderPage(filePath, config.password);
    res.send(content);
  } catch (error) {
    console.error('搜索页面渲染错误:', error);
    res.status(500).send('读取静态页面失败');
  }
});

function isValidUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const allowedProtocols = ['http:', 'https:'];
    
    // 从环境变量获取阻止的主机名列表
    const blockedHostnames = (process.env.BLOCKED_HOSTS || 'localhost,127.0.0.1,0.0.0.0,::1').split(',');
    
    // 从环境变量获取阻止的 IP 前缀
    const blockedPrefixes = (process.env.BLOCKED_IP_PREFIXES || '192.168.,10.,172.').split(',');
    
    if (!allowedProtocols.includes(parsed.protocol)) return false;
    if (blockedHostnames.includes(parsed.hostname)) return false;
    
    for (const prefix of blockedPrefixes) {
      if (parsed.hostname.startsWith(prefix)) return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// 验证代理请求的鉴权
function validateProxyAuth(req) {
  const authHash = req.query.auth;
  const timestamp = req.query.t;
  
  // 获取服务器端密码哈希
  const serverPassword = config.password;
  if (!serverPassword) {
    console.error('服务器未设置 PASSWORD 环境变量，代理访问被拒绝');
    return false;
  }
  
  // 使用 crypto 模块计算 SHA-256 哈希
  const serverPasswordHash = crypto.createHash('sha256').update(serverPassword).digest('hex');
  
  if (!authHash || authHash !== serverPasswordHash) {
    console.warn('代理请求鉴权失败：密码哈希不匹配');
    console.warn(`期望: ${serverPasswordHash}, 收到: ${authHash}`);
    return false;
  }
  
  // 验证时间戳（10分钟有效期）
  if (timestamp) {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10分钟
    if (now - parseInt(timestamp) > maxAge) {
      console.warn('代理请求鉴权失败：时间戳过期');
      return false;
    }
  }
  
  return true;
}

// 检查内容是否是 M3U8
function isM3u8Content(content, contentType) {
  if (contentType && (contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegurl') || contentType.includes('audio/mpegurl'))) {
    return true;
  }
  return content && typeof content === 'string' && content.trim().startsWith('#EXTM3U');
}

// 从 URL 中提取基础路径
function getBasePath(urlStr) {
  try {
    const u = new URL(urlStr);
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length <= 1) return u.origin + '/';
    segs.pop();
    return u.origin + '/' + segs.join('/') + '/';
  } catch {
    const i = urlStr.lastIndexOf('/');
    return i > urlStr.indexOf('://') + 2 ? urlStr.substring(0, i + 1) : urlStr + '/';
  }
}

// 拼接相对 URL
function resolveRelativeUrl(base, relative) {
  if (!relative) return '';
  if (relative.match(/^https?:\/\//i)) return relative;
  if (!base) return relative;
  try {
    return new URL(relative, base).toString();
  } catch {
    if (relative.startsWith('/')) {
      try { return new URL(base).origin + relative; } catch { return relative; }
    }
    return base.substring(0, base.lastIndexOf('/') + 1) + relative;
  }
}

// 处理 M3U8 媒体播放列表：把所有片段 URL 重写为代理 URL
function processMediaPlaylist(url, content) {
  const baseUrl = getBasePath(url);
  const lines = content.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed && i === lines.length - 1) { result.push(line); continue; }
    if (!trimmed) continue;
    if (trimmed.startsWith('#EXT-X-KEY')) {
      result.push(trimmed.replace(/URI="([^"]+)"/, (_, uri) =>
        `URI="/proxy/${encodeURIComponent(resolveRelativeUrl(baseUrl, uri))}"`));
      continue;
    }
    if (trimmed.startsWith('#EXT-X-MAP')) {
      result.push(trimmed.replace(/URI="([^"]+)"/, (_, uri) =>
        `URI="/proxy/${encodeURIComponent(resolveRelativeUrl(baseUrl, uri))}"`));
      continue;
    }
    if (trimmed.startsWith('#EXTINF')) { result.push(line); continue; }
    if (!trimmed.startsWith('#')) {
      const absUrl = resolveRelativeUrl(baseUrl, trimmed);
      result.push(`/proxy/${encodeURIComponent(absUrl)}`);
      continue;
    }
    result.push(line);
  }
  return result.join('\n');
}

// 处理 M3U8 主播放列表：选取最高带宽的子列表并递归处理
async function processMasterPlaylist(url, content, depth) {
  if (depth > 5) throw new Error('M3U8 递归深度超限');
  const baseUrl = getBasePath(url);
  const lines = content.split('\n');
  let bestBandwidth = -1;
  let bestUrl = '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
      const bw = (lines[i].match(/BANDWIDTH=(\d+)/) || [])[1];
      const currentBw = bw ? parseInt(bw, 10) : 0;
      for (let j = i + 1; j < lines.length; j++) {
        const tl = lines[j].trim();
        if (tl && !tl.startsWith('#')) {
          if (currentBw >= bestBandwidth) {
            bestBandwidth = currentBw;
            bestUrl = resolveRelativeUrl(baseUrl, tl);
          }
          i = j;
          break;
        }
      }
    }
  }
  if (!bestUrl) {
    // 没找到带宽信息，取第一个 .m3u8 链接
    for (const line of lines) {
      const tl = line.trim();
      if (tl && !tl.startsWith('#') && /\.m3u8($|\?)/i.test(tl)) {
        bestUrl = resolveRelativeUrl(baseUrl, tl);
        break;
      }
    }
  }
  if (!bestUrl) return processMediaPlaylist(url, content);
  const resp = await axios.get(bestUrl, {
    responseType: 'text',
    timeout: config.timeout,
    headers: { 'User-Agent': config.userAgent }
  });
  const subContent = resp.data;
  const subType = resp.headers['content-type'] || '';
  if (!isM3u8Content(subContent, subType)) return processMediaPlaylist(bestUrl, subContent);
  if (subContent.includes('#EXT-X-STREAM-INF')) {
    return processMasterPlaylist(bestUrl, subContent, depth + 1);
  }
  return processMediaPlaylist(bestUrl, subContent);
}

// 处理 M3U8 内容入口
async function processM3u8Content(url, content) {
  if (content.includes('#EXT-X-STREAM-INF')) {
    return processMasterPlaylist(url, content, 0);
  }
  return processMediaPlaylist(url, content);
}

// 代理路由 —— 使用正则匹配，从 req.url 获取原始未解码的 URL
app.get(/^\/proxy\/(.+)/, async (req, res) => {
  try {
    if (!validateProxyAuth(req)) {
      return res.status(401).json({
        success: false,
        error: '代理访问未授权：请检查密码配置或鉴权参数'
      });
    }

    // 从原始 req.url 提取编码后的目标 URL（避免 Express 解码 %2F）
    const rawPath = req.url.split('?')[0];
    const encodedUrl = rawPath.replace(/^\/proxy\//, '');
    if (!encodedUrl) {
      return res.status(400).send('缺少目标 URL');
    }
    const targetUrl = decodeURIComponent(encodedUrl);

    if (!isValidUrl(targetUrl)) {
      return res.status(400).send('无效的 URL');
    }

    log(`代理请求: ${targetUrl}`);

    const maxRetries = config.maxRetries;
    let retries = 0;
    
    const makeRequest = async () => {
      try {
        return await axios({
          method: 'get',
          url: targetUrl,
          responseType: 'text',  // 先当文本取，方便判断 M3U8
          timeout: config.timeout,
          headers: { 'User-Agent': config.userAgent },
          transformResponse: [(data) => data]  // 不要自动 JSON 解析
        });
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          log(`重试请求 (${retries}/${maxRetries}): ${targetUrl}`);
          return makeRequest();
        }
        throw error;
      }
    };

    const response = await makeRequest();
    const content = response.data;
    const contentType = response.headers['content-type'] || '';

    // 如果是 M3U8，处理后再返回
    if (isM3u8Content(content, contentType)) {
      log(`检测到 M3U8 内容，开始处理: ${targetUrl}`);
      const processed = await processM3u8Content(targetUrl, content);
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl;charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(processed);
    }

    // 非 M3U8：转发明文响应
    const headers = { ...response.headers };
    const sensitiveHeaders = (
      process.env.FILTERED_HEADERS || 
      'content-security-policy,cookie,set-cookie,x-frame-options,access-control-allow-origin'
    ).split(',');
    sensitiveHeaders.forEach(h => delete headers[h]);
    res.set(headers);
    res.send(content);
  } catch (error) {
    console.error('代理请求错误:', error.message);
    if (error.response) {
      res.status(error.response.status || 502);
      res.send(error.response.data || '上游服务器错误');
    } else {
      res.status(502).send(`请求失败: ${error.message}`);
    }
  }
});

app.use(express.static(path.join(__dirname), {
  maxAge: config.cacheMaxAge
}));

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).send('服务器内部错误');
});

app.use((req, res) => {
  res.status(404).send('页面未找到');
});

// 导出 app 给 Vercel @vercel/node 使用
export default app;

// 启动服务器（本地开发用，Vercel 环境下由平台接管）
const isVercel = process.env.VERCEL === '1';
if (!isVercel) {
  app.listen(config.port, () => {
    console.log(`服务器运行在 http://localhost:${config.port}`);
    if (config.password !== '') {
      console.log('用户登录密码已设置');
    } else {
      console.log('警告: 未设置 PASSWORD 环境变量，用户将被要求设置密码');
    }
    if (config.debug) {
      console.log('调试模式已启用');
      console.log('配置:', { ...config, password: config.password ? '******' : '' });
    }
  });
}
