const winston = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
  transports: [
    new winston.transports.Console(),
  ],
});

module.exports = logger;
