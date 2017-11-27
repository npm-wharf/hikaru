FROM node:8-alpine
MAINTAINER Alex Robson <asrobson@gmail.com>

RUN mkdir /app
WORKDIR /app
COPY . .
RUN npm i

CMD [ "node", "./src/server" ]
