# IRacing-Display

An IRacing display over local network

- Ingest takes the data out of Iracing and sends it over the local network to the telemtry service
- The telemetry then formats this data and saves it
- The dashboard then displays the data that is stored in the telemtry service

## Infra

- Golang data ingest
- RabbitMQ pub/sub
- C# telemetry service
- InfluxDB database
- NextJS dashboard

### Sources

[IRacing data ingest](https://github.com/hiimkyle/vr2c20)

## Next step

- Add all the telemetry data to one bucket per track
- Publish all the data from telemtery folder (Create a way of storing locally what has been sent)
