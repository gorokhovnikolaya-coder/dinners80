import type { FastifyInstance } from 'fastify';

import {
  clampServings,
  defaultServings,
  dishLabel,
  dishQuerySchema,
  scaleAmount,
  type DishResponse,
  type PaywallError,
} from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import {
  contentImageUrl,
  dishIngredientsOf,
  dishStepsOf,
  findPublishedDish,
} from '../db/content.ts';
import { cooksOf, hasAccess } from '../db/cooks.ts';
import { ApiHttpError } from '../http/errors.ts';
import type { RouteDeps } from './deps.ts';

/**
 * `GET /dishes/:id?servings=`: the dish card with ingredients recalculated for the servings
 * (default — by «who eats») and the steps. Without access by `has_access` — `403 paywall` with
 * only the preview (country, title, photo).
 */
export function dishRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get<{ Params: { id: string } }>('/api/dishes/:id', async (request, reply) => {
    const user = requireUser(request);
    const dish = await findPublishedDish(deps.db, request.params.id);
    if (!dish) throw new ApiHttpError(404, 'not_found', 'Dish not found');
    const imageUrl = contentImageUrl(deps.mediaUrl, dish.imagePath);

    if (!(await hasAccess(deps.db, user.id, dish.countryId))) {
      const body: PaywallError = {
        error: {
          code: 'paywall',
          message: 'Subscription required',
          preview: {
            dishId: dish.id,
            title: dish.title,
            countryId: dish.countryId,
            countryName: dish.countryName,
            imageUrl,
          },
        },
      };
      return reply.code(403).send(body);
    }

    // An invalid `servings` falls back to the default (`dishQuerySchema` catches it).
    const query = dishQuerySchema.parse(request.query);
    const servings = clampServings(query.servings ?? defaultServings(user.household));
    const [ingredients, steps, userCooks] = await Promise.all([
      dishIngredientsOf(deps.db, dish.id),
      dishStepsOf(deps.db, dish.id),
      cooksOf(deps.db, [user.id]),
    ]);
    const body: DishResponse = {
      id: dish.id,
      title: dish.title,
      countryId: dish.countryId,
      countryName: dish.countryName,
      level: dish.level,
      minutes: dish.minutes,
      description: dish.description,
      fact: dish.fact,
      imageUrl,
      label: dishLabel(dish, userCooks),
      baseServings: dish.baseServings,
      servings,
      ingredients: ingredients.map((ingredient) => ({
        key: ingredient.key,
        product: ingredient.product,
        name: ingredient.name,
        baseAmount: ingredient.amount,
        amount: scaleAmount(ingredient, dish.baseServings, servings),
        unit: ingredient.unit,
        aisle: ingredient.aisle,
      })),
      steps,
    };
    return body;
  });
}
