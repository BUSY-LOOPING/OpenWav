import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 300,                  
  standardHeaders: true,      
  legacyHeaders: false,      
  message: { error: 'Too many requests, please try again later.' },
});

export default limiter;
