const api = require('../../utils/api')

const QUICK_QUESTIONS = [
  '给我一份完整但好懂的命盘解读',
  '我的感情里最需要注意什么？',
  '我更适合什么样的工作？',
  '接下来两年的运势重点是什么？',
]

Page({
  data: {
    messages: [],
    question: '',
    quickQuestions: QUICK_QUESTIONS,
    remaining: 20,
    loading: true,
    sending: false,
    clearing: false,
    error: '',
    scrollTarget: 'chat-top',
  },

  onShow() {
    this.loadState()
  },

  async loadState() {
    this.setData({ loading: true, messages: [], error: '' })
    try {
      const state = await api.getState()
      if (!state.profile) {
        wx.redirectTo({ url: '/pages/profile/profile' })
        return
      }
      this.setData({
        messages: state.messages || [],
        remaining: state.quota.remaining,
      })
      this.scrollToBottom()
    } catch (error) {
      this.setData({ error: error.message })
    } finally {
      this.setData({ loading: false })
    }
  },

  onInput(event) {
    this.setData({ question: event.detail.value })
  },

  askQuick(event) {
    this.sendQuestion(event.currentTarget.dataset.question)
  },

  send() {
    this.sendQuestion(this.data.question)
  },

  async sendQuestion(rawQuestion) {
    const question = String(rawQuestion || '').trim()
    if (!question || this.data.sending) return

    const optimistic = this.data.messages.concat([{ role: 'user', content: question }])
    this.setData({
      messages: optimistic,
      question: '',
      sending: true,
      error: '',
    })
    this.scrollToBottom()

    try {
      const result = await api.ask(question)
      this.setData({
        messages: result.messages,
        remaining: result.quota.remaining,
      })
    } catch (error) {
      this.setData({
        messages: this.data.messages.slice(0, -1),
        error: error.message,
        ...(error.quota ? { remaining: error.quota.remaining } : {}),
      })
    } finally {
      this.setData({ sending: false })
      this.scrollToBottom()
    }
  },

  async clearConversation() {
    if (this.data.clearing) return
    const answer = await wx.showModal({
      title: '清空本机对话',
      content: this.data.sending
        ? '回答结束后将清空这部手机的聊天记录，命盘资料会保留。'
        : '只清空这部手机的聊天记录，命盘资料会保留。',
    })
    if (!answer.confirm) return

    this.setData({ clearing: true })
    try {
      await api.clearConversation()
      this.setData({ messages: [], error: '' })
    } catch (error) {
      this.setData({ error: error.message })
    } finally {
      this.setData({ clearing: false })
    }
  },

  scrollToBottom() {
    this.setData({ scrollTarget: '' })
    setTimeout(() => this.setData({ scrollTarget: 'chat-bottom' }), 30)
  },
})
