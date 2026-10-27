const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AppError } = require('../errors');
const { audit } = require('../services/audit');
const slotSchema = z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime() }).refine(v => new Date(v.endsAt) > new Date(v.startsAt), 'endsAt must be after startsAt');
router.get('/search', async (req,res,next) => {
  try {
    const q = String(req.query.q || '').slice(0,100);
    const specialty = String(req.query.specialty || '').slice(0,100);
    const limit = Math.min(Math.max(Number(req.query.limit || 20),1),100);
    const r = await pool.query(
      `SELECT u.id,p.full_name,d.specialty,d.bio,d.consultation_fee_cents
       FROM doctors d JOIN users u ON u.id=d.user_id JOIN profiles p ON p.user_id=u.id
       WHERE d.verified=true AND u.is_active=true AND ($1='' OR d.specialty ILIKE '%'||$1||'%')
       AND ($2='' OR p.full_name ILIKE '%'||$2||'%') ORDER BY p.full_name LIMIT $3`,
      [specialty,q,limit]
    );
    res.json({ success:true, data:r.rows });
  } catch(e) { next(e); }
});
router.post('/availability', authenticate, requireRole('DOCTOR'), validate(slotSchema), async (req,res,next) => {
  try {
    if (new Date(req.body.startsAt) <= new Date()) throw new AppError(400,'INVALID_SLOT','Availability must be in the future');
    const r = await pool.query(
      `INSERT INTO availability_slots(doctor_id,starts_at,ends_at) VALUES($1,$2,$3)
       RETURNING id,doctor_id,starts_at,ends_at,status`,
      [req.auth.userId, req.body.startsAt, req.body.endsAt]
    );
    await audit({ actorId:req.auth.userId, action:'AVAILABILITY_CREATED', resourceType:'availability_slot', resourceId:r.rows[0].id, requestId:req.id });
    res.status(201).json({ success:true, data:r.rows[0] });
  } catch(e) { next(e); }
});
router.get('/:doctorId/availability', async (req,res,next) => {
  try {
    const r = await pool.query(
      `SELECT id,doctor_id,starts_at,ends_at FROM availability_slots
       WHERE doctor_id=$1 AND status='AVAILABLE' AND starts_at>now() ORDER BY starts_at LIMIT 100`,
      [req.params.doctorId]
    );
    res.json({ success:true, data:r.rows });
  } catch(e) { next(e); }
});
module.exports = router;
