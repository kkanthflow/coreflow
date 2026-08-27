const WebSocket = require('ws');
const ws = new WebSocket('wss://coreflow-eo6z5wme.livekit.cloud');

ws.on('open', () => {
  console.log('Connected to WebSocket successfully.');
  ws.close();
});

ws.on('error', (err) => {
  console.error('WebSocket Error:', err);
});
