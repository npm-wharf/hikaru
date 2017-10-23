FROM node:8-alpine
MAINTAINER Alex Robson <asrobson@gmail.com>

RUN mkdir /app
WORKDIR /app
COPY . .

CMD [ "node", "./src/server" ]
