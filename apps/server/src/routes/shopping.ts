import { and, asc, eq, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  addShoppingRequestSchema,
  scaleAmount,
  updateShoppingItemRequestSchema,
  type AddShoppingResponse,
  type ClearShoppingResponse,
  type ShoppingItem,
  type ShoppingResponse,
} from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import type { Db } from '../db/client.ts';
import { dishIngredientsOf, findPublishedDish } from '../db/content.ts';
import { hasAccess } from '../db/cooks.ts';
import { dishes, dishIngredients, shoppingItems } from '../db/schema.ts';
import { ApiHttpError } from '../http/errors.ts';
import { parseOr400, type RouteDeps } from './deps.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Items of the user (matching `where`) with the ingredient and the dish, oldest first. */
async function selectItems(db: Db, where: SQL | undefined): Promise<ShoppingItem[]> {
  const rows = await db
    .select({
      id: shoppingItems.id,
      dishId: shoppingItems.dishId,
      dishTitle: dishes.title,
      baseServings: dishes.baseServings,
      servings: shoppingItems.servings,
      product: dishIngredients.product,
      name: dishIngredients.name,
      amount: dishIngredients.amount,
      unit: dishIngredients.unit,
      aisle: dishIngredients.aisle,
      checked: shoppingItems.checked,
      createdAt: shoppingItems.createdAt,
    })
    .from(shoppingItems)
    .innerJoin(dishIngredients, eq(dishIngredients.id, shoppingItems.ingredientId))
    .innerJoin(dishes, eq(dishes.id, shoppingItems.dishId))
    .where(where)
    .orderBy(asc(shoppingItems.createdAt), asc(dishIngredients.sort), asc(shoppingItems.id));
  return rows.map((row) => ({
    id: row.id,
    dishId: row.dishId,
    dishTitle: row.dishTitle,
    product: row.product,
    name: row.name,
    amount: scaleAmount(row, row.baseServings, row.servings),
    unit: row.unit,
    aisle: row.aisle,
    checked: row.checked,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * The shopping list: `GET /shopping`, `POST /shopping` (the dish's unchecked items are replaced
 * with the sent ingredients), `PATCH /shopping/:id` (bought or not), `DELETE /shopping/checked`.
 */
export function shoppingRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get('/api/shopping', async (request): Promise<ShoppingResponse> => {
    const user = requireUser(request);
    return { items: await selectItems(deps.db, eq(shoppingItems.userId, user.id)) };
  });

  app.post('/api/shopping', async (request, reply): Promise<AddShoppingResponse> => {
    const body = parseOr400(addShoppingRequestSchema, request.body, 'Invalid shopping items');
    const user = requireUser(request);
    const dish = await findPublishedDish(deps.db, body.dishId);
    if (!dish) throw new ApiHttpError(404, 'not_found', 'Dish not found');
    if (!(await hasAccess(deps.db, user.id, dish.countryId)))
      throw new ApiHttpError(403, 'paywall', 'Subscription required');
    const byKey = new Map(
      (await dishIngredientsOf(deps.db, dish.id)).map((ingredient) => [ingredient.key, ingredient]),
    );
    const ingredientIds = body.ingredientKeys.map((key) => byKey.get(key)?.id);
    if (ingredientIds.some((id) => id === undefined))
      throw new ApiHttpError(400, 'validation', 'Unknown ingredient');

    const now = deps.now();
    await deps.db.transaction(async (tx) => {
      await tx
        .delete(shoppingItems)
        .where(
          and(
            eq(shoppingItems.userId, user.id),
            eq(shoppingItems.dishId, dish.id),
            eq(shoppingItems.checked, false),
          ),
        );
      await tx.insert(shoppingItems).values(
        ingredientIds.flatMap((ingredientId) =>
          ingredientId === undefined
            ? []
            : [
                {
                  userId: user.id,
                  ingredientId,
                  dishId: dish.id,
                  servings: body.servings,
                  createdAt: now,
                },
              ],
        ),
      );
    });
    reply.code(201);
    return { added: ingredientIds.length };
  });

  app.delete('/api/shopping/checked', async (request): Promise<ClearShoppingResponse> => {
    const user = requireUser(request);
    const removed = await deps.db
      .delete(shoppingItems)
      .where(and(eq(shoppingItems.userId, user.id), eq(shoppingItems.checked, true)))
      .returning({ id: shoppingItems.id });
    return { removed: removed.length };
  });

  app.patch<{ Params: { id: string } }>(
    '/api/shopping/:id',
    async (request): Promise<ShoppingItem> => {
      const body = parseOr400(
        updateShoppingItemRequestSchema,
        request.body,
        'Invalid shopping item',
      );
      const user = requireUser(request);
      const notFound = new ApiHttpError(404, 'not_found', 'Shopping item not found');
      if (!UUID_RE.test(request.params.id)) throw notFound;
      const mine = and(eq(shoppingItems.id, request.params.id), eq(shoppingItems.userId, user.id));
      const changed = await deps.db
        .update(shoppingItems)
        .set({ checked: body.checked })
        .where(mine)
        .returning({ id: shoppingItems.id });
      if (changed.length === 0) throw notFound;
      const [item] = await selectItems(deps.db, mine);
      if (!item) throw notFound;
      return item;
    },
  );
}
