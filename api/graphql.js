require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { ApolloServer } = require("apollo-server-express");

const { connectDB } = require("../src/config/db");
const { initCloudinary } = require("../src/config/cloudinary");
const { typeDefs } = require("../src/graphql/typeDefs");
const { resolvers } = require("../src/graphql/resolvers");
const scalars = require("../src/graphql/scalars");
const { getUserFromAuthHeader } = require("../src/utils/auth");

let handler;

module.exports = async (req, res) => {
  if (!handler) {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: "15mb" }));

    if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing");
    await connectDB(process.env.MONGO_URI);

    const cloudinary = initCloudinary();

    const server = new ApolloServer({
      typeDefs,
      resolvers: { ...scalars, ...resolvers },
      context: ({ req }) => {
        const user = getUserFromAuthHeader(req);
        return { req, user, cloudinary };
      },
      formatError: (err) => ({
        message: err.message,
        code: err.extensions?.code || err.code || "INTERNAL_SERVER_ERROR"
      })
    });

    await server.start();
    server.applyMiddleware({ app, path: "/api/graphql" });

    handler = app;
  }

  return handler(req, res);
};
