import AuditLog from '../models/AuditLog';
import { IUser } from '../models/User';
import mongoose from 'mongoose';

/**
 * Log a system action
 * @param user The user performing the action (req.user)
 * @param action Description of action (e.g. 'CREATE_ORDER')
 * @param entity The entity type being affected (e.g. 'Order')
 * @param entityId The ID of the affected entity
 * @param metadata Additional JSON data
 */
export const logAudit = async (
  user: IUser | undefined,
  action: string,
  entity: string,
  entityId: mongoose.Types.ObjectId | string,
  metadata: any = {}
) => {
  try {
    if (!user) {
      console.warn('Audit Log skipped: No user provided');
      return;
    }

    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action,
      entity,
      entityId,
      metadata
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't crash the request if logging fails, but it's critical to know
  }
};
