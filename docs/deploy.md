# Деплой и закрытый тест

Инструкция для человека. Агент на VPS не ходит. Устройство и причины решений — решение 0025, файлы — `deploy/`.

## 1. Что нужно заранее

- VPS с Linux, стабильно открывающийся из России (открытый вопрос ТЗ). Хватит 2 vCPU, 2 ГБ RAM и 20 ГБ диска. Нужны Docker Engine с плагином Compose, `git` и cron.
- Домен, DNS A-запись которого указывает на IP VPS (AAAA — только если на VPS настроен IPv6).
- Бот в @BotFather и мини-апп (`/newapp`): `BOT_USERNAME`, `APP_SHORT_NAME`, токен бота.
- Хранилище бэкапов вне VPS. Например, бакет S3-совместимого хранилища (Yandex Object Storage, Selectel, VK Cloud) с отдельным ключом доступа только к нему.
- 90 фото блюд в `content/<страна>/<slug>.webp`. Без них `deploy.sh` останавливается на seed (`--require-photos`).
- Страницы условий и политики (`TERMS_URL`, `PRIVACY_URL`) и контакт поддержки (`SUPPORT_CONTACT`). Без них бот отвечает заглушками, а профиль скрывает ссылки.

## 2. Первый запуск

```sh
# на VPS
git clone <репозиторий> /srv/tma80 && cd /srv/tma80
cp deploy/env.example deploy/.env && chmod 600 deploy/.env
# заполнить deploy/.env: DOMAIN, LETSENCRYPT_EMAIL, BOT_USERNAME, APP_SHORT_NAME, BOT_TOKEN,
# POSTGRES_PASSWORD и APP_DB_PASSWORD (openssl rand -hex 24), MEDIA_SIGNING_KEY (openssl rand -hex 32),
# TERMS_URL, PRIVACY_URL, SUPPORT_CONTACT, BACKUP_REMOTE

deploy/scripts/deploy.sh      # сборка, миграции, контент, запуск (nginx пока без TLS)
deploy/scripts/init-cert.sh   # сертификат Let's Encrypt; CERTBOT_STAGING=1 — сначала тестовый
```

Пароли базы применяются только при первом запуске с пустым томом `pgdata`. Если их поменять позже, это нужно сделать и в Postgres (`alter role`).

Затем подключить бота к серверу. Команда ставит вебхук, команды бота и кнопку меню (решения 0020, 0024):

```sh
cd /srv/tma80/deploy && docker compose run --rm server node src/bot/setup.ts
```

В @BotFather указать URL мини-аппа: `https://<DOMAIN>/`.

## 3. Обновление

```sh
cd /srv/tma80 && git pull && deploy/scripts/deploy.sh
```

Скрипт пересобирает образы, применяет новые миграции, загружает `content/` и перезапускает изменившиеся сервисы. После изменения `TERMS_URL` или `PRIVACY_URL` тоже нужен `deploy.sh`: они встроены в сборку мини-аппа.

Полезные команды (из `deploy/`):

```sh
docker compose ps
docker compose logs -f server worker nginx
docker compose run --rm server node src/bot/refundCli.ts <telegram_payment_charge_id>   # возврат (решение 0021)
docker compose exec postgres psql -U postgres -d tma80
```

## 4. Бэкап

1. Создать `deploy/rclone.conf` (в git не попадает, `chmod 600`). Пример для S3-совместимого хранилища:

   ```ini
   [backup]
   type = s3
   provider = Other
   endpoint = https://storage.yandexcloud.net
   region = ru-central1
   access_key_id = <ключ>
   secret_access_key = <секрет>
   ```

   В `deploy/.env`: `BACKUP_REMOTE=backup:<бакет>/tma80`, `BACKUP_KEEP=14`. Чтобы хранилище не видело содержимое, можно добавить поверх удалённое хранилище `type = crypt` и указать в `BACKUP_REMOTE` его.

2. Проверить вручную: `deploy/scripts/backup.sh` — архив должен появиться в `deploy/backups/` и в хранилище.
3. Cron (`crontab -e` под пользователем с доступом к Docker):

   ```cron
   30 3 * * * /srv/tma80/deploy/scripts/backup.sh >> /var/log/tma80-backup.log 2>&1
   ```

4. Проверить восстановление до начала теста, лучше на втором сервере с той же инструкцией:

   ```sh
   deploy/scripts/restore.sh tma80-<время>.tar   # заменяет базу и фото; спросит подтверждение
   ```

## 5. Проверка доступности из России

Перед приглашением тестировщиков:

1. Запустить `deploy/scripts/check-availability.sh https://<DOMAIN>` из нескольких сетей. Скрипт проверяет главную, `/api/health`, раздачу фото и срок сертификата и печатает тайминги. Сети:
   - мобильные операторы: МТС, МегаФон, Билайн, Tele2 — например, ноутбук через раздачу с телефона;
   - 2–3 домашних провайдера;
   - без VPN.
2. В каждой из этих сетей открыть мини-апп в Telegram на iOS и Android: пройти онбординг, открыть блюдо, загрузить фото готовки.
3. Результаты (сеть, дата, OK/FAIL, время `total`) сохранить, например, в заметки к задаче 23b.

Если сеть стабильно не открывает домен — менять провайдера VPS или IP до запуска теста.

## 6. Закрытый тест (задача 23b)

- Доступ не ограничиваем. Мини-апп не рекламируем, тестировщики приходят по ссылкам-приглашениям `https://t.me/<BOT_USERNAME>/<APP_SHORT_NAME>?startapp=<код>`.
- Набрать 20–50 человек. Записать Telegram id своих аккаунтов (команды) — они исключаются из метрик.
- Оплата — настоящими Stars. По просьбе тестировщика — возврат через `refundCli.ts` (раздел 3).
- Через 14 дней после старта снять метрики (решение 0025):

  ```sh
  cd /srv/tma80/deploy
  docker compose run --rm server node src/metrics/cli.ts --from <дата старта> --exclude <tg_id>,<tg_id>
  ```

  Если отчёт пишет, что окна 7 и 14 дней ещё открыты, повторить его через 14 дней после регистрации последнего участника когорты.
