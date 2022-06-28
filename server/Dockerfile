FROM golang:1.18

WORKDIR /

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .
RUN go build -v -o / .

CMD [ "./server" ]