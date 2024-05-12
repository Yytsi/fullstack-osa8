const { ApolloServer } = require("@apollo/server");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const { expressMiddleware } = require("@apollo/server/express4");
const {
  ApolloServerPluginDrainHttpServer,
} = require("@apollo/server/plugin/drainHttpServer");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const express = require("express");
const cors = require("cors");
const http = require("http");

const { GraphQLError } = require("graphql");
const jwt = require("jsonwebtoken");

const { PubSub } = require("graphql-subscriptions");
const pubsub = new PubSub();

const Book = require("./models/book");
const Author = require("./models/author");
const User = require("./models/user");

const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;

console.log("connecting to", MONGODB_URI);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("connected to MongoDB");
  })
  .catch((error) => {
    console.log("error connecting to MongoDB:", error.message);
  });

const typeDefs = `
  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
    me: User
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String!]!
    ): Book!

    editAuthor(
      name: String!
      setBornTo: Int
    ): Author

    createUser(
      username: String!
      favoriteGenre: String!
    ): User
    login(
      username: String!
      password: String!
    ): Token
  }

  type Token {
    value: String!
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Author {
    name: String!
    bookCount: Int!
    born: Int
    id: ID!
  }

  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: [String!]!
    id: ID!
  }

  type Subscription {
    bookAdded: Book!
  }
`;

const resolvers = {
  Token: {
    value: (root) => root.value,
  },
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      let authorPossibly = null;
      if (args.author) {
        authorPossibly = await Author.findOne({ name: args.author }).catch(
          (error) => {
            throw new GraphQLError(error.message, {
              extensions: { code: error.code },
            });
          }
        );
        if (!authorPossibly) {
          return [];
        }
      }

      let books = await Book.find({
        ...(args.author ? { author: authorPossibly._id } : {}),
        ...(args.genre ? { genres: { $in: [args.genre] } } : {}),
      }).populate("author");
      return books;
    },
    allAuthors: async () => {
      const auth = await Author.find({});
      return auth;
    },
    me: async (root, args, context) => context.currentUser,
  },
  Mutation: {
    addBook: async (root, args, { currentUser }) => {
      if (!args.title || !args.author || !args.published || !args.genres) {
        throw new GraphQLError("Missing required fields", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (args.title.length < 4) {
        throw new GraphQLError("Title must be at least 4 characters", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (args.author.length < 4) {
        throw new GraphQLError("Author name must be at least 4 characters", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (args.genres.length < 1) {
        throw new GraphQLError("At least one genre must be provided", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // check credentials
      if (!currentUser) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "NO_CREDENTIALS" },
        });
      }

      // find author first or create it if it doesn't exist
      let existingAuthor = await Author.findOne({ name: args.author });
      console.log("The author is", existingAuthor);
      if (!existingAuthor) {
        existingAuthor = new Author({ name: args.author, bookCount: 0 });
        await existingAuthor.save().catch((error) => {
          throw new GraphQLError(error.message, {
            extensions: { code: error.code },
          });
        });
      } else {
        console.log("Author exists", existingAuthor);
      }

      const book = new Book({
        title: args.title,
        published: args.published,
        genres: args.genres,
        author: existingAuthor._id,
      });

      return await book
        .save()
        .then(async (savedBook) => {
          const bookPopulated = await Book.findById(savedBook._id).populate(
            "author"
          );
          // add book to author
          existingAuthor.bookCount += 1;
          await existingAuthor.save();

          pubsub.publish("BOOK_ADDED", { bookAdded: bookPopulated });
          return bookPopulated;
        })
        .catch((error) => {
          throw new GraphQLError(error.message, {
            extensions: { code: error.code },
          });
        });
    },
    editAuthor: async (root, args, { currentUser }) => {
      const editedAuthor = await Author.findOne({ name: args.name });
      if (!editedAuthor) {
        throw new GraphQLError("Author not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      if (!currentUser) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "NO_CREDENTIALS" },
        });
      }
      editedAuthor.born = args.setBornTo;
      await editedAuthor.save().catch((error) => {
        throw new GraphQLError(error.message, {
          extensions: { code: error.code },
        });
      });
      return editedAuthor;
    },

    createUser: async (root, args) => {
      if (!args.username || !args.favoriteGenre) {
        throw new GraphQLError("Missing username or favorite genre.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      if (args.username.length < 3) {
        throw new GraphQLError("Username must be at least 3 characters", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const user = new User({ ...args });
      return user.save().catch((error) => {
        throw new GraphQLError(error.message, {
          extensions: { code: error.code },
        });
      });
    },

    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });
      if (!user || args.password !== "secret") {
        throw new GraphQLError("Invalid username or password", {
          extensions: { code: "UNAUTHORIZED" },
        });
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      };

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
    },
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator(["BOOK_ADDED"]),
    },
  },
};

const start = async () => {
  const app = express();
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/",
  });

  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  app.use(
    "/",
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const auth = req ? req.headers.authorization : null;
        if (auth && auth.toLowerCase().startsWith("bearer")) {
          const decodedToken = jwt.verify(
            auth.substring(7),
            process.env.JWT_SECRET
          );
          const currentUser = await User.findById(decodedToken.id);
          return { currentUser };
        }
      },
    })
  );
  const PORT = 4000;
  httpServer.listen(PORT, () => {
    console.log(`Now running on http:localhost:${PORT}`);
  });
};
start();
