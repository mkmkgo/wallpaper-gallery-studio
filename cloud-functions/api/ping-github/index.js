// Cloud Function (Node.js 20) —— 路由: /api/ping-github
//
// 一次性探针：验证 EdgeOne 的 Cloud Function 运行时能否连到 GitHub 的
// 换 token 接口。中国大陆地域的 Serverless 出网到 github.com 并不保证稳定，
// 部署后请先在浏览器打开 https://你的域名/api/ping-github 看结果：
//   ok: true  → 出网正常，可以配 OAuth 登录
//   ok: false → 该地域连不上 GitHub，需要换加速区域/地域，或改回其他换 token 通道
// 确认没问题后，这个探针函数可以随时删掉。

const TARGET = 'https://github.com/login/oauth/access_token'
const TIMEOUT_MS = 15000

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}

export async function onRequest() {
  const started = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)

  try {
    // 故意用无效 code：能拿到任何 HTTP 响应就证明链路是通的
    const res = await fetch(TARGET, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'edgeone-makers-probe'
      },
      body: JSON.stringify({ client_id: 'probe', client_secret: 'probe', code: 'probe' }),
      signal: ac.signal
    })
    const text = await res.text()
    clearTimeout(timer)

    return json({
      ok: true,
      message: 'Cloud Function 出网到 GitHub 正常',
      upstreamStatus: res.status,
      elapsedMs: Date.now() - started,
      upstreamBody: text.slice(0, 200)
    })
  } catch (e) {
    clearTimeout(timer)
    const msg =
      e && e.name === 'AbortError' ? `超过 ${TIMEOUT_MS}ms 未响应` : (e && e.message) || String(e)
    return json(
      {
        ok: false,
        message: 'Cloud Function 连不上 GitHub，该地域出网受限',
        error: msg,
        elapsedMs: Date.now() - started
      },
      502
    )
  }
}
