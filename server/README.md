Build container:
`docker build -t air-server .`

Run container:
`docker run --rm -p 8080:8080 -p 3333:3333 --name go air-server`

Stop container:
`docker stop go`
docker compose up --build
docker compose exec cassandra /bin/bash

tsc.cmd -w
npx tailwindcss -i ./styles_raw.css -o ./styles.css --watch
