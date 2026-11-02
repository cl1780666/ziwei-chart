const { getMutagensByHeavenlyStem } = require('iztro/lib/utils')
const { validateProfile, createAstrolabe, createChartSummary, buildChartContext } = require('./domain')
const { createYearlySummary, generateLifetime, parseAIKLine, scopeMutagens, validateYear, AI_KLINE_PROTOCOL } = require('./fortune')

const COMMON = `你是紫微斗数解读者“星图先生”。只根据提供的真实命盘资料推演，结合本命、大限、流年，星曜术语后给通俗解释，吉凶并陈、不奉承、不恐吓。涉及当前年龄和大限时，必须使用服务端“当前时点”的明确结果，不从十二宫大限排期中猜测；分析指定年份时使用该年明确资料。不得把术数判断写成确定事实；健康、投资等只作一般提醒，不作诊断、收益承诺或重大决定依据。不要编造未提供的星曜、四化落宫或具体经历。输出清楚分段的中文，通常控制在1200字内，结尾简短说明仅供参考。`

const PROMPTS = {
  natal: `${COMMON}\n完整解读，按以下六节输出：命格与性情（三方四正、命宫/福德）；事业与财运（官禄/财帛）；婚姻与情感（夫妻）；六亲与人际（父母/子女/迁移/交友）；运势隐忧与建议（大限、疾厄和化忌）；命格金句（2–4句，具体凝练、适合分享）。每个判断给实际宫位星曜依据。`,
  yearly: `${COMMON}\n只分析用户指定的这一年，按年度总象、事业财运、情感家宅、月令趋势、行动建议五节输出。遵循本命为体、大限为用、流年为应；根据提供的实际流年命宫叠本命宫位、禄权科忌落宫与12个月资料讨论机会和压力。月份资料的month是公历月采样，不可称作农历月份。`,
  match: `${COMMON}\n双人合盘必须同时使用甲乙两份真实命盘。按缘分与关系特点、性情共鸣与磨合、命宫宫干四化互飞对照、现实挑战和沟通建议四节输出。契合度用定性描述，不打分；不得用宿债、刑克、离婚等确定性结论。飞星对照是传统技法参考，不是关系事实。`,
  klineYear: `${COMMON}\n专门解释指定年龄/年份，结合真实本命、当前大限、该年四化及四个维度，给出事业、财运、感情、健康的一般提醒和具体行动建议。提供的K线分是术数示意，不是概率，不得解释成真实投资价格或寿命预测。`,
  kline: `根据真实紫微命盘和大限/流年资料生成100年人生运势示意，分数0至100，不是概率、投资价格或寿命预测。使用明确协议${AI_KLINE_PROTOCOL}，只输出一个JSON根对象，唯一字段是decades。decades必须恰好10组，每组仅有startAge和rows：startAge按组依次为1,11,21,31,41,51,61,71,81,91；每组rows恰好10行，分别对应该组连续10年的年龄，合计完整100年。每行严格7个整数：[close,upperWick,lowerWick,career,wealth,relationship,health]。全部数字0..100。upperWick和lowerWick是与运势分同单位的非负上下影线幅度，不是绝对high/low分数。你只预测close和影线幅度，不用跟踪上一年的open；服务器固定首年open=50，之后open=上一年close，按high=min(100,max(open,close)+upperWick)、low=max(0,min(open,close)-lowerWick)构造合法K线，0和100边界允许饱和。维度顺序为事业/财运/感情/健康。按下面十组参考逐组生成；每完成一组必须有10行，再开始下一组。不得返回旧版根rows或根数组，不要额外字段、解释、代码围栏或省略号，不可缺组、缺年或用重复行替代推演。`,
}

class AnalysisInputError extends Error {
  constructor(code) { super(code); this.code = code }
}

function profileInput(value) {
  try { return validateProfile(value) } catch { throw new AnalysisInputError('INVALID_PROFILE') }
}

function yearlyInput(value) {
  try { return validateYear(value) } catch { throw new AnalysisInputError('INVALID_YEAR') }
}

