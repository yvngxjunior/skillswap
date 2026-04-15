// Validate environment variables at startup — exits with code 1 if invalid.
// Must be the very first require so all subsequent modules see validated env.
require('./config/env');
require('dotenv').config();

const http = require('http');
const app  = require('./app');
const { initSocket } = require('./socket');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  logger.info(`SkillSwap API running on port ${PORT} [${process.env.NODE_ENV}]`);
});
