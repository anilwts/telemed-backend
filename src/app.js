const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const client = require('prom-client');
const config = require('./config');
const logger = require('./logger');
const requestId = require('./middleware/request-id');
const { AppError } = require('./errors');
const app = express();
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'telemed_' });
const httpDuration = new client.Histogram({
  name:'telemed_http_request_duration_seconds', help:'HTTP request duration in seconds',
  labelNames:['method','route','status_code'], buckets:[0.005,0.01,0.025,0.05,0.1,0.2,0.5,1,2,5], registers:[registry]
});
app.locals.metrics = { registry, httpDuration };
app.disable('x-powered-by');
app.use(requestId);
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN.split(',').map(s=>s.trim()), credentials:false, methods:['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization','Idempotency-Key','X-Request-Id'] }));
app.use(express.json({ limit:'1mb', strict:true }));
app.use(pinoHttp({ logger, customProps:req=>({ requestId:req.id }), redact:['req.headers.authorization'] }));
app.use(rateLimit({ windowMs:config.RATE_LIMIT_WINDOW_MS, limit:config.RATE_LIMIT_MAX, standardHeaders:'draft-7', legacyHeaders:false, message:{success:false,error:{code:'RATE_LIMITED',message:'Too many requests'}} }));
app.use((req,res,next)=>{
  const start = process.hrtime.bigint();
  res.on('finish',()=>{
    const route = req.route?.path || req.path;
    httpDuration.observe({method:req.method,route,status_code:String(res.statusCode)}, Number(process.hrtime.bigint()-start)/1e9);
  });
  next();
});
app.get('/health/live',(req,res)=>res.json({status:'ok'}));
app.get('/health/ready',async(req,res,next)=>{
  try { const {pool}=require('./db'); await pool.query('SELECT 1'); res.json({status:'ready'}); }
  catch(e){ next(new AppError(503,'NOT_READY','Dependency check failed')); }
});
app.get('/metrics',async(req,res,next)=>{
  try { res.set('Content-Type',registry.contentType); res.end(await registry.metrics()); }
  catch(e){ next(e); }
});
app.use('/api/v1/auth',require('./routes/auth.routes'));
app.use('/api/v1/doctors',require('./routes/doctor.routes'));
app.use('/api/v1/consultations',require('./routes/consultation.routes'));
app.use('/api/v1/prescriptions',require('./routes/prescription.routes'));
app.use('/api/v1/admin',require('./routes/admin.routes'));
app.use((req,res,next)=>next(new AppError(404,'NOT_FOUND','Route not found')));
app.use((err,req,res,next)=>{
  const status = err.status || 500;
  if (status >= 500) logger.error({err,requestId:req.id},'request failed');
  res.status(status).json({success:false,error:{code:err.code || 'INTERNAL_ERROR',message:status >= 500 ? 'Internal server error' : err.message,requestId:req.id}});
});
module.exports = app;
