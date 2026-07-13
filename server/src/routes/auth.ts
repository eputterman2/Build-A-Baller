import { Router } from 'express';
import { z } from 'zod';
import {
  loginUser, registerUser, requestPasswordReset, requireAuth, resetPassword, signToken,
} from '../auth';
import { hasDisallowedPublicContent } from '../moderation';
import { config } from '../env';

export const authRouter = Router();

const usernameSchema = z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/,
  'Username may only contain letters, numbers, and underscores');
const passwordSchema = z.string().min(6).max(100);
const emailSchema = z.string().trim().email('Enter a valid email address').max(254)
  .transform(value => value.toLowerCase());

const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
}).refine(
  credentials => !hasDisallowedPublicContent(credentials.username),
  { path: ['username'], message: 'Username contains language that is not allowed' },
);

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').max(254),
  password: passwordSchema,
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(20),
  password: passwordSchema,
});

async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<'sent' | 'not_configured' | 'failed'> {
  if (!config.resendApiKey) return 'not_configured';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.feedbackFrom,
        to,
        subject: 'Reset your Build-A-Baller password',
        text: [
          'Reset your Build-A-Baller password using this link:',
          resetUrl,
          '',
          'This link expires in 1 hour. If you did not request this, you can ignore this email.',
        ].join('\n'),
      }),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);
    const user = await registerUser(username, email, password);
    res.status(201).json({ token: signToken(user), user });
  } catch (err) { next(err); }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await loginUser(email, password);
    res.json({ token: signToken(user), user });
  } catch (err) { next(err); }
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const reset = await requestPasswordReset(email);
    let resetUrl = '';
    let emailStatus: 'sent' | 'not_configured' | 'failed' | 'no_account' = 'no_account';

    if (reset) {
      resetUrl = `${config.clientOrigin}/reset-password?token=${encodeURIComponent(reset.token)}`;
      emailStatus = await sendPasswordResetEmail(reset.email, resetUrl);
    }

    res.json({
      ok: true,
      message: 'If an account exists for that email, a reset link will be sent.',
      ...(!config.isProd && resetUrl && emailStatus !== 'sent' ? { resetUrl } : {}),
    });
  } catch (err) { next(err); }
});

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await resetPassword(token, password);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
