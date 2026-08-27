const { AccessToken } = require('livekit-server-sdk');
const WebSocket = require('ws');

async function test() {
  const apiKey = "APIUfGWSwruirn9";
  const apiSecret = "hXwn252Mdidn9iHVySlT9sktNe70Ihn39Kg7gUG9wTF";

  const at = new AccessToken(apiKey, apiSecret, {
    identity: "test-user-123",
    name: "Test User",
  });
  
  at.addGrant({
    roomJoin: true,
    room: "test-room",
  });

  const token = await at.toJwt();
  console.log("Token generated:", token.substring(0, 20) + "...");

  const wsUrl = `wss://coreflow-eo6z5wme.livekit.cloud/rtc?access_token=${token}`;
  console.log("Connecting to:", wsUrl);

  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('Connected to WebSocket successfully.');
    ws.close();
  });

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err.message);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: ${code} ${reason}`);
  });
  
  ws.on('unexpected-response', (req, res) => {
     console.error('Unexpected response:', res.statusCode);
  });
}

test().catch(console.error);
