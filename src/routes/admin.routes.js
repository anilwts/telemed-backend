const router = require('express').Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
router.get('/analytics', authenticate, requireRole('ADMIN'), async (req,res,next) => {
  try {
    const [users,consultations,byStatus] = await Promise.all([
      pool.query('SELECT role,count(*)::int AS count FROM users GROUP BY role'),
      pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at >= now()-interval '24 hours')::int AS last_24h FROM consultations`),
      pool.query('SELECT status,count(*)::int AS count FROM consultations GROUP BY status')
    ]);
    res.json({success:true,data:{users:users.rows,consultations:consultations.rows[0],consultationsByStatus:byStatus.rows}});
  } catch(e) { next(e); }
});
router.get('/audit', authenticate, requireRole('ADMIN'), async (req,res,next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 50),1),200);
    const r = await pool.query('SELECT id,actor_user_id,action,resource_type,resource_id,request_id,metadata,created_at FROM audit_logs ORDER BY id DESC LIMIT $1',[limit]);
    res.json({success:true,data:r.rows});
  } catch(e) { next(e); }
});
module.exports = router;