function yearlyContext(yearly) {
  const four = (items) => items.map((item) => `${item.star}化${item.type}落本命${item.palace}`).join('；')
  return [
    `【指定流年】${yearly.year}年(${yearly.stemBranch})，公历年序${yearly.age}，农历虚岁${yearly.nominalAge}岁；流年命宫叠本命${yearly.palaceName}`,
    `流年四化：${four(yearly.mutagens)}`,
    `当前大限：${yearly.decadal.range.join('–')}岁，${yearly.decadal.stemBranch}；大限命宫叠本命${yearly.decadal.palaceName}；${four(yearly.decadal.mutagens)}`,
    '流年十二宫对应本命：',
    ...yearly.palaces.map((palace) => `${palace.name}叠本命${palace.originalName}(${palace.stemBranch})：${palace.majorStarsText}；${palace.minorStarsText || '无辅星'}`),
    '公历各月15日流月采样（不是农历月）：',
    ...yearly.months.map((month) => `${month.month}月(${month.stemBranch})命宫叠本命${month.palaceName}：${four(month.mutagens)}`),
  ].join('\n')
}

function crossFlying(from, to) {
  const life = from.palaces.find((palace) => palace.name === '命宫')
  return { heavenlyStem: life.heavenlyStem, mutagens: scopeMutagens(to, { mutagen: getMutagensByHeavenlyStem(life.heavenlyStem) }) }
}

function prepareAnalysis(event) {
  const task = event.task
  if (!Object.hasOwn(PROMPTS, task)) throw new AnalysisInputError('INVALID_TASK')
  const profile = profileInput(event.profile)
  const chartSummary = createChartSummary(profile)
  const { chart } = createAstrolabe(profile)
  let content = buildChartContext(profile, chartSummary)
  let extras = {}
  let decode = (text) => {
    if (typeof text !== 'string' || !text.trim()) throw new Error('EMPTY_REPORT')
    return { text }
  }
  if (task === 'yearly') {
    const year = yearlyInput(event.year)
    if (year < profile.year) throw new AnalysisInputError('INVALID_YEAR')
    const yearly = createYearlySummary(profile, year, chart)
    content += '\n\n' + yearlyContext(yearly)
  } else if (task === 'match') {
    const partner = profileInput(event.partner)
    const partnerChartSummary = createChartSummary(partner)
    const partnerChart = createAstrolabe(partner).chart
    content = `【甲方】\n${content}\n\n【乙方】\n${buildChartContext(partner, partnerChartSummary)}`
    content += '\n\n【双方命宫宫干四化对照】\n' + JSON.stringify({
      '甲命宫干飞入乙本命': crossFlying(chart, partnerChart),
      '乙命宫干飞入甲本命': crossFlying(partnerChart, chart),
    })
    extras = { chartSummary, partnerChartSummary }
  } else if (task === 'kline') {
    const basis = generateLifetime(profile, chart)
    content += '\n\n十组真实大限与流年参考。每组startAge对应输出组，referenceRows只作参考，每行[公历年序,农历虚岁,年份,干支,大限,大限虚岁年龄段,基础收盘分,流年四化]；输出rows仍仅7个评分整数。大限按农历虚岁对应，输出按公历年序1到100：\n'
      + JSON.stringify(Array.from({ length: 10 }, (_, index) => ({
        startAge: index * 10 + 1,
        referenceRows: basis.slice(index * 10, index * 10 + 10).map((point) => [point.age, point.nominalAge, point.year, point.ganZhi, point.daYun, point.daYunRange, point.close, point.yearlyMutagens]),
      })))
    decode = (text) => ({ points: parseAIKLine(text, basis) })
  } else if (task === 'klineYear') {
    const age = event.age == null ? yearlyInput(event.year) - profile.year + 1 : Number(event.age)
    if (!Number.isInteger(age) || age < 1 || age > 100) throw new AnalysisInputError('INVALID_AGE')
    const year = profile.year + age - 1
    if (event.year != null && yearlyInput(event.year) !== year) throw new AnalysisInputError('INVALID_YEAR')
    const yearly = createYearlySummary(profile, year, chart)
    content += '\n\n' + yearlyContext(yearly)
  }
  return {
    messages: [{ role: 'system', content: PROMPTS[task] }, { role: 'user', content }],
    decode: (answer) => ({ ...decode(answer), ...extras }),
  }
}

module.exports = { prepareAnalysis, AnalysisInputError }
