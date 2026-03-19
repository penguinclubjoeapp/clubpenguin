FROM python:3.11-alpine

RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && apk del gcc musl-dev libffi-dev

COPY . .

EXPOSE 3001

CMD ["python", "bot.py"]
