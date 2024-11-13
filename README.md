# IRacing-Display

An IRacing display over local network

- Ingest takes the data out of Iracing and sends it over the local network to the telemtry service
- The telemetry then formats this data and saves it
- The dashboard then displays the data that is stored in the telemtry service

### Sources

[IRacing data ingest](https://github.com/hiimkyle/vr2c20)

[Simple go Websocket](https://www.youtube.com/watch?v=JuUAEYLkGbM&t=722s) 11 mins in

## Learnings

To run python in watch mode (use nodemon)[https://stackoverflow.com/questions/49355010/how-do-i-watch-python-source-code-files-and-restart-when-i-save]

## Next step

Make the websocket receive a message from one connection and then have a new connection listen to that message

- Should already be possible
