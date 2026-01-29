require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ApolloServer } = require("apollo-server-express");

const { connectDB } = require("./config/db");
const { initCloudinary } = require("./config/cloudinary");
const { typeDefs } = require("./graphql/typeDefs");
const { resolvers } = require("./graphql/resolvers");
const scalars = require("./graphql/scalars");
const { getUserFromAuthHeader } = require("./utils/auth");

async function start() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "15mb" })); // allow base64 image payloads

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is missing in .env");

  await connectDB(mongoUri);

  const cloudinary = initCloudinary();

  const server = new ApolloServer({
    typeDefs,
    resolvers: { ...scalars, ...resolvers },
    context: ({ req }) => {
      const user = getUserFromAuthHeader(req);
      return { req, user, cloudinary };
    },
    formatError: (err) => {
      return {
        message: err.message,
        code: err.extensions?.code || err.code || "INTERNAL_SERVER_ERROR"
      };
    }
  });

  await server.start();
  server.applyMiddleware({ app, path: "/graphql" });

  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server running: http://localhost:${port}${server.graphqlPath}`);
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
