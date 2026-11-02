const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createChartSummary,
  quotaState,
  resolveBirthTime,
  validateProfile,
} = require('./domain')

const leiProfile = {
  year: 2002,
  month: 8,
  day: 19,
  hour: 12,
  gender: 'female',
  birthplace: '成都',
  trueSolarEnabled: true,
}

test('validates and normalizes a profile', () => {
  assert.deepEqual(validateProfile({ ...leiProfile, birthplace: '  成都  ' }), leiProfile)
  assert.throws(() => validateProfile({ ...leiProfile, day: 32 }), /出生日期/)
})

test('applies local true-solar-time correction without changing identity fields', () => {
  const resolved = resolveBirthTime(leiProfile)
  assert.equal(resolved.applied, true)
  assert.match(resolved.locationName, /成都/)
  assert.equal(typeof resolved.correctionMinutes, 'number')
  assert.match(resolved.correctedShichen, /时$/)
})

test('creates a serializable twelve-palace chart summary', () => {
  const chart = createChartSummary(leiProfile)
  assert.equal(chart.palaces.length, 12)
  assert.ok(chart.fiveElementsClass)
  assert.ok(chart.palaces.every((palace) => palace.name && palace.majorStarsText))
  assert.doesNotThrow(() => JSON.stringify(chart))
})

test('resets daily quota on the next Shanghai day', () => {
  const first = quotaState({ day: '2026-11-01', count: 3 }, 5, new Date('2026-11-01T12:00:00Z'))
  const next = quotaState({ day: '2026-11-01', count: 3 }, 5, new Date('2026-11-01T16:00:00Z'))
  assert.equal(first.remaining, 2)
  assert.equal(next.remaining, 5)
})
