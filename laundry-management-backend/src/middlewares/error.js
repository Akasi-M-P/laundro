const ErrorResponse = require('../utils/errorResponse');
const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log full error details (server-side only)
  logger.error({
    error: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code,
    requestId: req.id || req.headers['x-request-id'],
    path: req.path,
    method: req.method
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = process.env.NODE_ENV === 'production' 
      ? 'Resource not found' 
      : `Resource not found with id of ${err.value}`;
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ErrorResponse(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ErrorResponse(message, 400);
  }

  // JWT errors (handled in auth middleware mostly, but just in case)
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new ErrorResponse(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Session expired, please login again';
    error = new ErrorResponse(message, 401);
  }

  // In production, don't expose internal error details
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = error.statusCode || 500;
  const message = isProduction && statusCode === 500
    ? 'Internal server error'
    : error.message || 'Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(isProduction ? {} : { stack: err.stack }) // Only include stack in development
  });
};

module.exports = errorHandler;
