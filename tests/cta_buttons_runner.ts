import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

console.log('🧪 Running Auvryn Branded CTA Buttons Verification Suite...\n');

const pricingPath = path.resolve(__dirname, '../web/src/pages/Pricing.tsx');
const landingPath = path.resolve(__dirname, '../web/src/pages/Landing.tsx');
const paymentsPath = path.resolve(__dirname, '../web/src/pages/Payments.tsx');
const rzpButtonPath = path.resolve(__dirname, '../web/src/components/RazorpayStandardCheckoutButton.tsx');

const pricing = fs.readFileSync(pricingPath, 'utf-8');
const landing = fs.readFileSync(landingPath, 'utf-8');
const payments = fs.readFileSync(paymentsPath, 'utf-8');
const rzpButton = fs.readFileSync(rzpButtonPath, 'utf-8');

// 1. Check Freelancer CTA
assert(
  pricing.includes("case 'freelancer':\n      return 'Get Started →';") &&
  landing.includes('<span>Get Started →</span>'),
  'Freelancer button is "Get Started →" across Pricing and Landing pages'
);

// 2. Check Business Starter CTA
assert(
  pricing.includes("case 'starter':\n      return 'Grow with Auvryn →';") &&
  landing.includes('<span>Grow with Auvryn →</span>'),
  'Business Starter button is "Grow with Auvryn →" across Pricing and Landing pages'
);

// 3. Check Auvryn Pro CTA
assert(
  pricing.includes("case 'pro':\n      return 'Unlock Auvryn Pro →';") &&
  landing.includes('<span>Unlock Auvryn Pro →</span>'),
  'Auvryn Pro button is "Unlock Auvryn Pro →" across Pricing and Landing pages'
);

// 4. Check Custom Development CTA
assert(
  pricing.includes('<span>Contact Our Team →</span>') &&
  landing.includes('<span>Contact Our Team →</span>') &&
  pricing.includes('setIsContactModalOpen(true)'),
  'Custom Development button is "Contact Our Team →" and triggers ContactTeamModal'
);

// 5. Check Removal of "Pay with Razorpay" / "Subscribe with Razorpay"
assert(
  !pricing.includes('Subscribe with Razorpay') &&
  !pricing.includes('Pay Once with Razorpay') &&
  !pricing.includes('Pay with Razorpay') &&
  !rzpButton.includes('Pay with Razorpay'),
  'All customer-facing "Pay with Razorpay" / "Subscribe with Razorpay" text eliminated'
);

// 6. Check Razorpay subscription integration preservation
assert(
  pricing.includes('openRazorpaySubscriptionCheckout') &&
  pricing.includes('handleSubscribe') &&
  pricing.includes('/subscriptions/create') &&
  pricing.includes('/subscriptions/verify'),
  'Razorpay checkout integration, plan passing, and payment verification fully preserved'
);

console.log('\n🎉 All Auvryn Branded CTA checks passed successfully!');
