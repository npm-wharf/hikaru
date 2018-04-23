FROM npmwharf/kickerd:latest
MAINTAINER Alex Robson <asrobson@gmail.com>

RUN mkdir /app
WORKDIR /app
COPY . .
RUN npm i