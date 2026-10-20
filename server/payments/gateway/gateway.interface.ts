export interface IPaymentGatewayProvider {
  providerName: string;
  createOrder?(params: any): Promise<any>;
  verifyPaymentSignature?(params: any): boolean;
  verifyWebhookSignature?(rawBody: any, signature: string): boolean;
  parseWebhookPayload?(payload: any): any;
}
