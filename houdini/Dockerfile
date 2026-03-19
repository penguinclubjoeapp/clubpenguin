FROM python:3.11.3-alpine

RUN apk add --no-cache \
    openssl \
    build-base \
    openssl-dev \
    libffi-dev \
    postgresql-client \
    netcat-openbsd

WORKDIR /opt/houdini

# Install dockerize for service readiness checks
ENV DOCKERIZE_VERSION=v0.7.0
RUN ARCH=$(uname -m | sed 's/x86_64/amd64/' | sed 's/aarch64/arm64/') \
    && wget -q "https://github.com/jwilder/dockerize/releases/download/${DOCKERIZE_VERSION}/dockerize-linux-${ARCH}-${DOCKERIZE_VERSION}.tar.gz" \
    && tar -C /usr/local/bin -xzf "dockerize-linux-${ARCH}-${DOCKERIZE_VERSION}.tar.gz" \
    && rm "dockerize-linux-${ARCH}-${DOCKERIZE_VERSION}.tar.gz"

# Clone Houdini source
ARG HOUDINI_COMMIT=master
RUN apk add --no-cache git \
    && git clone https://github.com/solero/houdini.git /tmp/houdini-src \
    && cd /tmp/houdini-src && git checkout ${HOUDINI_COMMIT} \
    && cp -r /tmp/houdini-src/* /opt/houdini/ \
    && rm -rf /tmp/houdini-src \
    && apk del git

# Install Houdini deps + our extras (aiohttp for Discord plugin comms)
COPY requirements.extra.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir -r requirements.extra.txt \
    && apk del build-base openssl-dev libffi-dev

# Plugins directory — world server mounts over this
RUN mkdir -p /opt/houdini/plugins

ENTRYPOINT ["python", "bootstrap.py"]
