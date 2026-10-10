// 本地验证用的 vue-cli 配置覆盖（经 VUE_CLI_SERVICE_CONFIG_PATH 加载，不改仓库文件）：
// 读取原 vue.config.js，把 devServer.proxy 的目标域名和 cookieDomainRewrite 从 P2C_PROXY_FROM 换成 P2C_PROXY_TO。
const path = require('path')

const original = require(process.env.P2C_ORIGINAL_VUE_CONFIG || path.resolve(process.cwd(), 'vue.config.js'))
const from = process.env.P2C_PROXY_FROM
const to = process.env.P2C_PROXY_TO

if (from && to && original.devServer && original.devServer.proxy) {
  for (const entry of Object.values(original.devServer.proxy)) {
    if (typeof entry.target === 'string') entry.target = entry.target.split(from).join(to)
    if (entry.cookieDomainRewrite && typeof entry.cookieDomainRewrite === 'object') {
      const rewritten = {}
      for (const [domain, value] of Object.entries(entry.cookieDomainRewrite)) rewritten[domain.split(from).join(to)] = value
      entry.cookieDomainRewrite = rewritten
    }
  }
}
if (original.devServer) original.devServer.open = false

module.exports = original
