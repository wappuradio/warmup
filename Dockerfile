FROM docker.io/debian:buster

RUN sed -i s/deb.debian.org/archive.debian.org/g /etc/apt/sources.list \
 && apt-get update \
 && apt-get install -y curl gcc gnupg2 libsndfile1 mpc \
 && apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 1655A0AB68576280 \
 && echo 'deb https://deb.nodesource.com/node_8.x buster main' > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update \
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
