const ENV_ID = 'supposed-bovid-d4gcywfkh2af1db6e'

App({
  globalData: {
    envId: ENV_ID,
    functionName: 'ziwei-mini',
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '微信版本过低',
        content: '请升级微信后重新打开小程序。',
        showCancel: false,
      })
      return
    }

    wx.cloud.init({
      env: ENV_ID,
      traceUser: true,
    })
  },
})
