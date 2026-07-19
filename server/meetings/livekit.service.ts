import { AccessToken } from 'livekit-server-sdk';
import { WebhookReceiver } from 'livekit-server-sdk';

export class LiveKitService {
  static generateToken(roomName: string, participantId: string, participantName: string, permissions: any) {
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
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
    
    return at.toJwt();
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
}
