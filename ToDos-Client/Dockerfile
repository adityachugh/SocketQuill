FROM hensansi/angular2
COPY / /
RUN apt-get -y update
RUN apt-get -y install npm
RUN npm install -g typescript
RUN npm install -g @angular/cli
RUN npm install
RUN ng build --prod
COPY dist/ /var/www/angular
EXPOSE 80
