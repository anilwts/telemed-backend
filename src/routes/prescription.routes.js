const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AppError } = require('../errors');
const { audit } = require('../services/audit');
const schema = z.object({
  medications: z.array(z.object({ name:z.string().trim().min(1).max(200), dosage:z.string().trim().min(1).max(100), frequency:z.string().trim().min(1).max(100), duration:z.string().trim().min(1).max(100) })).min(1).max(50),
  notes: z.string().max(3000).optional()
});
router.post('/:consultationId', authenticate, requireRole('DOCTOR'), validate(schema), async (req,res,next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const c = await client.query('SELECT * FROM consultations WHERE id=$1 FOR UPDATE',[req.params.consultationId]);
    if (!c.rowCount) throw new AppError(404,'NOT_FOUND','Consultation not found');
    const consultation = c.rows[0];
    if (consultation.doctor_id !== req.auth.userId) throw new AppError(403,'FORBIDDEN','Cannot prescribe for another doctor consultation');
    if (!['IN_PROGRESS','COMPLETED'].includes(consultation.status)) throw new AppError(409,'INVALID_STATE','Prescription requires an active or completed consultation');
    const p = await client.query(
      `INSERT INTO prescriptions(consultation_id,doctor_id,patient_id,medications,notes)
       VALUES($1,$2,$3,$4::jsonb,$5) RETURNING id,consultation_id,doctor_id,patient_id,medications,notes,created_at`,
      [consultation.id,req.auth.userId,consultation.patient_id,JSON.stringify(req.body.medications),req.body.notes || null]
    );
    await audit({actorId:req.auth.userId,action:'PRESCRIPTION_CREATED',resourceType:'prescription',resourceId:p.rows[0].id,requestId:req.id},client);
    await client.query('COMMIT');
    res.status(201).json({success:true,data:p.rows[0]});
  } catch(e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});
router.get('/:consultationId', authenticate, async (req,res,next) => {
  try {
    const r = await pool.query(
      `SELECT p.* FROM prescriptions p JOIN consultations c ON c.id=p.consultation_id
       WHERE p.consultation_id=$1 AND ($2='ADMIN' OR p.patient_id=$3 OR p.doctor_id=$3)`,
      [req.params.consultationId,req.auth.role,req.auth.userId]
    );
    if (!r.rowCount) throw new AppError(404,'NOT_FOUND','Prescription not found');
    res.json({success:true,data:r.rows[0]});
  } catch(e) { next(e); }
});
module.exports = router;
