FROM docker.io/debian:buster

RUN apt-get update \
    && apt-get install -y curl mpc ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs=20.0.0-deb-1nodesource1

RUN useradd warmup \
    && mkdir /home/warmup \
    && chown warmup /home/warmup

WORKDIR /home/warmup
COPY --chown=warmup . .

USER warmup
RUN npm install && node_modules/.bin/bower install

CMD ["node", "warmup.js"]
