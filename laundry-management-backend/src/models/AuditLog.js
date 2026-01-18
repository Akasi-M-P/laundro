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

// Index for fast querying by shop or actor
AuditLogSchema.index({ entityId: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
