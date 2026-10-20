import type { IPaymentGatewayProvider } from './gateway.interface';

export class PaymentGatewayFactory {
  static async getProviderForBusiness(_params?: {
    organizationId?: string | null;
    ownerId?: string;
    preferredProvider?: string;
  }): Promise<{ provider: IPaymentGatewayProvider | null; isEnabled: boolean }> {
    return { provider: null, isEnabled: false };
  }

  static async getProviderForInvoice(_invoiceId?: string, _preferredProvider?: string): Promise<{
    provider: IPaymentGatewayProvider | null;
    isEnabled: boolean;
    invoice: any;
    keyId?: string;
  }> {
    return { provider: null, isEnabled: false, invoice: null };
  }
}
