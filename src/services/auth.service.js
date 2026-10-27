const bcrypt = require('bcryptjs');
const { SignJWT } = require('jose');
const { pool } = require('../db');
const config = require('../config');
const { AppError } = require('../errors');
const key = new TextEncoder().encode(config.JWT_SECRET);

async function register({ email, password, role, fullName, specialty, licenseNumber }, requestId) {
  const normalizedEmail = email.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const addUser = await client.query(
      `INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id,email,role,created_at`,
      [normalizedEmail, hash, role]
    );
    const user = addUser.rows[0];
    await client.query('INSERT INTO profiles(user_id,full_name) VALUES($1,$2)', [user.id, fullName]);
    if (role === 'DOCTOR') {
      if (!specialty || !licenseNumber) throw new AppError(400, 'DOCTOR_DETAILS_REQUIRED', 'Doctor specialty and license number are required');
      await client.query('INSERT INTO doctors(user_id,specialty,license_number) VALUES($1,$2,$3)', [user.id, specialty, licenseNumber]);
    }
    await client.query(
      `INSERT INTO audit_logs(actor_user_id,action,resource_type,resource_id,request_id) VALUES($1,'USER_REGISTERED','user',$2,$3)`,
      [user.id, user.id, requestId]
    );
    await client.query('COMMIT');
    return user;
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') throw new AppError(409, 'ALREADY_EXISTS', 'Email or license number already registered');
    throw e;
  } finally { client.release(); }
}
async function login({ email, password }) {
  const result = await pool.query('SELECT id,email,role,password_hash,is_active,mfa_enabled FROM users WHERE email=$1', [email.trim().toLowerCase()]);
  const user = result.rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (user.mfa_enabled) {
    // Production MFA must verify a TOTP/WebAuthn challenge before issuing tokens.
    throw new AppError(403, 'MFA_REQUIRED', 'MFA is enabled; complete the configured MFA challenge');
  }
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(user.id)
    .setIssuer(config.JWT_ISSUER).setAudience(config.JWT_AUDIENCE)
    .setIssuedAt().setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`).sign(key);
  return { accessToken: token, tokenType: 'Bearer', expiresIn: config.ACCESS_TOKEN_TTL_SECONDS, user: { id: user.id, email: user.email, role: user.role } };
}
module.exports = { register, login };
