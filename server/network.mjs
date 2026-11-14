/**
 * 启动横幅用的网络信息工具。
 *
 * 目的：启动时把「同事能直接打开的真实局域网 IP」打印出来，
 * 而不是只给 127.0.0.1（那个地址别人连不上）。
 */

import os from 'node:os'

/** 常见虚拟网卡：这些地址同事通常连不到，排在后面或不展示 */
const VIRTUAL_IF = /vEthernet|VirtualBox|VMware|Hyper-V|WSL|Docker|Tailscale|ZeroTier|Loopback|Bluetooth|Npcap|TAP-|utun|Radmin|Hamachi/i

const isIPv4 = (item) => item.family === 'IPv4' || item.family === 4

/**
 * 排序权重：越小越可能是同事能访问的真实内网地址。
 * 192.168.x.x（家用/办公路由） < 10.x.x.x（企业内网） < 172.16-31.x.x
 */
function rank({ address, name }) {
  let r = 9
  if (address.startsWith('192.168.')) r = 0
  else if (address.startsWith('10.')) r = 1
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) r = 2
  else if (address.startsWith('169.254.')) r = 8 // APIPA，拿不到 DHCP 时的兜底地址
  if (VIRTUAL_IF.test(name)) r += 10
  return r
}

/**
 * 本机所有非回环 IPv4 地址，按可访问性排序。
 * @returns {{name: string, address: string, rank: number}[]}
 */
export function lanAddresses() {
  const list = []
  for (const [name, items] of Object.entries(os.networkInterfaces())) {
    for (const item of items || []) {
      if (!isIPv4(item) || item.internal) continue
      list.push({ name, address: item.address, rank: rank({ name, address: item.address }) })
    }
  }
  return list.sort((a, b) => a.rank - b.rank)
}

/**
 * 生成启动横幅。
 *
 * @param {object} opts
 * @param {string} opts.title    第一行标题
 * @param {number} opts.port     监听端口
 * @param {string} [opts.path]   访问路径，默认 '/'
 * @param {string} [opts.hint]   末尾提示
 * @returns {string}
 */
export function startupBanner({ title, port, path = '/', hint }) {
  const lines = ['', `  ${title}`]
  lines.push(`  本机     http://127.0.0.1:${port}${path}`)

  const all = lanAddresses()
  const real = all.filter((i) => i.rank < 10)

  if (real.length === 0) {
    lines.push('  局域网   未检测到真实网卡地址（可能未连网），当前仅本机可访问')
  } else {
    for (const { name, address } of real) {
      lines.push(`  同事访问 http://${address}:${port}${path}   (${name})`)
    }
  }

  const virtual = all.filter((i) => i.rank >= 10)
  if (virtual.length) {
    const text = virtual.map((i) => `${i.address}(${i.name})`).join(' ')
    lines.push(`  虚拟网卡 ${text}`)
  }

  if (hint) lines.push(`  ${hint}`)
  lines.push('')
  return lines.join('\n')
}
