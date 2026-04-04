FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY proto/ proto/
COPY src/Pressmark.Api/Pressmark.Api.csproj src/Pressmark.Api/
RUN dotnet restore src/Pressmark.Api/Pressmark.Api.csproj

COPY src/Pressmark.Api/ src/Pressmark.Api/
RUN dotnet publish src/Pressmark.Api/Pressmark.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Pressmark.Api.dll"]
