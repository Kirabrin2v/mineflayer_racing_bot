FROM node:20

# Создаём рабочую директорию
WORKDIR /app

# Устанавливаем зависимости
COPY package*.json ./
RUN npm install
RUN npm install -g forever


# Копируем весь проект
COPY . .

# Устанавливаем SQLite3
RUN apt-get update && apt-get install -y sqlite3

# Создаём БД
RUN chmod +x scripts/init-dbs.sh && ./scripts/init-dbs.sh

# Создаём конфигурационные файлы
RUN chmod +x scripts/init-move.sh && ./scripts/init-move.sh
RUN chmod +x scripts/init-win.sh && ./scripts/init-win.sh
RUN chmod +x scripts/init-config.sh && ./scripts/init-config.sh

CMD ["forever", "main.js"]
