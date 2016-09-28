FROM arobson/alpine-node:6.5
MAINTAINER Alex Robson <asrobson@gmail.com>

RUN mkdir /app
WORKDIR /app
COPY . .

CMD [ "node", "./src" ]