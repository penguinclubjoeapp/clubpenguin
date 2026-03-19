FROM python:3.11.3-alpine

RUN apk add --no-cache \
    openssl \
    build-base \
    openssl-dev \
    libffi-dev \
    jpeg-dev \
    zlib-dev \
    postgresql-client \
    netcat-openbsd

WORKDIR /opt/dash

# Install dockerize for service readiness checks
ENV DOCKERIZE_VERSION=v0.7.0
RUN ARCH=$(uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/') \
    && wget -q "https://github.com/jwilder/dockerize/releases/download/${DOCKERIZE_VERSION}/dockerize-linux-${ARCH}-${DOCKERIZE_VERSION}.tar.gz" \
    && tar -C /usr/local/bin -xzf "dockerize-linux-${ARCH}-${DOCKERIZE_VERSION}.tar.gz" \
    && rm "dockerize-linux-${ARCH}-${DOCKERIZE_VERSION}.tar.gz"

# Clone Dash source
ARG DASH_COMMIT=master
RUN apk add --no-cache git \
    && git clone https://github.com/solero/dash.git /tmp/dash-src \
    && cd /tmp/dash-src && git checkout ${DASH_COMMIT} \
    && cp -r /tmp/dash-src/* /opt/dash/ \
    && rm -rf /tmp/dash-src \
    && apk del git

# Install Python dependencies, then remove build deps
RUN pip install --no-cache-dir -r requirements.txt \
    && apk del build-base openssl-dev libffi-dev

# Config file — reads env vars at runtime via os.environ
COPY config.py ./

ENTRYPOINT ["python", "bootstrap.py"]
