FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html style.css app.js picker.js /usr/share/nginx/html/videodepth/
COPY vendor /usr/share/nginx/html/videodepth/vendor
COPY public /usr/share/nginx/html/videodepth/public
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
