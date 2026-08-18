import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import path from "path";
import * as receiptService from "../lib/receipt-service";
import { reviewReceiptSchema } from "../schemas/receipt.schema";

function parseId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

export async function submitReceipt(req: Request, res: Response) {
  const enrollmentId = parseId(req.params.enrollmentId);

  if (enrollmentId === null) {
    res.status(404).json({ error: "Enrollment not found" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "Arquivo obrigatório" });
    return;
  }

  const filePath = path.join("uploads", "receipts", req.file.filename);

  try {
    const receipt = await receiptService.submitReceipt(enrollmentId, {
      filePath,
      mimeType: req.file.mimetype,
    });
    res.status(201).json(receipt);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      res.status(404).json({ error: "Enrollment not found" });
      return;
    }
    throw error;
  }
}

export async function reviewReceipt(req: Request, res: Response) {
  const enrollmentId = parseId(req.params.enrollmentId);

  if (enrollmentId === null) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }

  const result = reviewReceiptSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  try {
    const receipt = await receiptService.reviewReceipt(
      enrollmentId,
      result.data.status,
      result.data.adminComment,
    );
    res.json(receipt);
  } catch (error) {
    if (error instanceof receiptService.ReceiptNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    throw error;
  }
}
