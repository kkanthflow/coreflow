/**
 * Helper to dynamically load the Razorpay Checkout script.
 * Avoids bundle bloat while ensuring high reliability.
 */
export function loadRazorpayCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('[Razorpay Checkout] Failed to load checkout script from Razorpay CDN.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export interface RazorpayCheckoutSuccessResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface OpenRazorpayOptions {
  key: string;
  subscriptionId: string;
  name?: string;
  description?: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  themeColor?: string;
  onSuccess: (response: RazorpayCheckoutSuccessResponse) => void;
  onDismiss?: () => void;
  onError?: (error: any) => void;
}

/**
 * Opens the official Razorpay Checkout modal with subscription ID.
 */
export async function openRazorpaySubscriptionCheckout(options: OpenRazorpayOptions): Promise<void> {
  const isLoaded = await loadRazorpayCheckoutScript();
  if (!isLoaded) {
    throw new Error('Unable to connect to Razorpay payment gateway. Please check your internet connection and try again.');
  }

  const razorpayOptions = {
    key: options.key,
    subscription_id: options.subscriptionId,
    name: options.name || 'Auvryn',
    description: options.description || 'Auvryn Operating Architecture Subscription',
    image: 'https://auvryn.com/logo.png',
    prefill: {
      name: options.userName || '',
      email: options.userEmail || '',
      contact: options.userPhone || '',
    },
    notes: {
      platform: 'web',
      app: 'auvryn',
    },
    theme: {
      color: options.themeColor || '#FF6B4A',
      backdrop_color: 'rgba(10, 10, 15, 0.85)',
    },
    modal: {
      backdropclose: false,
      escape: true,
      handleback: true,
      confirm_close: true,
      ondismiss: () => {
        if (options.onDismiss) {
          options.onDismiss();
        }
      },
    },
    handler: (response: RazorpayCheckoutSuccessResponse) => {
      if (options.onSuccess) {
        options.onSuccess(response);
      }
    },
  };

  const rzp = new (window as any).Razorpay(razorpayOptions);

  rzp.on('payment.failed', (response: any) => {
    console.error('[Razorpay Payment Failed]', response.error);
    if (options.onError) {
      options.onError(response.error);
    }
  });

  rzp.open();
}

// ==========================================
// RAZORPAY STANDARD WEB CHECKOUT (ONE-TIME ORDERS)
// ==========================================

export interface RazorpayStandardSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface OpenRazorpayStandardCheckoutOptions {
  key?: string;
  orderId: string;
  amount: number; // in paise
  currency?: string;
  name?: string;
  description?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  themeColor?: string;
  onSuccess: (response: RazorpayStandardSuccessResponse) => void;
  onDismiss?: () => void;
  onError?: (error: any) => void;
}

/**
 * STEP 2: FRONTEND - Checkout
 * Opens the official Razorpay Standard Checkout modal with order_id.
 */
export async function openRazorpayStandardCheckout(options: OpenRazorpayStandardCheckoutOptions): Promise<void> {
  const isLoaded = await loadRazorpayCheckoutScript();
  if (!isLoaded) {
    throw new Error('Unable to connect to Razorpay payment gateway. Please check your internet connection.');
  }

  const razorpayKey = options.key || (import.meta.env as any).VITE_RAZORPAY_KEY_ID || 'rzp_test_Tp698ZJF4kqofH';

  const checkoutOptions = {
    key: razorpayKey,
    order_id: options.orderId,
    amount: options.amount,
    currency: options.currency || 'INR',
    name: options.name || 'Auvryn',
    description: options.description || 'Standard Payment Settlement',
    image: 'https://auvryn.com/logo.png',
    prefill: {
      name: options.userName || '',
      email: options.userEmail || '',
      contact: options.userPhone || '',
    },
    theme: {
      color: options.themeColor || '#FF6B4A',
      backdrop_color: 'rgba(10, 10, 15, 0.85)',
    },
    modal: {
      backdropclose: false,
      escape: true,
      handleback: true,
      confirm_close: true,
      ondismiss: () => {
        if (options.onDismiss) {
          options.onDismiss();
        }
      },
    },
    handler: (response: RazorpayStandardSuccessResponse) => {
      if (options.onSuccess) {
        options.onSuccess(response);
      }
    },
  };

  const rzp = new (window as any).Razorpay(checkoutOptions);

  rzp.on('payment.failed', (response: any) => {
    console.error('[Razorpay Standard Payment Failed]', response.error);
    if (options.onError) {
      options.onError(response.error);
    }
  });

  rzp.open();
}

/**
 * End-to-end convenience method:
 * 1. Calls backend /api/create-order
 * 2. Opens Razorpay Standard Checkout modal with order_id
 * 3. On success: calls /api/verify-payment with order_id, payment_id, signature
 */
export async function initiateStandardCheckoutAndVerify(params: {
  amountInPaise: number; // e.g. 50000 = ₹500.00
  currency?: string;
  receipt?: string;
  name?: string;
  description?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  notes?: Record<string, any>;
  onSuccess?: (verifyResult: any) => void;
  onDismiss?: () => void;
  onError?: (error: any) => void;
}): Promise<void> {
  const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api'
    : ((import.meta.env as any).VITE_API_URL || 'http://localhost:3000/api');

  try {
    // 1. Create order on backend
    const orderRes = await fetch(`${apiUrl}/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: params.amountInPaise,
        currency: params.currency || 'INR',
        receipt: params.receipt,
        notes: params.notes,
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      throw new Error(orderData.error || orderData.message || 'Failed to create order');
    }

    // 2. Open Razorpay modal
    await openRazorpayStandardCheckout({
      key: orderData.key_id,
      orderId: orderData.order_id,
      amount: orderData.amount,
      currency: orderData.currency,
      name: params.name || 'Auvryn',
      description: params.description || `Payment for Receipt ${orderData.receipt || ''}`,
      userName: params.userName,
      userEmail: params.userEmail,
      userPhone: params.userPhone,
      onSuccess: async (rzpSuccess) => {
        // 3. Verify payment signature on backend
        try {
          const verifyRes = await fetch(`${apiUrl}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: rzpSuccess.razorpay_order_id,
              razorpay_payment_id: rzpSuccess.razorpay_payment_id,
              razorpay_signature: rzpSuccess.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.error || 'Payment signature verification failed');
          }

          if (params.onSuccess) {
            params.onSuccess(verifyData);
          }
        } catch (verifyErr: any) {
          if (params.onError) {
            params.onError(verifyErr);
          }
        }
      },
      onDismiss: params.onDismiss,
      onError: params.onError,
    });
  } catch (err: any) {
    if (params.onError) {
      params.onError(err);
    } else {
      throw err;
    }
  }
}
