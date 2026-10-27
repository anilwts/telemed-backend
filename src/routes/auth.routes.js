const router = require('express').Router();
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const service = require('../services/auth.service');
const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(['PATIENT','DOCTOR']), //,'ADMIN' to admin user
  fullName: z.string().trim().min(2).max(120),
  specialty: z.string().trim().min(2).max(100).optional(),
  licenseNumber: z.string().trim().min(3).max(100).optional()
}).superRefine((v, ctx) => {
  if (v.role === 'DOCTOR' && (!v.specialty || !v.licenseNumber)) ctx.addIssue({ code: 'custom', message: 'Doctor specialty and licenseNumber are required' });
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(128) });
router.post('/register', validate(registerSchema), async (req,res,next) => {
  try { const user = await service.register(req.body, req.id); res.status(201).json({ success:true, data:user }); }
  catch(e) { next(e); }
});
router.post('/login', validate(loginSchema), async (req,res,next) => {
  try { res.json({ success:true, data: await service.login(req.body) }); }
  catch(e) { next(e); }
});
module.exports = router;
