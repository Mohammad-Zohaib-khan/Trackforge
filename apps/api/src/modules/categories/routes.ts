import { Router } from 'express';
import { createCategorySchema, listCategoriesQuery, updateCategorySchema } from '@trackforge/shared';
import { Category, toCategoryDto } from '../../models/category.js';
import { Transaction } from '../../models/transaction.js';
import { Budget } from '../../models/budget.js';
import { idParam, parse } from '../../middleware/validate.js';
import { authOf } from '../../middleware/auth.js';
import { conflict, notFound } from '../../utils/httpError.js';

const MAX_CATEGORIES_PER_USER = 200;

export function createCategoriesRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { ownerId } = authOf(req);
    const query = parse(listCategoriesQuery, req.query);
    const filter: Record<string, unknown> = { ownerId };
    if (query.type) filter['type'] = query.type;
    if (query.includeArchived === 'false') filter['archived'] = false;
    const categories = await Category.find(filter).sort({ type: 1, nameKey: 1 });
    res.json({ items: categories.map(toCategoryDto) });
  });

  router.post('/', async (req, res) => {
    const { ownerId } = authOf(req);
    const input = parse(createCategorySchema, req.body);
    const count = await Category.countDocuments({ ownerId });
    if (count >= MAX_CATEGORIES_PER_USER) {
      throw conflict('CATEGORY_LIMIT', `You can keep up to ${MAX_CATEGORIES_PER_USER} categories`);
    }
    const nameKey = input.name.toLowerCase();
    if (await Category.exists({ ownerId, type: input.type, nameKey })) {
      throw conflict('CATEGORY_EXISTS', `You already have a ${input.type} category named “${input.name}”`);
    }
    const category = await Category.create({
      ownerId,
      name: input.name,
      nameKey,
      type: input.type,
      icon: input.icon,
      color: input.color ?? null,
    });
    res.status(201).json({ category: toCategoryDto(category) });
  });

  router.patch('/:id', async (req, res) => {
    const { ownerId } = authOf(req);
    const id = idParam(req);
    const input = parse(updateCategorySchema, req.body);
    const category = await Category.findOne({ _id: id, ownerId });
    if (!category) throw notFound('Category');

    if (input.name !== undefined && input.name.toLowerCase() !== category.nameKey) {
      const clash = await Category.exists({ ownerId, type: category.type, nameKey: input.name.toLowerCase(), _id: { $ne: category._id } });
      if (clash) throw conflict('CATEGORY_EXISTS', `You already have a ${category.type} category named “${input.name}”`);
      category.name = input.name;
    }
    if (input.icon !== undefined) category.icon = input.icon;
    if (input.color !== undefined) category.color = input.color;
    if (input.archived !== undefined) category.archived = input.archived;
    await category.save();
    res.json({ category: toCategoryDto(category) });
  });

  /** Hard delete only when nothing references the category; otherwise archive keeps history intact. */
  router.delete('/:id', async (req, res) => {
    const { ownerId } = authOf(req);
    const id = idParam(req);
    const category = await Category.findOne({ _id: id, ownerId });
    if (!category) throw notFound('Category');
    const [usedByTransactions, usedByBudgets] = await Promise.all([
      Transaction.exists({ ownerId, categoryId: category._id }),
      Budget.exists({ ownerId, categoryId: category._id }),
    ]);
    if (usedByTransactions || usedByBudgets) {
      throw conflict(
        'CATEGORY_IN_USE',
        'This category is used by transactions or budgets. Archive it instead so your history stays accurate.',
      );
    }
    await Category.deleteOne({ _id: category._id, ownerId });
    res.status(204).end();
  });

  return router;
}
