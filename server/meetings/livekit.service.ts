import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';

export class LiveKitService {
  static async generateToken(roomName: string, participantId: string, participantName: string, permissions: any): Promise<string> {
    const apiKey = process.env.LIVEKIT_API_KEY || "APIUfGWSwruirn9";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "hXwn252Mdidn9iHVySlT9sktNe70Ihn39Kg7gUG9wTF";

    if (!apiKey || !apiSecret) {
      console.warn("LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing. Generating a dummy token.");
      return "dummy_token_for_" + participantId;
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantId,
      name: participantName,
    });
    
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: permissions.canPublish,
      canSubscribe: permissions.canSubscribe,
      canPublishData: permissions.canPublishData,
    });
    
    // toJwt() is async in livekit-server-sdk v2.x — must be awaited
    return await at.toJwt();
  }

  static async verifyWebhook(body: any, authHeader?: string) {
    const receiver = new WebhookReceiver(
      process.env.LIVEKIT_API_KEY as string,
      process.env.LIVEKIT_API_SECRET as string
    );
    
    // LiveKit WebhookReceiver requires the raw string body and auth header
    const event = receiver.receive(body, authHeader);
    return event;
  }

  static async endRoom(roomName: string): Promise<void> {
    const apiKey = process.env.LIVEKIT_API_KEY || "APIUfGWSwruirn9";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "hXwn252Mdidn9iHVySlT9sktNe70Ihn39Kg7gUG9wTF";
    const wsUrl = process.env.LIVEKIT_URL || "https://coreflow-eo6z5wme.livekit.cloud";

    if (!apiKey || !apiSecret) {
      console.warn("LIVEKIT_API_KEY or secret missing, cannot end room.");
      return;
    }

    const roomService = new RoomServiceClient(wsUrl, apiKey, apiSecret);
    try {
      await roomService.deleteRoom(roomName);
      console.log(`Successfully ended LiveKit room: ${roomName}`);
    } catch (e: any) {
      // Room might already be deleted or not found
      console.warn(`Could not end LiveKit room ${roomName}:`, e.message);
    }
  }
}
