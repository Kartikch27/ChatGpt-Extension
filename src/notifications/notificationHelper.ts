export function showNotification(title: string, message: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icon.png'), // Will map to icon in assets
    title,
    message,
    priority: 2,
  });
}
export function showTestNotification(): void {
  showNotification('Test Notification', 'Desktop notifications are working correctly!');
}
