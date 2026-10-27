const { pool } = require('../db');
async function audit({ actorId, action, resourceType, resourceId, requestId, metadata = {} }, client = pool) {
  await client.query(
    `INSERT INTO audit_logs(actor_user_id, action, resource_type, resource_id, request_id, metadata)
     VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
    [actorId || null, action, resourceType, resourceId || null, requestId || null, JSON.stringify(metadata)]
  );
}
module.exports = { audit };
