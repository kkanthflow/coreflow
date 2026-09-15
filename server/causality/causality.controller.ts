import { Request, Response } from 'express';
import { CausalityService } from './causality.service';

export class CausalityController {
  static async getWhyDelivery(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const data = await CausalityService.explainDelivery(projectId, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to trace delivery causality' });
    }
  }

  static async getWhyCost(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const data = await CausalityService.explainCost(projectId, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to trace cost causality' });
    }
  }

  static async getWhyProgress(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const data = await CausalityService.explainProgress(projectId, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to trace progress causality' });
    }
  }

  static async getWhyScope(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const data = await CausalityService.explainScope(projectId, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to trace scope causality' });
    }
  }

  static async getProjectDNA(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const data = await CausalityService.getProjectDNA(projectId, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch Project DNA graph' });
    }
  }

  static async getProjectProof(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const data = await CausalityService.getProjectProof(projectId, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch Proof data' });
    }
  }

  static async getCommitmentHistory(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const data = await CausalityService.getCommitmentHistory(projectId, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch commitment history' });
    }
  }

  static async createChangeRequest(req: any, res: Response) {
    try {
      const payload = req.body;
      const data = await CausalityService.createChangeRequest(payload, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create change request' });
    }
  }

  static async decideChangeRequest(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { decision, notes } = req.body;
      if (!['accepted', 'rejected', 'withdrawn'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid decision' });
      }

      const data = await CausalityService.decideChangeRequest(id, decision, notes, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to decide change request' });
    }
  }

  static async getReceiptByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const data = await CausalityService.getReceiptByCode(code);
      if (!data) return res.status(404).json({ error: 'Project receipt not found' });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch receipt' });
    }
  }

  static async getResponsibilityState(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const data = await CausalityService.getResponsibilityState(projectId, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch responsibility status' });
    }
  }

  static async sealProject(req: any, res: Response) {
    try {
      const { projectId, sealNotes } = req.body;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });

      const data = await CausalityService.sealProject(projectId, sealNotes, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to seal project' });
    }
  }

  static async getPlaybackState(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      const targetDate = req.query.targetDate as string;
      if (!projectId || !targetDate) {
        return res.status(400).json({ error: 'projectId and targetDate are required' });
      }

      const data = await CausalityService.getPlaybackState(projectId, targetDate, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch historical playback state' });
    }
  }

  static async compareStates(req: any, res: Response) {
    try {
      const projectId = req.query.projectId as string;
      const dateA = req.query.dateA as string;
      const dateB = req.query.dateB as string;
      if (!projectId || !dateA || !dateB) {
        return res.status(400).json({ error: 'projectId, dateA, and dateB are required' });
      }

      const data = await CausalityService.compareStates(projectId, dateA, dateB, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to compare historical project states' });
    }
  }

  static async provisionClientUser(req: any, res: Response) {
    try {
      const data = await CausalityService.provisionClientUser(req.body, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create client user account' });
    }
  }

  static async createProject(req: any, res: Response) {
    try {
      const data = await CausalityService.createProject(req.body, req.user.id);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to initialize project' });
    }
  }
}
