const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  actorRole: { type: String, required: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  metadata: { type: Schema.Types.Mixed }, // Flexible field for extra details
  timestamp: { type: Date, default: Date.now, immutable: true }
});

// Indexes for audit log queries
AuditLogSchema.index({ entityId: 1, timestamp: -1 }); // Audit trail for an entity
AuditLogSchema.index({ actorId: 1, timestamp: -1 }); // Actions by a user
AuditLogSchema.index({ action: 1, timestamp: -1 }); // Find specific action types
AuditLogSchema.index({ actorRole: 1, timestamp: -1 }); // Actions by role

module.exports = mongoose.model('AuditLog', AuditLogSchema);
