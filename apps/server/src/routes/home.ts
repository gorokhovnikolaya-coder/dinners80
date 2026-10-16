import type { FastifyInstance } from 'fastify';

import {
  buildPassport,
  homeQuerySchema,
  suggestDishes,
  type HomeResponse,
  type MapResponse,
  type SuggestionCard,
} from '@tma80/shared';

import { requireUser } from '../auth/plugin.ts';
import { contentImageUrl, loadPublishedContent } from '../db/content.ts';
import { cooksOf } from '../db/cooks.ts';
import { subscriptionStatus, toUserProfile } from '../db/users.ts';
import { parseOr400, type RouteDeps } from './deps.ts';

/**
 * `GET /home` and `GET /map`: the shared suggestion algorithm and passport over the published
 * content, the user's cooks and the subscription.
 */
export function homeRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get('/api/home', async (request): Promise<HomeResponse> => {
    const query = parseOr400(homeQuerySchema, request.query, 'Invalid home query');
    const user = requireUser(request);
    const now = deps.now();
    const [content, userCooks, subscription] = await Promise.all([
      loadPublishedContent(deps.db),
      cooksOf(deps.db, [user.id]),
      subscriptionStatus(deps.db, user.id, now),
    ]);
    const result = suggestDishes({
      dishes: content.dishes,
      cooks: userCooks,
      user: { ...toUserProfile(user), subscribed: subscription.active },
      mode: query.mode,
      page: query.page,
      now,
    });
    const dishById = new Map(content.dishes.map((dish) => [dish.id, dish]));
    const countryById = new Map(content.countries.map((country) => [country.id, country]));
    const suggestions = result.suggestions.flatMap((item): SuggestionCard[] => {
      const dish = dishById.get(item.dishId);
      const country = dish && countryById.get(dish.countryId);
      if (!dish || !country) return [];
      return [
        {
          dishId: dish.id,
          title: dish.title,
          countryId: country.id,
          countryName: country.nameRu,
          level: dish.level,
          minutes: dish.minutes,
          imageUrl: contentImageUrl(deps.mediaUrl, dish.imagePath),
          label: item.label,
          locked: item.locked,
        },
      ];
    });
    const passed = new Set(userCooks.map((cook) => cook.countryId));
    return {
      mode: query.mode,
      page: result.page,
      pageCount: result.pageCount,
      suggestions,
      countriesCount: content.countries.filter((country) => passed.has(country.id)).length,
      countriesTotal: content.countries.length,
      dishesCount: userCooks.length,
    };
  });

  app.get('/api/map', async (request): Promise<MapResponse> => {
    const user = requireUser(request);
    const [content, userCooks, subscription] = await Promise.all([
      loadPublishedContent(deps.db),
      cooksOf(deps.db, [user.id]),
      subscriptionStatus(deps.db, user.id, deps.now()),
    ]);
    return buildPassport({
      countries: content.countries.map((country) => ({ ...country, name: country.nameRu })),
      dishes: content.dishes.map((dish) => ({
        ...dish,
        imageUrl: contentImageUrl(deps.mediaUrl, dish.imagePath),
      })),
      cooks: userCooks,
      subscribed: subscription.active,
    });
  });
}
