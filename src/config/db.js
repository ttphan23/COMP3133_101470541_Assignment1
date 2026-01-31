const mongoose = require("mongoose");

let cached = global._mongooseCached;

if (!cached) {
  cached = global._mongooseCached = { conn: null, promise: null };
}

async function connectDB(uri) {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set("strictQuery", true);
    cached.promise = mongoose.connect(uri, { autoIndex: true }).then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDB };
