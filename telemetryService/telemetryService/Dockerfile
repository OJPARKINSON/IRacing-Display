FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /App

COPY . ./
RUN dotnet restore telemetryService.sln
RUN dotnet publish TelemetryService/TelemetryService.csproj -c Release -o out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /App

COPY --from=build /App/out .
COPY --from=build /src/TelemetryService.API/Data ./Data

EXPOSE 8080

# Default to combined mode, but can be overridden
ENV RUN_MODE=combined

ENTRYPOINT ["dotnet", "TelemetryService.dll"]