-- Passed countries and access to a country (ТЗ, «Модель данных»). Drizzle Kit does not manage
-- views defined elsewhere and functions, so this migration is written by hand.

-- A country is passed once the user has at least one cook of its dish; the first cook is the stamp.
CREATE VIEW "user_countries" AS
SELECT "user_id", "country_id", min("created_at") AS "first_stamp_at"
FROM "cooks"
GROUP BY "user_id", "country_id";
--> statement-breakpoint

-- true if the country is already passed, or the user has passed fewer than 10 countries (any 10
-- of their choice are free; FREE_COUNTRIES_LIMIT in packages/shared), or has an active
-- subscription: status 'active' and expires_at in the future ('refunded' and 'expired' give no
-- access). Passed countries stay open after the subscription ends.
CREATE FUNCTION "has_access"(p_user_id uuid, p_country_id text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM "cooks" WHERE "user_id" = p_user_id AND "country_id" = p_country_id
    )
    OR (
      SELECT count(DISTINCT "country_id") FROM "cooks" WHERE "user_id" = p_user_id
    ) < 10
    OR EXISTS (
      SELECT 1 FROM "subscriptions"
      WHERE "user_id" = p_user_id AND "status" = 'active' AND "expires_at" > now()
    );
$$;
