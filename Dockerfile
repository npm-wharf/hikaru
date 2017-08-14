FROM node:alpine-6
MAINTAINER Alex Robson <asrobson@gmail.com>

RUN mkdir /app
WORKDIR /app
COPY . .

CMD [ "node", "./src" ]
