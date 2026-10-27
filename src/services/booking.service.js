const { pool } = require('../db');
const { AppError } = require('../errors');
const { audit } = require('./audit');
const crypto = require('node:crypto');

async function book({ patientId, slotId, reason, idempotencyKey, requestId }) {
  const hash = crypto.createHash('sha256').update(JSON.stringify({ slotId, reason: reason || '' })).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prior = await client.query('SELECT request_hash,response_status,response_body FROM idempotency_keys WHERE actor_id=$1 AND key=$2 FOR UPDATE', [patientId, idempotencyKey]);
    if (prior.rowCount) {
      if (prior.rows[0].request_hash !== hash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with a different request');
      if (prior.rows[0].response_body) {
        await client.query('COMMIT');
        return prior.rows[0].response_body;
      }
      throw new AppError(409, 'REQUEST_IN_PROGRESS', 'A request with this idempotency key is in progress');
    }
    await client.query(
      `INSERT INTO idempotency_keys(actor_id,key,request_hash) VALUES($1,$2,$3)`,
      [patientId, idempotencyKey, hash]
    );
    const slot = await client.query(
      `SELECT s.id,s.doctor_id,s.starts_at,s.ends_at,s.status,d.verified
       FROM availability_slots s JOIN doctors d ON d.user_id=s.doctor_id
       WHERE s.id=$1 FOR UPDATE OF s`, [slotId]
    );
    if (!slot.rowCount || slot.rows[0].status !== 'AVAILABLE' || !slot.rows[0].verified || new Date(slot.rows[0].starts_at) <= new Date()) {
      throw new AppError(409, 'SLOT_UNAVAILABLE', 'This appointment slot is not available');
    }
    const s = slot.rows[0];
    const created = await client.query(
      `INSERT INTO consultations(patient_id,doctor_id,slot_id,status,reason,idempotency_key)
       VALUES($1,$2,$3,'BOOKED',$4,$5) RETURNING id,patient_id,doctor_id,slot_id,status,reason,created_at`,
      [patientId, s.doctor_id, slotId, reason || null, idempotencyKey]
    );
    await client.query(`UPDATE availability_slots SET status='BOOKED' WHERE id=$1`, [slotId]);
    await audit({ actorId: patientId, action: 'CONSULTATION_BOOKED', resourceType: 'consultation', resourceId: created.rows[0].id, requestId }, client);
    await client.query(`UPDATE idempotency_keys SET response_status=201,response_body=$3::jsonb WHERE actor_id=$1 AND key=$2`,
      [patientId, idempotencyKey, JSON.stringify(created.rows[0])]);
    await client.query('COMMIT');
    return created.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
module.exports = { book };
