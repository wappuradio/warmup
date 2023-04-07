FROM docker.io/debian:buster

RUN apt-get update \
 && apt-get install -y curl gcc libsndfile1 \
 && curl -fsSL https://deb.nodesource.com/setup_8.x | bash - \
 && apt-get install -y nodejs=8.17.0-1nodesource1

# Binaries stolen from debian8
COPY wav2png/*so* /usr/local/lib
COPY wav2png/wav2png /usr/local/bin
RUN ldconfig

RUN useradd warmup \
 && mkdir /home/warmup \
 && chown warmup /home/warmup

WORKDIR /home/warmup
COPY --chown=warmup . .

USER warmup
RUN npm install && node_modules/.bin/bower install

CMD ["node", "warmup.js"]
