FROM docker.io/debian:buster

RUN apt-get update \
 && apt-get install -y curl gcc \
 && curl -fsSL https://deb.nodesource.com/setup_8.x | bash - \
 && apt-get install -y nodejs=8.17.0-1nodesource1

WORKDIR /warmup
COPY . .
RUN npm install

CMD ["node", "warmup.js"]
