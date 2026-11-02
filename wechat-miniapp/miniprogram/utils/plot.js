const PLOT = { top: 32, height: 300, step: 34, left: 44, right: 20 }

function score(value, fallback = 50) {
  const number = Number(value)
  return Math.max(0, Math.min(100, Number.isFinite(number) ? number : fallback))
}

function candleLayout(points) {
  const peak = Math.max(...points.map((point) => score(point.high)), 0)
  return {
    width: PLOT.left + points.length * PLOT.step + PLOT.right,
    grid: [100, 75, 50, 25, 0].map((value) => ({ value, y: PLOT.top + (100 - value) * PLOT.height / 100 })),
    candles: points.map((point, index) => {
      const open = score(point.open)
      const close = score(point.close)
      const high = Math.max(open, close, score(point.high))
      const low = Math.min(open, close, score(point.low))
      const y = (value) => PLOT.top + (100 - value) * PLOT.height / 100
      return {
        index, x: PLOT.left + index * PLOT.step, year: point.year, age: point.age,
        highY: y(high), wickHeight: Math.max(2, y(low) - y(high)),
        bodyY: y(Math.max(open, close)), bodyHeight: Math.max(3, Math.abs(close - open) * PLOT.height / 100),
        up: close >= open, peak: high === peak,
        boundary: index === 0 || point.daYun !== points[index - 1].daYun,
        daYun: point.daYun || '幼限', label: index % 5 === 0,
      }
    }),
  }
}

function radarGeometry(dimensions, width, height) {
  const center = { x: width / 2, y: height / 2 }
  const radius = Math.max(0, Math.min(width / 2 - 48, height / 2 - 30))
  const keys = ['career', 'wealth', 'relationship', 'health']
  const labels = ['事业', '财运', '感情', '健康']
  const vertex = (index, scale) => ({
    x: center.x + Math.cos(-Math.PI / 2 + index * Math.PI / 2) * radius * scale,
    y: center.y + Math.sin(-Math.PI / 2 + index * Math.PI / 2) * radius * scale,
  })
  return {
    center,
    rings: [0.25, 0.5, 0.75, 1].map((scale) => keys.map((key, index) => vertex(index, scale))),
    axes: keys.map((key, index) => ({ ...vertex(index, 1), label: labels[index], value: score((dimensions || {})[key]), index })),
    values: keys.map((key, index) => vertex(index, score((dimensions || {})[key]) / 100)),
  }
}

function drawRadar(context, dimensions, width, height) {
  const geometry = radarGeometry(dimensions, width, height)
  const polygon = (vertices) => {
    context.beginPath()
    vertices.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y))
    context.closePath()
  }
  context.clearRect(0, 0, width, height)
  context.setLineWidth(1)
  context.setStrokeStyle('#d8d5c8')
  geometry.rings.forEach((ring) => { polygon(ring); context.stroke() })
  geometry.axes.forEach((axis) => {
    context.beginPath(); context.moveTo(geometry.center.x, geometry.center.y); context.lineTo(axis.x, axis.y); context.stroke()
  })
  polygon(geometry.values)
  context.setFillStyle('rgba(126, 49, 56, .15)'); context.fill()
  context.setStrokeStyle('#81343a'); context.setLineWidth(2); context.stroke()
  context.setFontSize(12); context.setFillStyle('#536057')
  geometry.axes.forEach((axis) => {
    context.setTextAlign(axis.index === 1 ? 'left' : axis.index === 3 ? 'right' : 'center')
    context.setTextBaseline('middle')
    context.fillText(`${axis.label} ${axis.value}`, axis.x + (axis.index === 1 ? 8 : axis.index === 3 ? -8 : 0), axis.y + (axis.index === 0 ? -15 : axis.index === 2 ? 15 : 0))
  })
  context.draw()
}

module.exports = { candleLayout, radarGeometry, drawRadar }
