const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { GraphQLError } = require("graphql");
const { v4: uuid } = require("uuid");
const jwt = require("jsonwebtoken");

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

let authors = [
  {
    name: "Robert Martin",
    id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
    born: 1952,
  },
  {
    name: "Martin Fowler",
    id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
    born: 1963,
  },
  {
    name: "Fyodor Dostoevsky",
    id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
    born: 1821,
  },
  {
    name: "Joshua Kerievsky", // birthyear not known
    id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
  },
  {
    name: "Sandi Metz", // birthyear not known
    id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
  },
];

/*
 * Suomi:
 * Saattaisi olla järkevämpää assosioida kirja ja sen tekijä tallettamalla kirjan yhteyteen tekijän nimen sijaan tekijän id
 * Yksinkertaisuuden vuoksi tallennamme kuitenkin kirjan yhteyteen tekijän nimen
 *
 * English:
 * It might make more sense to associate a book with its author by storing the author's id in the context of the book instead of the author's name
 * However, for simplicity, we will store the author's name in connection with the book
 *
 * Spanish:
 * Podría tener más sentido asociar un libro con su autor almacenando la id del autor en el contexto del libro en lugar del nombre del autor
 * Sin embargo, por simplicidad, almacenaremos el nombre del autor en conexión con el libro
 */

// let books = [
//   {
//     title: "Clean Code",
//     published: 2008,
//     author: "Robert Martin",
//     id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
//     genres: ["refactoring"],
//   },
//   {
//     title: "Agile software development",
//     published: 2002,
//     author: "Robert Martin",
//     id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
//     genres: ["agile", "patterns", "design"],
//   },
//   {
//     title: "Refactoring, edition 2",
//     published: 2018,
//     author: "Martin Fowler",
//     id: "afa5de00-344d-11e9-a414-719c6709cf3e",
//     genres: ["refactoring"],
//   },
//   {
//     title: "Refactoring to patterns",
//     published: 2008,
//     author: "Joshua Kerievsky",
//     id: "afa5de01-344d-11e9-a414-719c6709cf3e",
//     genres: ["refactoring", "patterns"],
//   },
//   {
//     title: "Practical Object-Oriented Design, An Agile Primer Using Ruby",
//     published: 2012,
//     author: "Sandi Metz",
//     id: "afa5de02-344d-11e9-a414-719c6709cf3e",
//     genres: ["refactoring", "design"],
//   },
//   {
//     title: "Crime and punishment",
//     published: 1866,
//     author: "Fyodor Dostoevsky",
//     id: "afa5de03-344d-11e9-a414-719c6709cf3e",
//     genres: ["classic", "crime"],
//   },
//   {
//     title: "The Demon ",
//     published: 1872,
//     author: "Fyodor Dostoevsky",
//     id: "afa5de04-344d-11e9-a414-719c6709cf3e",
//     genres: ["classic", "revolution"],
//   },
// ];

/*
  you can remove the placeholder query once your first one has been implemented 
*/

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
`;

const resolvers = {
  Author: {
    bookCount: async (root) =>
      Book.collection.countDocuments({ author: root._id }),
  },
  Token: {
    value: (root) => root.value,
  },
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      let authorPossibly = null;
      if (args.author) {
        console.log("Finding author", args.author);
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

      console.log("Finding books", args);

      let books = await Book.find({
        ...(args.author ? { author: authorPossibly._id } : {}),
        ...(args.genre ? { genres: { $in: [args.genre] } } : {}),
      }).populate("author");
      return books;
    },
    allAuthors: async () => {
      console.log("Finding authors");
      const auth = await Author.find({});
      console.log("Authors", auth);
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
      if (!existingAuthor) {
        existingAuthor = new Author({ name: args.author });
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

      console.log("Creating book", book);

      return await book
        .save()
        .then((savedBook) => {
          return Book.findById(savedBook._id).populate("author");
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
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req, res }) => {
    const auth = req ? req.headers.authorization : null;
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const decodedToken = jwt.verify(
        auth.substring(7),
        process.env.JWT_SECRET
      );
      const currentUser = await User.findById(decodedToken.id);
      return { currentUser };
    }
  },
}).then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
