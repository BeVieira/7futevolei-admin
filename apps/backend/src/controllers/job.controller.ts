import { Request, Response } from "express";
import { PushNotConfiguredError } from "../lib/push-service";
import { sendReceiptReminders } from "../lib/receipt-reminders";

export async function runReceiptReminders(_req: Request, res: Response) {
  try {
    res.json(await sendReceiptReminders());
  } catch (error) {
    if (error instanceof PushNotConfiguredError) {
      res.status(503).json({ error: error.message });
      return;
    }
    throw error;
  }
}
