#!/bin/bash
# Создаёт файл с данным ботов

mkdir txt
echo '
# Вставьте ник своего бота
[bot_username]
# Вставьте пароль от своего бота
bot_password = 1234
# Вставьте пин-код от своего бота (если есть)
bot_pin = 12345
' > txt/config.ini

echo '' > active_nick.txt
