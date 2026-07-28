const fs = require('fs');
let content = fs.readFileSync('src/queue/queue.ts', 'utf8');

// Replace import logger
content = content.replace(
  /import logger from '\.\.\/utils\/logger';/,
  "import { createChildLogger } from '../logger/childLogger';\nimport { LogAction } from '../logger/actions';\nconst logger = createChildLogger('queue');"
);

content = content.replace(
  /logger\.info\(`\[Queue\] Worker registered for job type: \$\{type\}`\);/g,
  "logger.info({ message: `Worker registered for job type: ${type}` });"
);

content = content.replace(
  /logger\.debug\(`\[Queue\] Added job \[\$\{job\.id\}\] type=\$\{type\} priority=\$\{priority\} attempts=\$\{attempts\}`\);/g,
  "logger.info({ action: LogAction.QUEUE_ENQUEUE, jobId: job.id, jobType: type, priority, attempts, message: 'Added job' });"
);

content = content.replace(
  /logger\.error\(`\[Queue\] Failed to add job: \$\{err\.message\}`\);/g,
  "logger.error({ action: LogAction.QUEUE_FAIL, jobType: type, err, message: `Failed to add job: ${err.message}` });"
);

content = content.replace(
  /logger\.error\(`\[Queue\] No handler registered for job type: \$\{job\.type\}`\);/g,
  "logger.error({ action: LogAction.QUEUE_FAIL, jobId: job.id, jobType: job.type, message: `No handler registered for job type: ${job.type}` });"
);

content = content.replace(
  /logger\.debug\(`\[Queue\] Job \[\$\{job\.id\}\] completed successfully`\);/g,
  "logger.info({ action: LogAction.QUEUE_SUCCESS, jobId: job.id, jobType: job.type, message: 'Job completed successfully' });"
);

content = content.replace(
  /logger\.warn\(`\[Queue\] Job \[\$\{job\.id\}\] failed \(Attempt \$\{job\.attempts\}\): \$\{err\.message\}`\);/g,
  "logger.warn({ action: LogAction.QUEUE_FAIL, jobId: job.id, jobType: job.type, attempts: job.attempts, err, message: `Job failed: ${err.message}` });"
);

content = content.replace(
  /logger\.info\(`\[Queue\] Re-enqueuing job \[\$\{job\.id\}\] for retry`\);/g,
  "logger.info({ action: LogAction.QUEUE_RETRY, jobId: job.id, jobType: job.type, message: 'Re-enqueuing job for retry' });"
);

content = content.replace(
  /logger\.error\(`\[Queue\] Job \[\$\{job\.id\}\] exceeded max retries\. Permanently failed\.`\);/g,
  "logger.error({ action: LogAction.QUEUE_FAIL, jobId: job.id, jobType: job.type, message: 'Job exceeded max retries. Permanently failed.' });"
);

// We should also log QUEUE_PROCESS when starting a job
content = content.replace(
  /const success = await handler\(job\.payload\);/g,
  "logger.info({ action: LogAction.QUEUE_PROCESS, jobId: job.id, jobType: job.type, message: 'Processing job' });\n      const success = await handler(job.payload);"
);

fs.writeFileSync('src/queue/queue.ts', content);
