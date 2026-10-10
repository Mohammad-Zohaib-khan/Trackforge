import { Router } from 'express';
import { MAX_EXPORT_ROWS, exportQuery, minorToDecimalString } from '@trackforge/shared';
import { Transaction } from '../../models/transaction.js';
import { parse } from '../../middleware/validate.js';
import { authOf } from '../../middleware/auth.js';
import { HttpError } from '../../utils/httpError.js';
import { csvRow, safeFilename } from '../../utils/csv.js';
import { buildTransactionFilter } from '../transactions/filters.js';
import { categoryMapFor } from '../../services/transactionDto.js';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  debit_card: 'Debit card',
  credit_card: 'Credit card',
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  wallet: 'Wallet',
  cheque: 'Cheque',
  other: 'Other',
};

/** Byte-order mark so spreadsheet apps detect UTF-8. */
const UTF8_BOM = '\uFEFF';

export const CSV_HEADER = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Payment method', 'Merchant / payee', 'Note', 'Recurring'];

export function createExportsRouter(): Router {
  const router = Router();

  router.get('/transactions.csv', async (req, res) => {
    const { ownerId, currency } = authOf(req);
    const query = parse(exportQuery, req.query);
    const filter = buildTransactionFilter(ownerId, query, currency);

    // Fetch one extra row to detect oversize exports without counting twice.
    const rows = await Transaction.find(filter)
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .limit(MAX_EXPORT_ROWS + 1)
      .lean();
    if (rows.length > MAX_EXPORT_ROWS) {
      throw new HttpError(
        422,
        'EXPORT_TOO_LARGE',
        `This export has more than ${MAX_EXPORT_ROWS.toLocaleString('en-US')} rows. Choose a shorter date range.`,
      );
    }
    const categories = await categoryMapFor(
      ownerId,
      rows.map((r) => r.categoryId),
    );

    const lines = [csvRow(CSV_HEADER)];
    for (const r of rows) {
      lines.push(
        csvRow([
          r.date,
          r.type === 'income' ? 'Income' : 'Expense',
          categories.get(r.categoryId.toString())?.name ?? 'Deleted category',
          minorToDecimalString(r.amountMinor, r.currency),
          r.currency,
          PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod,
          r.merchant ?? '',
          r.note ?? '',
          r.recurring ? 'Yes' : 'No',
        ]),
      );
    }

    const filename = safeFilename(`trackforge-transactions-${query.from}-to-${query.to}.csv`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Export-Row-Count', String(rows.length));
    // BOM so spreadsheet apps detect UTF-8; CRLF per RFC 4180.
    res.send(`${UTF8_BOM}${lines.join('\r\n')}\r\n`);
  });

  return router;
}
