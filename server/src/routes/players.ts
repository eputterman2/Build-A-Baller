import { Router } from 'express';
import { PLAYERS } from '@shared/index';

export const playersRouter = Router();

// The full roster the client spins through.
playersRouter.get('/', (_req, res) => {
  res.json({ players: PLAYERS });
});
