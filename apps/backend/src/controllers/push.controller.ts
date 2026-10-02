import { Request, Response } from "express";
import {
  PushNotConfiguredError,
  getVapidPublicKey,
  removeSubscription,
  saveSubscription,
} from "../lib/push-service";
import { subscribeSchema, unsubscribeSchema } from "../schemas/push.schema";

function handleNotConfigured(error: unknown, res: Response) {
  if (error instanceof PushNotConfiguredError) {
    res.status(503).json({ error: error.message });
    return;
  }
  throw error;
}

export function getPublicKey(_req: Request, res: Response) {
  try {
    res.json({ publicKey: getVapidPublicKey() });
  } catch (error) {
    handleNotConfigured(error, res);
  }
}

export async function subscribe(req: Request, res: Response) {
  const result = subscribeSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  await saveSubscription(result.data.subscription, res.locals.user.id);
  res.status(204).send();
}

export async function unsubscribe(req: Request, res: Response) {
  const result = unsubscribeSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  await removeSubscription(result.data.endpoint);
  res.status(204).send();
}
