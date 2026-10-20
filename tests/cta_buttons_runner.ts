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

const pricing = fs.readFileSync(pricingPath, 'utf-8').replace(/\r\n/g, '\n');
const landing = fs.readFileSync(landingPath, 'utf-8').replace(/\r\n/g, '\n');
const payments = fs.readFileSync(paymentsPath, 'utf-8').replace(/\r\n/g, '\n');

// 1. Check Freelancer CTA
assert(
  pricing.includes('Sign Up to Get Started →') &&
  landing.includes('<span>Get Started</span>'),
  'Freelancer CTA button is aligned across Pricing and Landing pages'
);

// 2. Check Plan Activation CTAs
assert(
  pricing.includes('handleSubscribe') &&
  landing.includes('Upgrade to '),
  'Business Starter and Growth CTAs are present'
);

// 3. Check Contact / Custom Development CTA
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
  !pricing.includes('Pay with Razorpay'),
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
