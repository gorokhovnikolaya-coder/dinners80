CREATE TABLE "cooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"dish_id" text NOT NULL,
	"country_id" text NOT NULL,
	"photo_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" text PRIMARY KEY NOT NULL,
	"name_ru" text NOT NULL,
	"continent" text NOT NULL,
	"sort" integer NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	CONSTRAINT "countries_continent_check" CHECK ("countries"."continent" in ('europe', 'asia', 'americas', 'africa_oceania'))
);
--> statement-breakpoint
CREATE TABLE "dish_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_id" text NOT NULL,
	"key" text NOT NULL,
	"product" text NOT NULL,
	"name" text NOT NULL,
	"amount" numeric,
	"unit" text,
	"aisle" text NOT NULL,
	"sort" integer NOT NULL,
	CONSTRAINT "dish_ingredients_dish_key_unique" UNIQUE("dish_id","key"),
	CONSTRAINT "dish_ingredients_id_dish_unique" UNIQUE("id","dish_id"),
	CONSTRAINT "dish_ingredients_unit_check" CHECK ("dish_ingredients"."unit" in ('g', 'ml', 'pcs', 'tbsp', 'tsp', 'clove', 'pinch')),
	CONSTRAINT "dish_ingredients_aisle_check" CHECK ("dish_ingredients"."aisle" in ('meat', 'veg', 'dairy', 'grocery', 'other')),
	CONSTRAINT "dish_ingredients_amount_check" CHECK (("dish_ingredients"."amount" is null) = ("dish_ingredients"."unit" is null) and ("dish_ingredients"."amount" is null or "dish_ingredients"."amount" > 0))
);
--> statement-breakpoint
CREATE TABLE "dish_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_id" text NOT NULL,
	"n" smallint NOT NULL,
	"text" text NOT NULL,
	"timer_seconds" integer,
	CONSTRAINT "dish_steps_dish_n_unique" UNIQUE("dish_id","n"),
	CONSTRAINT "dish_steps_n_check" CHECK ("dish_steps"."n" > 0),
	CONSTRAINT "dish_steps_timer_check" CHECK ("dish_steps"."timer_seconds" is null or "dish_steps"."timer_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "dishes" (
	"id" text PRIMARY KEY NOT NULL,
	"country_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"level" text NOT NULL,
	"minutes" integer NOT NULL,
	"base_servings" smallint NOT NULL,
	"description" text NOT NULL,
	"fact" text NOT NULL,
	"image_path" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	CONSTRAINT "dishes_country_slug_unique" UNIQUE("country_id","slug"),
	CONSTRAINT "dishes_id_country_unique" UNIQUE("id","country_id"),
	CONSTRAINT "dishes_level_check" CHECK ("dishes"."level" in ('weekday', 'weekend', 'challenge')),
	CONSTRAINT "dishes_tags_check" CHECK ("dishes"."tags" <@ array['meat', 'spicy', 'gluten']::text[]),
	CONSTRAINT "dishes_minutes_check" CHECK ("dishes"."minutes" > 0),
	CONSTRAINT "dishes_base_servings_check" CHECK ("dishes"."base_servings" between 1 and 8)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"user_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_user_id_friend_id_pk" PRIMARY KEY("user_id","friend_id"),
	CONSTRAINT "friendships_not_self_check" CHECK ("friendships"."user_id" <> "friendships"."friend_id")
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"dish_id" text NOT NULL,
	"servings" smallint NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_items_servings_check" CHECK ("shopping_items"."servings" between 1 and 8)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"stars_amount" integer NOT NULL,
	"telegram_payment_charge_id" text NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_telegram_payment_charge_id_unique" UNIQUE("telegram_payment_charge_id"),
	CONSTRAINT "subscriptions_plan_check" CHECK ("subscriptions"."plan" in ('month', 'year')),
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" in ('active', 'expired', 'refunded')),
	CONSTRAINT "subscriptions_stars_check" CHECK ("subscriptions"."stars_amount" > 0),
	CONSTRAINT "subscriptions_period_check" CHECK ("subscriptions"."expires_at" > "subscriptions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tg_id" bigint NOT NULL,
	"first_name" text NOT NULL,
	"username" text,
	"photo_url" text,
	"household" text,
	"weekday_minutes" smallint,
	"exclusions" text[] DEFAULT '{}' NOT NULL,
	"custom_exclusions" text[] DEFAULT '{}' NOT NULL,
	"timezone" text DEFAULT 'Europe/Moscow' NOT NULL,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_time" time DEFAULT '18:00:00' NOT NULL,
	"bot_can_write" boolean DEFAULT false NOT NULL,
	"invite_code" text NOT NULL,
	"invited_by" uuid,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tg_id_unique" UNIQUE("tg_id"),
	CONSTRAINT "users_invite_code_unique" UNIQUE("invite_code"),
	CONSTRAINT "users_household_check" CHECK ("users"."household" in ('solo', 'couple', 'family')),
	CONSTRAINT "users_weekday_minutes_check" CHECK ("users"."weekday_minutes" in (20, 30, 45)),
	CONSTRAINT "users_exclusions_check" CHECK ("users"."exclusions" <@ array['meat', 'spicy', 'gluten']::text[]),
	CONSTRAINT "users_custom_exclusions_check" CHECK (coalesce(array_length("users"."custom_exclusions", 1), 0) <= 10)
);
--> statement-breakpoint
ALTER TABLE "cooks" ADD CONSTRAINT "cooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooks" ADD CONSTRAINT "cooks_dish_country_fk" FOREIGN KEY ("dish_id","country_id") REFERENCES "public"."dishes"("id","country_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_ingredients" ADD CONSTRAINT "dish_ingredients_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_steps" ADD CONSTRAINT "dish_steps_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dishes" ADD CONSTRAINT "dishes_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_ingredient_dish_fk" FOREIGN KEY ("ingredient_id","dish_id") REFERENCES "public"."dish_ingredients"("id","dish_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cooks_dish_country_idx" ON "cooks" USING btree ("dish_id","country_id");--> statement-breakpoint
CREATE INDEX "cooks_user_created_idx" ON "cooks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "cooks_user_country_idx" ON "cooks" USING btree ("user_id","country_id");--> statement-breakpoint
CREATE INDEX "events_name_created_idx" ON "events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "friendships_friend_idx" ON "friendships" USING btree ("friend_id");--> statement-breakpoint
CREATE INDEX "shopping_items_user_idx" ON "shopping_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shopping_items_ingredient_dish_idx" ON "shopping_items" USING btree ("ingredient_id","dish_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_expires_idx" ON "subscriptions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "users_invited_by_idx" ON "users" USING btree ("invited_by");