const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { book } = require('../services/booking.service');
const { AppError } = require('../errors');
const { audit } = require('../services/audit');
const bookSchema = z.object({ slotId: z.string().uuid(), reason: z.string().trim().max(2000).optional() });
const statusSchema = z.object({ status: z.enum(['CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW']) });
router.post('/', authenticate, requireRole('PATIENT'), validate(bookSchema), async (req,res,next) => {
  try {
    const key = req.get('idempotency-key');
    if (!key || key.length > 128) throw new AppError(400,'IDEMPOTENCY_KEY_REQUIRED','Send a valid Idempotency-Key header');
    const data = await book({ patientId:req.auth.userId, slotId:req.body.slotId, reason:req.body.reason, idempotencyKey:key, requestId:req.id });
    res.status(201).json({ success:true, data });
  } catch(e) { next(e); }
});
router.get('/mine', authenticate, async (req,res,next) => {
  try {
    const r = await pool.query(
      `SELECT c.id,c.patient_id,c.doctor_id,c.slot_id,c.status,c.reason,c.created_at,s.starts_at,s.ends_at,
       p.full_name AS doctor_name,d.specialty
       FROM consultations c JOIN availability_slots s ON s.id=c.slot_id
       JOIN profiles p ON p.user_id=c.doctor_id JOIN doctors d ON d.user_id=c.doctor_id
       WHERE ($1='ADMIN' OR ($1='PATIENT' AND c.patient_id=$2) OR ($1='DOCTOR' AND c.doctor_id=$2))
       ORDER BY s.starts_at DESC LIMIT 100`, [req.auth.role,req.auth.userId]
    );
    res.json({ success:true, data:r.rows });
  } catch(e) { next(e); }
});
router.patch('/:id/status', authenticate, requireRole('DOCTOR','ADMIN'), validate(statusSchema), async (req,res,next) => {
  const allowed = {
    BOOKED:['CONFIRMED','CANCELLED'],
    CONFIRMED:['IN_PROGRESS','CANCELLED','NO_SHOW'],
    IN_PROGRESS:['COMPLETED']
  };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const c = await client.query('SELECT * FROM consultations WHERE id=$1 FOR UPDATE',[req.params.id]);
    if (!c.rowCount) throw new AppError(404,'NOT_FOUND','Consultation not found');
    if (req.auth.role === 'DOCTOR' && c.rows[0].doctor_id !== req.auth.userId) throw new AppError(403,'FORBIDDEN','Cannot update another doctor consultation');
    if (!(allowed[c.rows[0].status] || []).includes(req.body.status)) throw new AppError(409,'INVALID_TRANSITION',`Cannot transition ${c.rows[0].status} to ${req.body.status}`);
    const updated = await client.query('UPDATE consultations SET status=$2,updated_at=now() WHERE id=$1 RETURNING *',[req.params.id,req.body.status]);
    if (req.body.status === 'CANCELLED') await client.query("UPDATE availability_slots SET status='AVAILABLE' WHERE id=$1",[c.rows[0].slot_id]);
    await audit({actorId:req.auth.userId,action:'CONSULTATION_STATUS_CHANGED',resourceType:'consultation',resourceId:req.params.id,requestId:req.id,metadata:{status:req.body.status}},client);
    await client.query('COMMIT');
    res.json({success:true,data:updated.rows[0]});
  } catch(e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});
module.exports = router;
