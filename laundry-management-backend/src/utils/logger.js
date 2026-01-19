const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'laundro-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Wrapper for audit log to use winston instead of just console
// We will deprecate the old audit logger or integrate it here
const logAudit = async (user, action, entity, entityId, metadata = {}) => {
  const AuditLog = require('../models/AuditLog'); // Lazy load avoids circular dep issues if any, though likely safe here
  
  if (!user) {
    logger.warn('Audit Log skipped: No user provided for action %s', action);
    return;
  }

  // Log to file/console
  logger.info(`AUDIT: [${action}] by ${user.email || user.phone || user._id} on ${entity}:${entityId}`, { metadata });

  // Save to DB
  try {
     await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action,
      entity,
      entityId,
      metadata
    });
  } catch (err) {
    logger.error('Failed to save audit log to DB', err);
  }
};

module.exports = { logger, logAudit };
