import { PaymentGatewayFactory } from './gateway.factory';

/**
 * PaymentGatewayService - Deprecated & retired.
 * Client invoice payment gateway has been removed per architectural mandate.
 */
export class PaymentGatewayService {
  static async createOrder(_params?: any): Promise<any> {
    throw new Error('Online payments for invoices are deprecated. Use manual payment proof submission.');
  }

  static async verifyPayment(_params?: any): Promise<any> {
    throw new Error('Online payments for invoices are deprecated.');
  }

  static async processWebhook(_params?: any): Promise<any> {
    return { success: true, ignored: true, message: 'Gateway retired' };
  }

  static getGatewayFactory() {
    return PaymentGatewayFactory;
  }
}
