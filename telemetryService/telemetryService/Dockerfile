FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /App
COPY . ./
RUN dotnet restore telemetryService.sln
RUN dotnet publish src/Presentation/TelemetryService.Worker/TelemetryService.Worker.csproj -o out

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /App
COPY --from=build /App/out .
ENTRYPOINT ["dotnet", "TelemetryService.Worker.dll"]