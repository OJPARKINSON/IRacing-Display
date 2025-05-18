FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim-arm64v8 AS build
WORKDIR /App

COPY . ./

RUN dotnet restore

RUN dotnet publish -o out 

FROM mcr.microsoft.com/dotnet/aspnet:8.0.15-bookworm-slim-arm64v8
WORKDIR /App
COPY --from=build /App/out .
ENTRYPOINT ["dotnet", "telemetryService.dll"]