[Digiprime](https://www.digiprime.eu/) is an EU project for the circular economy. This project is part of it and acts as a offer directory, with the ability to create auctions from these offers and negotiate the price on them.

This work is an addition to the work contained in [Digiprime](https://github.com/ShaiFernandez/Digiprime). Our main additions are auctions, negotations, contract selection, and messages. These new additions use the [Negotation Engine](https://github.com/norlen/NegotiationEngine) API to handle negotiation aspect and contract signing.

## Getting started

There exists a ready to use build of [Digiprime](https://hub.docker.com/repository/docker/norlen/digiprime) on Docker Hub that contains all the required projects and dependencies. See the readme there for how to use it.

To instead build it from source, see [digiprime-container](https://github.com/norlen/digiprime-container).

### Pre-requisites

This project cannot be run entirely by itself. Required dependencies include

- [MongoDB](https://www.mongodb.com/) must be installed on the system.
- [Negotiation Engine](https://github.com/norlen/NegotiationEngine) must be running on the system.

### Setup

To start using the project get the source and install all project dependencies

```bash
git clone https://github.com/norlen/Digiprime
cd Digiprime
npm install             # install node deps
```

Before it can run some additional configuration is required. All values can be seen in the `.env.example` file which can be used as a starting point.

Environment variables with defaults are

- `DB_URL`: URL to the mongodb database where all data should be stored, default: `mongodb://localhost:27017/offer-test`.
- `SECRET`: Secret key to encrypt the cookies. Allows for a list of values `first,second,...` to rotate the secrets, the first one will be used to encrypt the cookie. Default: `thisshouldbeabettersecret`.
- `PORT`: Port to start the server, default: `3000`.
- `NEGOTIATION_ENGINE_BASE_URL`: Base URL to Negotiation Engine, default: `http://localhost:5000`.
- `USE_TLS`: If TLS is enabled, this should be `true` to enable secure cookies, default: `false`.

And the other environment variables have no defaults and are **required**

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_HOST_URL`: Secrets required for image uploading, see [Cloudinary](https://cloudinary.com/) for more information.
- `CLOUDINARY_HOST_URL`: Base URL to where the uploaded images are retrieved, e.g. `https://res.cloudinary.com/<your-value>/`.
- `MAPBOX_TOKEN`: API key from [Mapbox](https://www.mapbox.com/).

Debug stack traces become disabled if `NODE_ENV` is not set to `development`.

### Development

To run in development complete the setup and run

```bash
npm run dev
```

### Production

When running in production, set up a reverse proxy with HTTPS and point it to the the app server, then run with

```bash
NODE_ENV="production" USE_TLS="true" npm run start
```

### Seeding

To seed 100 offers with varying sectors, types and prices. Run

```bash
npm run seed
```

Note that this removes all previously created offers, which will break the website if auctions or negotiations have been created.


## Additions

### Auctions

### Negotations

### Messages

### Misc


## Further work
