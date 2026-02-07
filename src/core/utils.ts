/**
 * 工具函数模块
 */

// 全角转半角字符映射
const FULL_TO_HALF = '０１２３４５６７８９＋－＝／＼（）［］｛｝＜＞｜＆＊＠＄％＾＿｀～：；＂＇，．？！　';
const HALF_CHARS = "0123456789+-=/\\()[]{}<>|&*@$%^_`~:;\"',.?! ";

/**
 * 清洗文本：去除代码块标记、emoji、全角字符等
 */
export function cleanText(t: string): string {
    let r = t
        .replace(/\r\n?/g, '\n')
        .replace(/^```\w*\n?/gm, '')
        .replace(/\n?```$/gm, '');
    r = r
        .split('\n')
        .map((l) => l.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]+\s*/u, ''))
        .join('\n');
    for (let i = 0; i < FULL_TO_HALF.length; i++) {
        r = r.split(FULL_TO_HALF[i]).join(HALF_CHARS[i]);
    }
    return r
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * 解析日期字符串
 * 支持格式: YYYY-MM-DD, YYYY/MM/DD, MM-DD, MM/DD
 */
export function parseDate(t: string): string | null {
    const m = t.match(/^(\d{4}[-/])?(\d{1,2})[-/](\d{1,2})$/);
    if (!m) return null;
    let y = m[1] ? +m[1].slice(0, 4) : new Date().getFullYear();
    const d = `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (!m[1] && new Date(d) < new Date()) y++;
    return `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/**
 * 生成到期状态文本
 */
export function expiryInfo(d: string | null): string {
    if (!d) return '';
    const days = Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);
    if (days < 0) return `\n⚠️ 已过期 ${-days} 天`;
    if (days === 0) return '\n🔴 今天到期！';
    if (days <= 3) return `\n🔴 ${days} 天后到期`;
    if (days <= 7) return `\n🟡 ${days} 天后到期`;
    return days <= 30 ? `\n🟢 ${days} 天后到期` : `\n📅 ${d}`;
}
