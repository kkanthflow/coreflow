import * as jose from 'jose';

const LIVEKIT_API_KEY = "APIUfGWSwruirn9";
const LIVEKIT_API_SECRET = "hXwn252Mdidn9iHVySlT9sktNe70Ihn39Kg7gUG9wTF";

export async function generateLiveKitToken(
  roomName: string,
  participantId: string,
  participantName: string
) {
  const secret = new TextEncoder().encode(LIVEKIT_API_SECRET);

  const token = await new jose.SignJWT({
    name: participantName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(LIVEKIT_API_KEY)
    .setSubject(participantId)
    .setExpirationTime('12h')
    .sign(secret);

  return token;
}
