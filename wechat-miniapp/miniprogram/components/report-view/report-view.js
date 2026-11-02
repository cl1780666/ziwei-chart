const { reportNodes } = require('../../utils/report')

Component({
  properties: {
    title: { type: String, value: '解读' },
    text: { type: String, value: '', observer(value) { this.setData({ nodes: reportNodes(value) }) } },
  },
  data: { nodes: [] },
  methods: {
    copy() {
      if (this.properties.text) wx.setClipboardData({ data: this.properties.text })
    },
  },
})
