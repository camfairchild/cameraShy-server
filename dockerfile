FROM node:current-alpine3.13

WORKDIR /usr/src/app
COPY package.json .
# Install packages
RUN yarn install
ADD . /usr/src/app
# Build and run
RUN yarn run build
CMD [ "yarn", "run", "start" ]
EXPOSE 3000