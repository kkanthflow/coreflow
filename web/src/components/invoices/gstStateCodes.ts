export interface IndianStateGST {
  code: string;
  name: string;
  label: string;
}

export const INDIAN_GST_STATES: IndianStateGST[] = [
  { code: '01', name: 'Jammu & Kashmir', label: '01 - Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh', label: '02 - Himachal Pradesh' },
  { code: '03', name: 'Punjab', label: '03 - Punjab' },
  { code: '04', name: 'Chandigarh', label: '04 - Chandigarh' },
  { code: '05', name: 'Uttarakhand', label: '05 - Uttarakhand' },
  { code: '06', name: 'Haryana', label: '06 - Haryana' },
  { code: '07', name: 'Delhi', label: '07 - Delhi' },
  { code: '08', name: 'Rajasthan', label: '08 - Rajasthan' },
  { code: '09', name: 'Uttar Pradesh', label: '09 - Uttar Pradesh' },
  { code: '10', name: 'Bihar', label: '10 - Bihar' },
  { code: '11', name: 'Sikkim', label: '11 - Sikkim' },
  { code: '12', name: 'Arunachal Pradesh', label: '12 - Arunachal Pradesh' },
  { code: '13', name: 'Nagaland', label: '13 - Nagaland' },
  { code: '14', name: 'Manipur', label: '14 - Manipur' },
  { code: '15', name: 'Mizoram', label: '15 - Mizoram' },
  { code: '16', name: 'Tripura', label: '16 - Tripura' },
  { code: '17', name: 'Meghalaya', label: '17 - Meghalaya' },
  { code: '18', name: 'Assam', label: '18 - Assam' },
  { code: '19', name: 'West Bengal', label: '19 - West Bengal' },
  { code: '20', name: 'Jharkhand', label: '20 - Jharkhand' },
  { code: '21', name: 'Odisha', label: '21 - Odisha' },
  { code: '22', name: 'Chhattisgarh', label: '22 - Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh', label: '23 - Madhya Pradesh' },
  { code: '24', name: 'Gujarat', label: '24 - Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu', label: '26 - Daman & Diu' },
  { code: '27', name: 'Maharashtra', label: '27 - Maharashtra' },
  { code: '29', name: 'Karnataka', label: '29 - Karnataka' },
  { code: '30', name: 'Goa', label: '30 - Goa' },
  { code: '31', name: 'Lakshadweep', label: '31 - Lakshadweep' },
  { code: '32', name: 'Kerala', label: '32 - Kerala' },
  { code: '33', name: 'Tamil Nadu', label: '33 - Tamil Nadu' },
  { code: '34', name: 'Puducherry', label: '34 - Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands', label: '35 - Andaman & Nicobar' },
  { code: '36', name: 'Telangana', label: '36 - Telangana' },
  { code: '37', name: 'Andhra Pradesh', label: '37 - Andhra Pradesh' },
  { code: '38', name: 'Ladakh', label: '38 - Ladakh' },
  { code: '97', name: 'Other Territory', label: '97 - Other Territory' },
];

export function getPlaceOfSupplyDisplay(gstNumber?: string, overridePlace?: string): string {
  if (overridePlace && overridePlace.trim()) {
    const codeOrName = overridePlace.trim();
    const found = INDIAN_GST_STATES.find(
      (s) => s.code === codeOrName || s.name.toLowerCase() === codeOrName.toLowerCase() || s.label === codeOrName
    );
    if (found) return found.label;
    return overridePlace;
  }
  if (gstNumber && /^\d{2}/.test(gstNumber.trim())) {
    const code = gstNumber.trim().slice(0, 2);
    const found = INDIAN_GST_STATES.find((s) => s.code === code);
    if (found) return found.label;
    return `State Code ${code}`;
  }
  return '34 - Puducherry';
}

/**
 * Convert numeric amount to words (standard for tax invoices)
 */
export function numberToWords(amount: number, currency: string = 'INR'): string {
  if (amount <= 0 || isNaN(amount)) return 'Zero';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teenDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 10) return singleDigits[n];
    if (n >= 10 && n < 20) return teenDigits[n - 10];
    const unit = n % 10;
    return tens[Math.floor(n / 10)] + (unit > 0 ? ' ' + singleDigits[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;
    let res = '';
    if (hundred > 0) {
      res += singleDigits[hundred] + ' Hundred';
      if (remainder > 0) res += ' and ';
    }
    if (remainder > 0) {
      res += convertTwoDigits(remainder);
    }
    return res;
  }

  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  // Indian numbering: Crores, Lakhs, Thousands, Hundreds
  const crore = Math.floor(intPart / 10000000);
  const lakh = Math.floor((intPart % 10000000) / 100000);
  const thousand = Math.floor((intPart % 100000) / 1000);
  const remaining = intPart % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(convertThreeDigits(crore) + ' Crore');
  if (lakh > 0) parts.push(convertTwoDigits(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertTwoDigits(thousand) + ' Thousand');
  if (remaining > 0) parts.push(convertThreeDigits(remaining));

  const words = parts.join(' ') || 'Zero';
  const currencyUnit = currency === 'INR' ? 'Rupees' : currency === 'USD' ? 'Dollars' : currency === 'EUR' ? 'Euros' : currency === 'GBP' ? 'Pounds' : currency;
  const decimalUnit = currency === 'INR' ? 'Paise' : 'Cents';

  let result = `${currencyUnit} ${words}`;
  if (decPart > 0) {
    result += ` and ${convertTwoDigits(decPart)} ${decimalUnit}`;
  }
  return result + ' Only';
}
