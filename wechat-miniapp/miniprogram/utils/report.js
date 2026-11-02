function inline(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return { name: 'strong', attrs: { style: 'font-weight:600;color:#4a594e' }, children: [{ type: 'text', text: part.slice(2, -2) }] }
    }
    return { type: 'text', text: part.replace(/`([^`]+)`/g, '$1') }
  })
}

// Only create our own nodes: model output cannot inject HTML or remote media.
function reportNodes(value) {
  return String(value || '').split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    if (/^\s*[-*_]{3,}\s*$/.test(line)) return { name: 'hr', attrs: { style: 'border:0;border-top:1px solid #d8cdbd;margin:18px 0' } }
    const heading = line.match(/^\s*#{1,6}\s+(.+)/)
    const quote = line.match(/^\s*>\s?(.*)/)
    const bullet = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.*)/)
    const style = heading
      ? 'font-size:18px;font-weight:600;color:#74363b;margin:22px 0 12px;line-height:1.6'
      : quote
        ? 'border-left:3px solid #9b7760;padding-left:12px;color:#777264;margin:12px 0;line-height:1.9'
        : 'margin:8px 0;line-height:1.9;word-break:break-word'
    const text = heading ? heading[1] : quote ? quote[1] : bullet ? `• ${bullet[1]}` : line
    return { name: 'div', attrs: { style }, children: inline(text) }
  })
}

module.exports = { reportNodes }
