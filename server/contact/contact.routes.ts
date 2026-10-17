import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabaseAdmin, verifySupabaseToken } from '../_core/supabase.js';

export const contactRouter = Router();

// Fallback in-memory storage for custom dev inquiries if DB migration is running
const fallbackInquiries = new Map<string, any>();

// Rate limiter / Spam protection map (per IP)
const ipRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkSpamProtection(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimit.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRateLimit.set(ip, { count: 1, resetAt: now + 60000 }); // 1 min window
    return true;
  }

  if (entry.count >= 5) {
    return false; // Exceeded 5 inquiries per minute
  }

  entry.count += 1;
  return true;
}

const contactFormSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required (at least 2 characters)'),
  contactPerson: z.string().trim().min(2, 'Contact person name is required'),
  businessEmail: z.string().trim().email('Valid business email is required'),
  phoneNumber: z.string().trim().optional(),
  preferredContactMethod: z.enum(['email', 'phone', 'video_call']),
  projectDescription: z.string().trim().min(20, 'Please describe your requirements in at least 20 characters'),
  estimatedBudget: z.string().optional(),
});

/**
 * Route: POST /api/contact/custom-development
 * Stores client custom development inquiries for review by Skavelon Technologies.
 */
contactRouter.post('/custom-development', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown_ip';

    if (!checkSpamProtection(ip)) {
      res.status(429).json({
        error: 'Too many requests. Please wait a minute before submitting again.',
      });
      return;
    }

    const parseResult = contactFormSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid form submission',
        issues: parseResult.error.format(),
      });
      return;
    }

    const {
      companyName,
      contactPerson,
      businessEmail,
      phoneNumber,
      preferredContactMethod,
      projectDescription,
      estimatedBudget,
    } = parseResult.data;

    // Optional user ID from auth header if logged in
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const payload = await verifySupabaseToken(token);
      if (payload && (payload.sub || (payload as any).userId)) {
        userId = (payload.sub || (payload as any).userId) as string;
      }
    }

    const inquiryId = crypto.randomUUID();
    const inquiryRecord = {
      id: inquiryId,
      user_id: userId,
      company_name: companyName,
      contact_person: contactPerson,
      business_email: businessEmail,
      phone_number: phoneNumber || null,
      preferred_contact_method: preferredContactMethod,
      project_description: projectDescription,
      estimated_budget: estimatedBudget || null,
      status: 'new',
      ip_address: ip,
      user_agent: req.headers['user-agent'] || null,
      created_at: new Date().toISOString(),
    };

    // Store in Supabase or fallback
    try {
      await supabaseAdmin.from('custom_development_inquiries').insert(inquiryRecord);
    } catch (err) {
      console.warn('[Contact] Storing in memory fallback:', err);
      fallbackInquiries.set(inquiryId, inquiryRecord);
    }

    console.log(`[Contact] New custom development inquiry from ${companyName} (${businessEmail}) logged for Skavelon Technologies review.`);

    res.status(200).json({
      success: true,
      referenceId: inquiryId,
      message: 'Thank you for reaching out! The Skavelon Technologies engineering team will review your requirements and get in touch within 1 business day.',
    });
  } catch (err: any) {
    console.error('[Contact] Error processing custom development inquiry:', err);
    res.status(500).json({ error: 'Failed to submit inquiry. Please try again later.' });
  }
});
