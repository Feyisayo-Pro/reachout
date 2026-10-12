// background.js — service worker

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error)

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'RECRUITER_UPDATED' && msg.recruiter) {
    chrome.storage.session.set({
      currentRecruiter:   msg.recruiter,
      recruiterUpdatedAt: Date.now(),
      activeTabId:        sender.tab?.id,
    })
  }
})
