self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.FCM_MSG?.data?.link || '/mensaje.html';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
