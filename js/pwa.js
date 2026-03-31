window.addEventListener('DOMContentLoaded', () => {
  // Service Worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // PWA install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('pwaBanner');
    if (banner && !localStorage.getItem('pwa_dismissed')) banner.style.display = 'flex';
  });

  const banner = document.getElementById('pwaBanner');
  document.getElementById('pwaBtnInstall')?.addEventListener('click', () => {
    if (banner) banner.style.display = 'none';
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
  });
  document.getElementById('pwaBtnClose')?.addEventListener('click', () => {
    if (banner) banner.style.display = 'none';
    localStorage.setItem('pwa_dismissed', '1');
  });
});
