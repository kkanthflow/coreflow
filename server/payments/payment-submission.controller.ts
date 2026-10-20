import { Response } from 'express';
import { PaymentSubmissionService } from './payment-submission.service';

export class PaymentSubmissionController {
  static async submitProof(req: any, res: Response) {
    try {
      const result = await PaymentSubmissionService.submitProof(req.user.id, req.body);
      res.status(201).json(result);
    } catch (err: any) {
      console.error('[PaymentSubmissionController.submitProof] Error:', err);
      const isForbidden = err.message?.includes('Forbidden') || err.message?.includes('cannot be submitted');
      const isNotFound = err.message?.includes('not found');
      const status = isForbidden ? 403 : isNotFound ? 404 : 400;
      res.status(status).json({
        success: false,
        error: err.message || 'Failed to submit payment proof'
      });
    }
  }

  static async listSubmissions(req: any, res: Response) {
    try {
      const orgIdHeader = (req.headers['x-organization-id'] || req.headers['organization-id']) as string | undefined;
      const { status, invoice_id } = req.query;
      const result = await PaymentSubmissionService.listSubmissions(req.user.id, orgIdHeader, {
        status: status as string | undefined,
        invoice_id: invoice_id as string | undefined
      });
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[PaymentSubmissionController.listSubmissions] Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to list payment submissions'
      });
    }
  }

  static async confirmSubmission(req: any, res: Response) {
    try {
      const { id } = req.params;
      const result = await PaymentSubmissionService.confirmSubmission(req.user.id, id);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[PaymentSubmissionController.confirmSubmission] Error:', err);
      const isForbidden = err.message?.includes('Forbidden');
      res.status(isForbidden ? 403 : 400).json({
        success: false,
        error: err.message || 'Failed to confirm payment submission'
      });
    }
  }

  static async rejectSubmission(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await PaymentSubmissionService.rejectSubmission(req.user.id, id, reason);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[PaymentSubmissionController.rejectSubmission] Error:', err);
      const isForbidden = err.message?.includes('Forbidden');
      res.status(isForbidden ? 403 : 400).json({
        success: false,
        error: err.message || 'Failed to reject payment submission'
      });
    }
  }

  static async getReceiptUrl(req: any, res: Response) {
    try {
      const { id } = req.params;
      const result = await PaymentSubmissionService.getReceiptSignedUrl(req.user.id, id);
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[PaymentSubmissionController.getReceiptUrl] Error:', err);
      res.status(404).json({
        success: false,
        error: err.message || 'Failed to get receipt URL'
      });
    }
  }
}
